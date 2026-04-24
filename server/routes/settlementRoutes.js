import express from "express";
import { createSettlementFromBody } from "../controllers/settlementController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createSettlementFromBody);

export default router;
