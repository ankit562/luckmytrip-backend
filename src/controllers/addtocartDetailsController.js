import TicketPurchase from "../models/addtocartModel.js";
import { sendOrderConfirmationEmail } from "../lib/emailService.js";

// Start Ticket Purchase (save info, status: pending)
export const startTicketPurchase = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      companyName,
      streetAddress,
      apartmentAddress,
      town,
      phone,
      email,
      ticket,
      ticketPrice,
      quantity,
      gift,
      coupon,
    } = req.body;

    const purchase = new TicketPurchase({
      user: userId,
      name,
      companyName,
      streetAddress,
      apartmentAddress,
      town,
      phone,
      email,
      ticket,
      ticketPrice,
      quantity,
      gift,
      coupon,
      // status defaults to "pending"
    });

    await purchase.save();

    return res.status(201).json({ success: true, purchase });
  } catch (err) {
    console.error("Start Ticket Purchase error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PayU webhook callback (payment confirmation)
export const payuCallback = async (req, res) => {
  try {
    const { orderId, paymentStatus, userEmail } = req.body;

    if (paymentStatus === "success") {
      const purchase = await TicketPurchase.findById(orderId).populate("ticket");

      if (!purchase) return res.status(404).send("Purchase not found");

      purchase.status = "confirmed";
      await purchase.save();

      const tickets = [
        {
          name: purchase.ticket.name,
          quantity: purchase.quantity,
          price: purchase.totalPrice,
        },
      ];

      await sendOrderConfirmationEmail(userEmail, tickets, orderId);

      return res.status(200).send("Payment processed and email sent");
    } else {
      return res.status(400).send("Payment failed");
    }
  } catch (error) {
    console.error("PayU webhook error:", error);
    return res.status(500).send("Internal Server Error");
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

// Place order: update status and simulate payment trigger
export const placeOrder = async (req, res) => {
  try {
    const { purchaseId } = req.body;

    const purchase = await TicketPurchase.findById(purchaseId).populate("ticket");

    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });

    // TODO: Create and return PayU payment order info for frontend redirection

    purchase.status = "confirmed";
    await purchase.save();

    return res.status(200).json({ success: true, message: "Order placed successfully", purchase });
  } catch (error) {
    console.error("Place Order error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
