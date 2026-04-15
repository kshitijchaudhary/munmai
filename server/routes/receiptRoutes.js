import express from "express";
import { getReceiptFile } from "../controllers/receiptController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:expenseId", protect, getReceiptFile);

export default router;
