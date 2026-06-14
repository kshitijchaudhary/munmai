import express from "express";
import {
  archiveReceipt,
  createReceipt,
  getReceipt,
  getReceiptFile,
  listReceipts,
  updateReceipt,
} from "../controllers/receiptInboxController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  enforceReceiptUploadLimit,
  uploadReceiptInboxFile,
} from "../middleware/receiptInboxUploadMiddleware.js";

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(listReceipts)
  .post(enforceReceiptUploadLimit, uploadReceiptInboxFile, createReceipt);
router.get("/:receiptId/file", getReceiptFile);
router.route("/:receiptId").get(getReceipt).put(updateReceipt).delete(archiveReceipt);

export default router;
