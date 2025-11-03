import express from 'express';
import {recentWinners} from "../controllers/recentlyWinnerController.js";

const router = express.Router()

router.route("/").get(recentWinners);

export default router;