import express from "express";
import {
  archiveImportHistoryBatchById,
  commitImportBatchById,
  confirmBankStatementPdfRows,
  createCsvImport,
  deleteImportBatchById,
  getImportHistory,
  getImportHistoryById,
  getImportHistoryRows,
  getImportHistorySummaryByUser,
  getImportBatches,
  getImportRows,
  previewBankStatementPdf,
  revertImportHistoryBatchById,
  updateImportRowById,
  uploadBankStatementPdf,
  uploadImportCsv,
} from "../controllers/importController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/csv", uploadImportCsv, createCsvImport);
router.post("/bank/pdf/preview", uploadBankStatementPdf, previewBankStatementPdf);
router.post("/bank/pdf/confirm", confirmBankStatementPdfRows);
router.get("/history/summary", getImportHistorySummaryByUser);
router.get("/history", getImportHistory);
router.patch("/history/:batchId/archive", archiveImportHistoryBatchById);
router.post("/history/:batchId/revert", revertImportHistoryBatchById);
router.get("/history/:batchId/rows", getImportHistoryRows);
router.get("/history/:batchId", getImportHistoryById);
router.get("/", getImportBatches);
router.put("/rows/:rowId", updateImportRowById);
router.get("/:batchId/rows", getImportRows);
router.post("/:batchId/commit", commitImportBatchById);
router.delete("/:batchId", deleteImportBatchById);

export default router;
