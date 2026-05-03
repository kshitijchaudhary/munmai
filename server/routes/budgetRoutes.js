import express from "express";
import { getBudget, updateBudget } from "../controllers/budgetController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getBudget).put(updateBudget);

export default router;
