import Product from '../models/productModel.js';
import { body, validationResult } from 'express-validator';
import { uploadOnCloudinary } from '../lib/cloudinary.js';

export const productValidationRules = () => [
  body('name').notEmpty().withMessage('Name is required').isLength({ min: 2 }),
  body('price').optional().isFloat({ min: 0 }),
  body('content').notEmpty().withMessage('Content is required').isLength({ min: 5 }),
];

export const listProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const addProduct = async (req, res) => {
  await Promise.all(productValidationRules().map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const imageLocalPath = req.files?.image?.[0]?.path;
    const image2LocalPath = req.files?.image2?.[0]?.path;

    if (!imageLocalPath) return res.status(400).json({ error: 'Image file is required' });

    const image = await uploadOnCloudinary(imageLocalPath);
    const image2 = image2LocalPath ? await uploadOnCloudinary(image2LocalPath) : null;

    if (!image) return res.status(500).json({ error: 'Image upload failed' });

    const productData = {
      ...req.body,
      image: image.secure_url,
      image2: image2?.secure_url || ''
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({ message: 'Product created successfully', product });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateProduct = async (req, res) => {
  await Promise.all(productValidationRules().map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const imageLocalPath = req.files?.image?.[0]?.path;
    const image2LocalPath = req.files?.image2?.[0]?.path;

    const updateData = { ...req.body };

    if (imageLocalPath) {
      const image = await uploadOnCloudinary(imageLocalPath);
      if (!image) return res.status(500).json({ error: 'Image upload failed' });
      updateData.image = image.secure_url;
    }

    if (image2LocalPath) {
      const image2 = await uploadOnCloudinary(image2LocalPath);
      updateData.image2 = image2?.secure_url || '';
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product updated successfully', product });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};
