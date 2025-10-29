import {
  Client,
  Admin,
  ContentCreator,
  SuperAdmin,
} from "../models/authUserModel.js";
import mongoose from 'mongoose';
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../lib/jsonWebToken.js";
import { sendVerificationEmail, sendForgotPasswordEmail } from "../lib/emailService.js";

// Helper to resolve mongoose model for given role
const getModelByRole = (role) => {
  switch (role) {
    case "client":
      return Client;
    case "admin":
      return Admin;
    case "content-creator":
      return ContentCreator;
    case "superadmin":
      return SuperAdmin;
    default:
      return Client;
  }
};

export const Register = async (req, res) => {
  try {
    const { fullName, email, password, phone, role, address, ticket, won } = req.body;
    if (!(fullName && email && password && phone )) { // require role too
      return res.status(400).send("All inputs and role are required");
    }
    const UserModel = getModelByRole(role);
    const existedUser = await UserModel.findOne({ $or: [{ email }, { phone }] });
    if (existedUser) {
      return res.status(400).send("User with email or phone already exists");
    }
    const user = new UserModel({
      fullName,
      email,
      password,
      phone,
      role,
      isVerified: false,
      address,
      ticket: ticket || 0,
      won: won || 0
    });
    const otp = user.generateOTP();
    await user.save();
    await sendVerificationEmail(email, otp);
    return res.status(201).json({
      message: "Registered successfully. OTP sent to email for verification.",
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error registering user", error: error.message });
  }
};

export const VerifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await Client.findOne({ email });
    if (!user) return res.status(400).send("User not found");
    if (user.isVerified) return res.status(400).send("User already verified");
    if (user.verifyToken !== otp) return res.status(400).send("Invalid OTP");
    if (user.verifyTokenExpiry < Date.now()) return res.status(400).send("OTP expired");
    user.isVerified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpiry = undefined;
    await user.save();
    res.json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Email verification failed", error: error.message });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!(email && password)) {
      return res.status(400).send("Email and password required");
    }
    const user = await Client.findOne({ email });
    if (!user) return res.status(401).send("Invalid credentials");
    const allowedRoles = ["admin", "superadmin", "content-creator"];
    if (!user.isVerified && !allowedRoles.includes(user.role)) {
      return res.status(401).send("Email not verified");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send("Invalid credentials");
    const payload = { userId: user._id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    user.refreshToken = refreshToken;
    await user.save();
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ message: "Logged in successfully", accessToken, role: user.role });
  } catch (error) {
    console.error("Login error:", {
      message: error?.message,
      name: error?.name,
      stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
    });
    res.status(500).json({ message: "Login error", error: error.message });
  }
};

export const ForgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send("Email is required");
    const user = await Client.findOne({ email });
    if (!user) return res.status(404).send("User not found");
    const resetToken = user.generateForgotPasswordToken();
    await user.save();
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;
    await sendForgotPasswordEmail(email, resetLink);
    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send password reset email", error: error.message });
  }
};

export const RefreshToken = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return res.status(401).json({ message: "Refresh token not found" });
    const userData = verifyRefreshToken(token);
    if (!userData) return res.status(403).json({ message: "Invalid refresh token" });
    const user = await Client.findById(userData.userId);
    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: "Refresh token mismatch" });
    }
    const payload = { userId: user._id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);
    user.refreshToken = newRefreshToken;
    await user.save();
    res.cookie("jwt", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, role: user.role });
  } catch (error) {
    res.status(500).json({ message: "Could not refresh token", error: error.message });
  }
};

export const Logout = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (token) {
      const userData = verifyRefreshToken(token);
      if (userData) {
        const user = await Client.findById(userData.userId);
        if (user) {
          user.refreshToken = undefined;
          await user.save();
        }
      }
    }
    res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "none" });
    res.clearCookie("jwt", { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

export const GetProfile = async (req, res) => {
  try {
    const user = await Client.findById(req.user.userId)
      .select("-password -refreshToken -verifyToken -forgotPasswordToken");
    if (!user) return res.status(404).send("User not found");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Could not get profile", error: error.message });
  }
};

export const GetAllUsers = async (req, res) => {
  try {
    const users = await Client.find({})
      .select("-password -refreshToken -verifyToken -forgotPasswordToken")
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Could not get users", error: error.message });
  }
};

export const UpdateProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID." });
    }
    const updates = { ...req.body };
    delete updates.password;
    delete updates.refreshToken;
    delete updates.verifyToken;
    delete updates.forgotPasswordToken;
    const updatedUser = await Client.findByIdAndUpdate(
      profileId,
      updates,
      { new: true }
    ).select("-password -refreshToken -verifyToken -forgotPasswordToken");
    if (!updatedUser) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(updatedUser);
  } catch (error) {
    console.error("UpdateProfile error:", error);
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

export const ForgotPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).send("Provide old and new passwords");
    const Model = getModelByRole(req.user.role);
    const user = await Model.findById(req.user.userId);
    if (!user) return res.status(404).send("User not found");
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).send("Incorrect old password");
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update password", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "User ID is required" });
    const roleModels = [SuperAdmin, Admin, ContentCreator, Client];
    let user = null;
    let userModel = null;
    for (const Model of roleModels) {
      user = await Model.findById(userId);
      if (user) {
        userModel = Model;
        break;
      }
    }
    if (!user) return res.status(404).json({ message: "User not found" });
    await userModel.findByIdAndDelete(userId);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

export const SearchUser = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });
  try {
    const users = await Client.aggregate([
      { $match: { $or: [{ email: query }, { phone: query }] } }
    ]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(users[0]);
  } catch (error) {
    console.error("Search user error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// controllers/userController.js
export const saveBillingInfo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    if (!userId) {
      return res.status(400).json({ message: "User not authenticated" });
    }
    const info = req.body;
    const user = await Client.findByIdAndUpdate(
      userId,
      { billingInfo: info },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ billingInfo: user.billingInfo });
  } catch (err) {
    return res.status(500).json({ message: "Could not save billing info" });
  }
};

export const getBillingInfo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    if (!userId) {
      return res.status(400).json({ message: "User not authenticated" });
    }
    const user = await Client.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ billingInfo: user?.billingInfo || null });
  } catch (err) {
    return res.status(500).json({ message: "Could not get billing info" });
  }
};
