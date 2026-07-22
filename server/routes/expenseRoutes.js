import express from 'express';
import {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { singleUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(singleUpload('receipt'), addExpense);

router.route('/:id')
  .put(singleUpload('receipt'), updateExpense)
  .delete(deleteExpense);

export default router;
