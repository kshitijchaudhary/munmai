import express from "express";
import {
  getUserSafeToSpend,
  getUserPlanning,
  prepareUserNextPlanningCycle,
  updateUserPlanning,
} from "../controllers/planningController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/safe-to-spend", getUserSafeToSpend);
router.post("/prepare-next-cycle", prepareUserNextPlanningCycle);
router.route("/").get(getUserPlanning).put(updateUserPlanning);

export default router;
