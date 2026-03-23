import express from 'express';
import {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(upload.single('receipt'), addExpense);

router.route('/:id')
  .put(upload.single('receipt'), updateExpense)
  .delete(deleteExpense);

export default router;