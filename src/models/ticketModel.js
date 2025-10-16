import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['event', 'offer'],
    
  },
  ticket: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['publish', 'archived'],
    
  }
}, { timestamps: true });

export default mongoose.model('Ticket', TicketSchema);
