import express from "express";
import {
  createUserInfo,
  getAllUserInfos,
  getUserInfoById,
  updateUserInfo,
  deleteUserInfo,
} from "../controllers/contactusInfoController.js";

const router = express.Router();

router.post("/", createUserInfo);           // Create
router.get("/", getAllUserInfos);           // Read all
router.get("/:id", getUserInfoById);        // Read one
router.put("/:id", updateUserInfo);         // Update
router.delete("/:id", deleteUserInfo);      // Delete

export default router;
