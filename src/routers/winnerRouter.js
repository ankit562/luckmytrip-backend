import express from "express"
import {drawWinner} from "../controllers/winnerController.js"
import { authMiddleware } from "../middleware/authUserMiddleware.js";

const router = express.Router();

router.route("/").post(authMiddleware , drawWinner)

export default router;