import UserInfo from "../models/contactUsInfoModel.js";

// Create User
export const createUserInfo = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const user = new UserInfo({ name, email, phone });
    await user.save();
    res.status(201).json({ message: "User created!", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get All Users
export const getAllUserInfos = async (req, res) => {
  try {
    const users = await UserInfo.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get User by ID
export const getUserInfoById = async (req, res) => {
  try {
    const user = await UserInfo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update User by ID
export const updateUserInfo = async (req, res) => {
  try {
    const user = await UserInfo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated!", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete User by ID
export const deleteUserInfo = async (req, res) => {
  try {
    const user = await UserInfo.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted!", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
