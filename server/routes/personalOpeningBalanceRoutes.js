import express from "express";
import {
  getOpeningBalance,
  updateOpeningBalance,
} from "../controllers/personalOpeningBalanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getOpeningBalance).put(updateOpeningBalance);

export default router;
