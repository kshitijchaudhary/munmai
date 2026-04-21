import express from "express";
import {
  createSettlement,
  getSettlements,
} from "../controllers/settlementController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createSettlement).get(getSettlements);

export default router;
