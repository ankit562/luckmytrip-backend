
import mongoose from "mongoose";

const userInfoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: Number, required: true }
});

const UserInfo = mongoose.model("UserInfo", userInfoSchema);
export default UserInfo;
