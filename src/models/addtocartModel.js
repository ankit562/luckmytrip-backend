import mongoose from "mongoose";

const TicketPurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true }, // optional
    streetAddress: { type: String, required: true, trim: true },
    apartmentAddress: { type: String, trim: true }, // optional
    town: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },

    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
    },
    ticketPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
    },

    gift: { type: String, trim: true },  // optional
    coupon: { type: String, trim: true }, // optional

    totalPrice: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

TicketPurchaseSchema.pre("save", function (next) {
  this.totalPrice = this.ticketPrice * (this.quantity || 1);
  next();
});

const TicketPurchase = mongoose.model("TicketPurchase", TicketPurchaseSchema);
export default TicketPurchase

