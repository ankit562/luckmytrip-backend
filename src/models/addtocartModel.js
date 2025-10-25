import mongoose from "mongoose";


const TicketSchema = new mongoose.Schema({
  ticket: {
    type: String,
    required: true,
  },
  ticketPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});
 const GiftSchema = new mongoose.Schema({
  gift: {
    type: String,
    required: true,
  },
  giftPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});



const MultiTicketPurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    name:{ 
      type: String, 
      required: true, 
      trim: true 
    },
    companyName: {
       type: String, 
       trim: true 
      }, 
    streetAddress: { 
      type: String, 
      required: true, 
      trim: true 
    },
    apartmentAddress: { 
      type: String, 
      trim: true 
    }, 
    town: { 
      type: String, 
      required: true 
    },
    phone: { 
      type: String, 
      required: true
    },
    email: { 
      type: String, 
      required: true 
    },

    tickets: [TicketSchema], 

    gift: {
      type: [GiftSchema],
      default: [],
    }, 
    coupon: { 
      type: String, 
      trim: true 
    }, 

    totalPrice: { 
      type: Number, 
      required: true, 
      min: 0
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);





MultiTicketPurchaseSchema.pre("save", function (next) {
  this.totalPrice = this.tickets.reduce(
    (sum, t) => sum + t.ticketPrice * t.quantity,
    0
  );
  this.giftPrice = this.gift.reduce(
    (sum,g) => sum + g.giftPrice * g.quantity, 0
  );
  this.totalPrice += this.giftPrice;
  next();
});

const MultiTicketPurchase = mongoose.model(
  "MultiTicketPurchase",
  MultiTicketPurchaseSchema
);

export default MultiTicketPurchase;
