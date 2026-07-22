import express from 'express';
import {
  addIncome,
  getIncomes,
  getIncomeProofFile,
  updateIncome,
  deleteIncome,
} from '../controllers/incomeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireOwnedIncome } from '../middleware/incomeOwnershipMiddleware.js';
import { singleUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getIncomes)
  .post(addIncome);

router.get('/:id/proof', getIncomeProofFile);

router.route('/:id')
  .put(
    requireOwnedIncome,
    singleUpload('proof', { requireFileForMultipart: true }),
    updateIncome,
  )
  .delete(deleteIncome);

export default router;
