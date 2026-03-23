import express from 'express';
import {
  addIncome,
  getIncomes,
  updateIncome,
  deleteIncome,
} from '../controllers/incomeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getIncomes)
  .post(addIncome);

router.route('/:id')
  .put(updateIncome)
  .delete(deleteIncome);

export default router;