import express from 'express';
import { addIncome, getIncomes, deleteIncome } from '../controllers/incomeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware applied to all routes below
router.use(protect);

// Endpoint: /api/income
router.route('/')
  .get(getIncomes)
  .post(addIncome);

// Endpoint: /api/income/:id
router.route('/:id')
  .delete(deleteIncome);

export default router;