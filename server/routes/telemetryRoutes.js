import express from "express";
import {
  trackClientError,
  trackEvent,
} from "../controllers/telemetryController.js";

const router = express.Router();

router.post("/event", trackEvent);
router.post("/error", trackClientError);

export default router;
