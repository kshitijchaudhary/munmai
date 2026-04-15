import express from "express";
import {
  exportTaxPackCsv,
  getDashboardSummary,
  getTaxPackSummary,
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/summary", protect, getDashboardSummary);
router.get("/tax-pack/summary", protect, getTaxPackSummary);
router.get("/tax-pack/export", protect, exportTaxPackCsv);

export default router;
