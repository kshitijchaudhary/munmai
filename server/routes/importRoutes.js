import express from "express";
import {
  commitImportBatchById,
  createCsvImport,
  deleteImportBatchById,
  getImportBatches,
  getImportRows,
  previewBankStatementPdf,
  updateImportRowById,
  uploadBankStatementPdf,
  uploadImportCsv,
} from "../controllers/importController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/csv", uploadImportCsv, createCsvImport);
router.post("/bank/pdf/preview", uploadBankStatementPdf, previewBankStatementPdf);
router.get("/", getImportBatches);
router.put("/rows/:rowId", updateImportRowById);
router.get("/:batchId/rows", getImportRows);
router.post("/:batchId/commit", commitImportBatchById);
router.delete("/:batchId", deleteImportBatchById);

export default router;
