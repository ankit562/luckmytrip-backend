import express from "express";
import {
  startTicketPurchase,
  getCart,
  updateCart,
  removeCartItem,
  placeOrder,
  payuCallback,
  getPurchaseById,
  handlePaymentRedirect,
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
router.post("/payu-callback", payuCallback);
router.get("/purchase/:purchaseId", getPurchaseById);


// ✅ Browser redirect handler (handles both GET and POST from PayU)
router.get("/payment-redirect", handlePaymentRedirect);
router.post("/payment-redirect", handlePaymentRedirect);
export default router;
