import express from "express";
import {
  createSharedExpense,
  deleteSharedExpense,
  getSharedExpenseById,
  getSharedExpenses,
} from "../controllers/sharedExpenseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createSharedExpense).get(getSharedExpenses);
router.route("/:id").get(getSharedExpenseById).delete(deleteSharedExpense);

export default router;
