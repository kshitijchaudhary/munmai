import express from "express";
import { createSharedExpense } from "../controllers/sharedExpenseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createSharedExpense);

export default router;
