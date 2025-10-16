import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: false,
    min: 0
  },
  image: {
    type: String,
    required: true
  },
   image2: { 
    type: String, 
    required: false 
},
  content: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('Product', ProductSchema);
