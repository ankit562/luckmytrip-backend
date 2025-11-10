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

router.route("/").post(authMiddleware(), startTicketPurchase);

router.route("/").get(authMiddleware(), getCart);
router.route("/:itemId").patch(authMiddleware(), updateCart);
router.route("/:itemId").delete(authMiddleware(), removeCartItem);

router.post("/place-order", authMiddleware(), placeOrder);
router.post("/payu-callback", payuCallback);
router.get("/purchase/:purchaseId", getPurchaseById);

router.get("/payment-redirect", handlePaymentRedirect);
router.post("/payment-redirect", handlePaymentRedirect);
export default router;


