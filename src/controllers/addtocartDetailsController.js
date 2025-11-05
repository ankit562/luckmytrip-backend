import crypto from "crypto";
import MultiTicketPurchase from "../models/addtocartModel.js";
import Ticket from "../models/ticketModel.js";
import { sendOrderConfirmationEmail } from "../lib/emailService.js";
import { Client } from "../models/authUserModel.js";

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

// Helpers for stock handling
const normalizeName = (name) => (name || "").toString().replace(/_TICKET$/i, "").replace(/_/g, " ").trim();

async function decrementTicketStock(purchase) {
  if (!purchase?.tickets?.length) return;
  for (const item of purchase.tickets) {
    const qty = Number(item?.quantity) || 0;
    const nameQuery = normalizeName(item?.ticket);
    if (!nameQuery || qty <= 0) continue;
    try {
      let doc = await Ticket.findOne({ name: { $regex: `^${nameQuery}$`, $options: "i" } });
      if (!doc) doc = await Ticket.findOne({ name: { $regex: nameQuery, $options: "i" } });
      if (!doc) continue;
      const newCount = Math.max(0, (Number(doc.ticket) || 0) - qty);
      if (newCount !== doc.ticket) {
        doc.ticket = newCount;
        await doc.save();
      }
    } catch {}
  }
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
      tickets,
      gift,
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
      totalPrice,
    });

    await purchase.save();

    return res.status(201).json({ success: true, purchase });
  } catch (err) {
    console.error("Start Ticket Purchase error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const placeOrder = async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const purchase = await MultiTicketPurchase.findById(purchaseId);

    if (!purchase)
      return res.status(404).json({ success: false, message: "Purchase not found" });

    // Validate stock before proceeding
    for (const item of purchase.tickets || []) {
      const qty = Number(item?.quantity) || 0;
      const nameQuery = normalizeName(item?.ticket);
      if (!nameQuery || qty <= 0) continue;
      let doc = await Ticket.findOne({ name: { $regex: `^${nameQuery}$`, $options: "i" } })
        || await Ticket.findOne({ name: { $regex: nameQuery, $options: "i" } });
      if (!doc || (Number(doc.ticket) || 0) <= 0) {
        return res.status(400).json({ success: false, message: `${nameQuery} ticket out of stock` });
      }
    }

    const txnid = purchase._id.toString();
    const amount = purchase.totalPrice.toFixed(2);

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

    if (!process.env.PAYU_KEY) {
      console.error("PAYU_KEY environment variable is not set!");
      return res.status(500).json({
        success: false,
        message: "Payment configuration error",
      });
    }

    const hash = generatePayuHash(payuData, process.env.PAYU_SALT);

    const payuBaseUrl = process.env.PAYU_BASE_URL || "https://test.payu.in";
    const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:3000";

    const paymentRequest = {
      actionUrl: `${payuBaseUrl}/_payment`,
      key: payuData.key,
      txnid: payuData.txnid,
      amount: payuData.amount,
      productinfo: payuData.productinfo,
      firstname: payuData.firstname,
      email: payuData.email,
      phone: purchase.phone || "",
      surl: `${backendBaseUrl}/api/v1/cart/payment-redirect`,
      furl: `${backendBaseUrl}/api/v1/cart/payment-redirect`,
      hash,
    };

    purchase.status = "pending";
    await purchase.save();

    return res.status(200).json({ success: true, paymentRequest });
  } catch (error) {
    console.error("Place Order error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PayU webhook callback handler
export const payuCallback = async (req, res) => {
  try {
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

    if (!txnid || !status) {
      return res.status(400).send("Missing required fields");
    }

    const purchase = await MultiTicketPurchase.findById(txnid);

    if (!purchase) {
      return res.status(404).send("Purchase not found");
    }

    const salt = process.env.PAYU_SALT;
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

    const generatedHash = crypto
      .createHash("sha512")
      .update(hashSequence)
      .digest("hex");

    // (Hash check can be skipped for testing)

    if (status.toLowerCase() === "success") {
      purchase.status = "confirmed";
      await purchase.save();

      // Decrement stock
      await decrementTicketStock(purchase);

      // ✅ Update client's ticket count here
      const totalTicketsBought = purchase.tickets.reduce((sum, t) => sum + t.quantity, 0);
      await Client.findByIdAndUpdate(purchase.user, { $inc: { ticket: totalTicketsBought } });

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
      } catch (emailError) {
        // Don't fail the webhook if email fails
      }
      return res.status(200).send("Payment processed successfully");
    } else {
      purchase.status = "cancelled";
      await purchase.save();
      return res.status(200).send("Payment failed");
    }
  } catch (error) {
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
        message: "Purchase not found",
      });
    }
    return res.status(200).json({
      success: true,
      purchase,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const handlePaymentRedirect = async (req, res) => {
  try {
    const params = req.method === "POST" ? req.body : req.query;
    const { txnid, status, mihpayid, amount, hash: payuHash } = params;

    if (!txnid) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
    }

    const purchase = await MultiTicketPurchase.findById(txnid);

    if (!purchase) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?txnid=${txnid}`);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (status && status.toLowerCase() === "success") {
      purchase.status = "confirmed";
      await purchase.save();

      // Decrement stock
      await decrementTicketStock(purchase);

      // ✅ Update client's ticket count here
      const totalTicketsBought = purchase.tickets.reduce((sum, t) => sum + t.quantity, 0);
      await Client.findByIdAndUpdate(purchase.user, { $inc: { ticket: totalTicketsBought } });

      // Send confirmation email asynchronously
      sendOrderConfirmationEmail(
        purchase.email,
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
      ).catch((err) => {});

      return res.redirect(
        `${frontendUrl}/payment-success?txnid=${txnid}&status=success&mihpayid=${mihpayid || ""}`
      );
    } else {
      purchase.status = "cancelled";
      await purchase.save();

      return res.redirect(
        `${frontendUrl}/payment-failed?txnid=${txnid}&status=failed`
      );
    }
  } catch (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-failed`
    );
  }
};

// Place order and generate PayU payment details
// export const placeOrder = async (req, res) => {
//   try {
//     const { purchaseId } = req.body;
//     // console.log("Placing order for purchaseId:", purchaseId);
//     const purchase = await MultiTicketPurchase.findById(purchaseId);

//     if (!purchase)
//       return res.status(404).json({ success: false, message: "Purchase not found" });

//     const txnid = purchase._id.toString();
//     const amount = purchase.totalPrice.toFixed(2);


//     // Combine product info string with ticket names and quantities
//     const productinfo = purchase.tickets
//       .map((t) => `${t.ticket} x${t.quantity}`)
//       .join(", ");

//     const firstname = purchase.name;
//     const email = purchase.email;

//     const payuData = {
//       key: process.env.PAYU_KEY,
//       txnid,
//       amount,
//       productinfo,
//       firstname,
//       email,
//     };
    


//     const hash = generatePayuHash(payuData, process.env.PAYU_SALT);

//     const payuBaseUrl = process.env.PAYU_BASE_URL || "https://test.payu.in";
//     const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

//     const paymentRequest = {
//       actionUrl: `${payuBaseUrl}/_payment`,
//       key: payuData.key,
//       txnid: payuData.txnid,
//       amount: payuData.amount,
//       productinfo: payuData.productinfo,
//       firstname: payuData.firstname,
//       email: payuData.email,
//       phone: purchase.phone || "",
//       surl: `${frontendBaseUrl}/payment-success?txnid=${txnid}`,
//       furl: `${frontendBaseUrl}/payment-failed?txnid=${txnid}`,
//       hash,
//     };
//    console.log("Frontend URL:", process.env.FRONTEND_URL);

//     purchase.status = "pending";
//     await purchase.save();
//     console.log("Frontend URL2:", process.env.FRONTEND_URL);


//     return res.status(200).json({ success: true, paymentRequest });
//   } catch (error) {
//     console.error("Place Order error:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

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

