import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Base Client Schema (previously userSchema)
const clientSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, "Please provide your name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true,
  },
  address: { 
    type: String,
  },
  role: {
    type: String,
    enum: ['client', 'admin', 'content-creator', 'superadmin'],
    default: 'client',
  },
  won:{
      type:Number,
      required:false,
      default:0
  },
  socialLogins: {
    facebook: { id: String, token: String },
    gmail: { id: String, token: String },
    instagram: { id: String, token: String },
    twitter: { id: String, token: String },
  },
  billingInfo: {
    firstName: { type: String },
    companyName: { type: String },
    address: { type: String },
    apartment: { type: String },
    city: { type: String },
    phone: { type: String },
    email: { type: String },
  },
  ticket:{
    type:Number,
    required:false,
    default:0
  },
  refreshToken: {
    type: String,  // for JWT refresh token management
  },

  verifyToken: String,
  verifyTokenExpiry: Date,
  isVerified: { type: Boolean, default: false },
  // Forgot password
  forgotPasswordToken: String,
  forgotPasswordTokenExpiry: Date,
  createdAt: { type: Date, default: Date.now },
});

// Password hashing before save
clientSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password compare method
clientSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// OTP generation for email verification
clientSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.verifyToken = otp;
  this.verifyTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
  return otp;
};

// Forgot password token generation
clientSchema.methods.generateForgotPasswordToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.forgotPasswordToken = token;
  this.forgotPasswordTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour expiry
  return token;
};

// Main Client model
const Client = mongoose.model('Client', clientSchema);

// Discriminators for other roles extending Client
const contentCreatorSchema = new mongoose.Schema({
  role: { type: String, default: 'content-creator' },
  address: { type: String, required: false },
});

const adminSchema = new mongoose.Schema({
  role: { type: String, default: 'admin' },
  address: { type: String, required: false },
});

const superAdminSchema = new mongoose.Schema({
  role: { type: String, default: 'superadmin' },
  address: { type: String, required: false },
});

const ContentCreator = Client.discriminator('ContentCreator', contentCreatorSchema);
const Admin = Client.discriminator('Admin', adminSchema);
const SuperAdmin = Client.discriminator('SuperAdmin', superAdminSchema);

export { Client, ContentCreator, Admin, SuperAdmin };