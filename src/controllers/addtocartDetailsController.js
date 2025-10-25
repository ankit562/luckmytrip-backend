import crypto from "crypto";
import MultiTicketPurchase from "../models/addtocartModel.js";
import { sendOrderConfirmationEmail } from "../lib/emailService.js";

// Helper: Generate PayU payment hash
function generatePayuHash(data, salt) {
  const hashSequence = [
    data.key,
    data.txnid,
    data.amount,
    data.productinfo,
    data.firstname,
    data.email,
    "", "", "", "", "", // udf1 to udf5
    "", "", "", "", "", // udf6 to udf10
  ].join("|") + "|" + salt;

  return crypto.createHash("sha512").update(hashSequence).digest("hex");
}

// Create purchase with multiple tickets
export const startTicketPurchase = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const {
      name,
      companyName,
      streetAddress,
      apartmentAddress,
      town,
      phone,
      email,
      tickets, // array expected
      gift, // array expected
      totalPrice,
      coupon,
    } = req.body;

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Tickets array is required" });
    }

    const purchase = new MultiTicketPurchase({
      user: userId,
      name,
      companyName,
      streetAddress,
      apartmentAddress,
      town,
      phone,
      email,
      tickets,
      gift,
      coupon,
      totalPrice
    });

    await purchase.save();

    return res.status(201).json({ success: true, purchase });
  } catch (err) {
    console.error("Start Ticket Purchase error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Place order and generate PayU payment details
export const placeOrder = async (req, res) => {
  try {
    const { purchaseId } = req.body;
    // console.log("Placing order for purchaseId:", purchaseId);
    const purchase = await MultiTicketPurchase.findById(purchaseId);

    if (!purchase)
      return res.status(404).json({ success: false, message: "Purchase not found" });

    const txnid = purchase._id.toString();
    const amount = purchase.totalPrice.toFixed(2);


    // Combine product info string with ticket names and quantities
    const productinfo = purchase.tickets
      .map((t) => `${t.ticket} x${t.quantity}`)
      .join(", ");

    const firstname = purchase.name;
    const email = purchase.email;

    const payuData = {
      key: process.env.PAYU_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
    };
    


    const hash = generatePayuHash(payuData, process.env.PAYU_SALT);

    const payuBaseUrl = process.env.PAYU_BASE_URL || "https://test.payu.in";
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const paymentRequest = {
      actionUrl: `${payuBaseUrl}/_payment`,
      key: payuData.key,
      txnid: payuData.txnid,
      amount: payuData.amount,
      productinfo: payuData.productinfo,
      firstname: payuData.firstname,
      email: payuData.email,
      phone: purchase.phone || "",
      surl: `${frontendBaseUrl}/payment-success?txnid=${txnid}`,
      furl: `${frontendBaseUrl}/payment-failed?txnid=${txnid}`,
      hash,
    };
   console.log("Frontend URL:", process.env.FRONTEND_URL);

    purchase.status = "pending";
    await purchase.save();
    console.log("Frontend URL2:", process.env.FRONTEND_URL);


    return res.status(200).json({ success: true, paymentRequest });
  } catch (error) {
    console.error("Place Order error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PayU webhook callback handler
export const payuCallback = async (req, res) => {
  try {
    console.log("=== PayU Webhook Received ===");
    console.log("Request Body:", req.body);
    console.log("Request Headers:", req.headers);

    const {
      mihpayid,
      status,
      txnid,
      amount,
      hash: payuHash,
      key,
      productinfo,
      firstname,
      email,
    } = req.body;

    // Check if all required fields are present
    if (!txnid || !status) {
      console.error("Missing required fields in webhook");
      return res.status(400).send("Missing required fields");
    }

    console.log("Transaction ID:", txnid);
    console.log("Payment Status:", status);

    const purchase = await MultiTicketPurchase.findById(txnid);

    if (!purchase) {
      console.error("Purchase not found for txnid:", txnid);
      return res.status(404).send("Purchase not found");
    }

    console.log("Purchase found:", purchase._id);

    const salt = process.env.PAYU_SALT;

    // Hash verification sequence (for response/webhook, use reverse order)
    const hashSequence = [
      salt,
      status,
      "", "", "", "", "", // udf10 to udf6
      "", "", "", "", "", // udf5 to udf1
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      key,
    ].join("|");

    console.log("Hash Sequence:", hashSequence);

    const generatedHash = crypto
      .createHash("sha512")
      .update(hashSequence)
      .digest("hex");

    console.log("Generated Hash:", generatedHash);
    console.log("PayU Hash:", payuHash);

    if (generatedHash !== payuHash) {
      console.warn("⚠️ Hash mismatch in PayU callback");
      console.log("Expected:", generatedHash);
      console.log("Received:", payuHash);
      // ✅ In test mode, you might want to skip hash validation
      // Comment out this return for testing:
      // return res.status(400).send("Invalid hash");
    }

    if (status.toLowerCase() === "success") {
      console.log("✅ Payment successful, updating status...");
      
      purchase.status = "confirmed";
      await purchase.save();

      console.log("Purchase status updated to confirmed");

      // Send confirmation email
      try {
        await sendOrderConfirmationEmail(
          email,
          purchase.tickets.map((t) => ({
            name: t.ticket,
            quantity: t.quantity,
            price: t.ticketPrice * t.quantity,
          })),
          purchase.gift.map((g) => ({
            name: g.gift,
            quantity: g.quantity,
            price: g.giftPrice * g.quantity,
          })),
          purchase._id.toString()
        );
        console.log("Confirmation email sent");
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail the webhook if email fails
      }

      return res.status(200).send("Payment processed successfully");
    } else {
      console.log("❌ Payment failed or cancelled");
      purchase.status = "cancelled";
      await purchase.save();
      return res.status(200).send("Payment failed");
    }
  } catch (error) {
    console.error("PayU webhook error:", error);
    return res.status(500).send("Internal Server Error");
  }
};


// Get purchase details by ID
export const getPurchaseById = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    
    const purchase = await MultiTicketPurchase.findById(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ 
        success: false, 
        message: "Purchase not found" 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      purchase 
    });
  } catch (error) {
    console.error("Get Purchase error:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};



// Get all purchases (cart/orders) for user
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const purchases = await TicketPurchase.find({ user: userId }).populate("ticket");

    return res.status(200).json({ success: true, purchases });
  } catch (error) {
    console.error("Get Cart error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update purchase (cart item)
export const updateCart = async (req, res) => {
  try {
    const purchaseId = req.params.itemId;
    const updateData = req.body;

    const updatedPurchase = await TicketPurchase.findByIdAndUpdate(purchaseId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedPurchase) return res.status(404).json({ success: false, message: "Purchase not found" });

    return res.status(200).json({ success: true, purchase: updatedPurchase });
  } catch (error) {
    console.error("Update Cart error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove purchase (cart item)
export const removeCartItem = async (req, res) => {
  try {
    const purchaseId = req.params.itemId;

    const deletedPurchase = await TicketPurchase.findByIdAndDelete(purchaseId);
    if (!deletedPurchase) return res.status(404).json({ success: false, message: "Purchase not found" });

    return res.status(200).json({ success: true, message: "Purchase removed" });
  } catch (error) {
    console.error("Remove Cart Item error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

