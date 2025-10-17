import TicketPurchase from "../models/addtocartModel.js";
import {sendOrderConfirmationEmail } from "../lib/emailService.js"

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
      status: "pending",
    });

    await purchase.save();
    res.status(201).json({ success: true, purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PayU webhook callback (payment confirmation)
export const payuCallback = async (req, res) => {
  try {
    const { orderId, paymentStatus, userEmail, ticketName, quantity, totalPrice } = req.body;

    if (paymentStatus === "success") {
      const purchase = await TicketPurchase.findById(orderId).populate("ticket");
      if (!purchase) return res.status(404).send("Purchase not found");

      purchase.status = "confirmed";
      await purchase.save();

      const emailHtml = `
        <h2>Ticket Purchase Confirmation - Order ID: ${orderId}</h2>
        <p>Thank you for buying the ticket <b>${purchase.ticket.name}</b>!</p>
        <p>Quantity: ${purchase.quantity}</p>
        <p>Total Price Paid: ₹${purchase.totalPrice}</p>
      `;

      await sendOrderConfirmationEmail(userEmail, "Your Ticket Purchase Confirmation", emailHtml);
      res.status(200).send("Payment processed and email sent");
    } else {
      res.status(400).send("Payment failed");
    }
  } catch (error) {
    console.error("PayU webhook error:", error);
    res.status(500).send("Internal Server Error");
  }
};


// Get user cart/orders
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const carts = await AddToCart.find({ user: userId })
      .populate("tickets.ticket")
      .populate("products.product");

    res.status(200).json({ success: true, carts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update cart item quantity, address etc.
export const updateCart = async (req, res) => {
  try {
    const cartId = req.params.itemId;
    const updateData = req.body;

    const updatedCart = await AddToCart.findByIdAndUpdate(cartId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCart) return res.status(404).json({ success: false, message: "Cart not found" });

    res.status(200).json({ success: true, cart: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove item from cart OR cancel cart
export const removeCartItem = async (req, res) => {
  try {
    const cartId = req.params.itemId;

    const deletedCart = await AddToCart.findByIdAndDelete(cartId);
    if (!deletedCart) return res.status(404).json({ success: false, message: "Cart not found" });

    res.status(200).json({ success: true, message: "Cart removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Place order: Update status and trigger payment (example just updating status here)
export const placeOrder = async (req, res) => {
  try {
    const { cartId } = req.body;
    const cart = await AddToCart.findById(cartId)
      .populate("tickets.ticket")
      .populate("products.product");

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    // Here you should generate PayU order and redirect user on frontend accordingly
    // For demo, we mark it confirmed (in real scenario - do it after successful payment callback)
    cart.status = "confirmed";
    await cart.save();

    res.status(200).json({ success: true, message: "Order placed successfully", cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

