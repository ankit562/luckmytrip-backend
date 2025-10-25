import express from 'express';
import {
  Register,
  VerifyEmail,
  Login,
  RefreshToken,
  Logout,
  GetProfile,
  UpdateProfile,
  ForgotPassword,
  ForgotPasswordRequest,   
  GetAllUsers ,
  deleteUser,
  SearchUser,
  getBillingInfo,
  saveBillingInfo

} from '../controllers/authUserController.js';

import { authMiddleware } from '../middleware/authUserMiddleware.js';

const router = express.Router();

router.route("/register").post(Register);
router.route("/verify-email").post(VerifyEmail);
router.route("/login").post(Login);
router.route("/refresh-token").post(RefreshToken);
router.route("/allprofiles").get(authMiddleware(), GetAllUsers);
router.route("/logout").post(authMiddleware(), Logout);
router.route("/profile").get(authMiddleware(), GetProfile);
router.route("/update-profile/:id").patch(authMiddleware(), UpdateProfile);
router.route("/update-password").patch(authMiddleware(), ForgotPassword);
router.route("/forgot-password").post(ForgotPasswordRequest);
router.route("/:userId").delete(authMiddleware(), deleteUser);
router.route("/search-user").get(SearchUser);
router.route("/billing-info").get(authMiddleware(), getBillingInfo);
router.route("/billing-info").post(authMiddleware(), saveBillingInfo);





export default router;
