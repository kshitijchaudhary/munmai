import express from "express";
import {
  createOpeningBalance,
  getOpeningBalances,
} from "../controllers/openingBalanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createOpeningBalance).get(getOpeningBalances);

export default router;
