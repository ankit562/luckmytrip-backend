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

import { sendVerificationEmail, sendForgotPasswordEmail } from "../lib/emailService.js"; // Adjust path

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
    const { fullName, email, password, phone, role , address ,ticket  , won} = req.body;
    
    if (!(fullName && email && password && phone )) { // require role too
      return res.status(400).send("All inputs and role are required");
    }
    
    const UserModel = getModelByRole(role);
    
    // Validate duplicates in the chosen Model instead of Client only
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


// Verify user email with OTP
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


// Login user issuing access and refresh tokens, saving refresh token in DB
export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!(email && password)) {
      return res.status(400).send("Email and password required");
    }

    const user = await Client.findOne({ email });
    if (!user) return res.status(401).send("Invalid credentials");
    if (!user.isVerified) return res.status(401).send("Email not verified");

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
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000  
    });

    res.cookie("refreshToken", refreshToken, {  
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

  

    res.json({ message: "Logged in successfully", accessToken });
  } catch (error) {
    res.status(500).json({ message: "Login error", error: error.message });
  }
};

// Extend your authUserController to add forgot password request (to send reset email)
export const ForgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send("Email is required");

    const user = await Client.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const resetToken = user.generateForgotPasswordToken();
    await user.save();

    // Construct your frontend reset URL including token as param
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;

    await sendForgotPasswordEmail(email, resetLink);

    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to send password reset email", error: error.message });
  }
};

// Refresh access token using stored refresh token
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
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ message: "Could not refresh token", error: error.message });
  }
};

// Logout user clearing refresh token cookie and DB field
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

    res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "Strict" });
     res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "Strict" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

// Get profile data depending on user role
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
    // Find all users, exclude sensitive fields
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

    // Use the base Client model here, not getModelByRole
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

// Update password with old password verification
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
    

    // List of all user role models
    const roleModels = [SuperAdmin, Admin, ContentCreator, Client];

    let user = null;
    let userModel = null;

    // Find user in one of the collections
    for (const Model of roleModels) {
      user = await Model.findById(userId);
      if (user) {
        userModel = Model;
        break;
      }
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete user
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
      { $match: { $or: [ { email: query }, { phone: query } ] } }
      // Optionally $project or other stages
    ]);
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(users[0]);
  } catch (error) {
    console.error("Search user error:", error);
    res.status(500).json({ error: "Server error" });
  }
};