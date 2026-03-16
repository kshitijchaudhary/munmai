import express from 'express';
import { addIncome, getIncomes, deleteIncome } from '../controllers/incomeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protection to all routes in this file
router.use(protect);

router.route('/')
  .get(getIncomes)
  .post(addIncome);

router.route('/:id')
  .delete(deleteIncome);

export default router;