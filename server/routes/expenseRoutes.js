import express from 'express';
import { addExpense, getExpenses, deleteExpense } from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js'; // Ensure this matches your file name

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(upload.single('receipt'), addExpense); // Handles the file upload

router.route('/:id')
  .delete(deleteExpense);

export default router;