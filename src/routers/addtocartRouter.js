import express from "express";
import {
  startTicketPurchase,
  getCart,
  updateCart,
  removeCartItem,
  placeOrder,
  payuCallback,
} from "../controllers/addtocartDetailsController.js";
import { authMiddleware } from "../middleware/authUserMiddleware.js";

const router = express.Router();

// Protected routes - require user auth
router.route("/").post(authMiddleware(), startTicketPurchase);
router.route("/").get(authMiddleware(), getCart);
router.route("/:itemId").patch(authMiddleware(), updateCart);
router.route("/:itemId").delete(authMiddleware(), removeCartItem);

// Place order route - generates PayU payment data and returns to frontend
router.post("/place-order", authMiddleware(), placeOrder);

// PayU payment callback webhook - no auth, PayU calls this
router.post("/payu-callback", payuCallback);

export default router;
