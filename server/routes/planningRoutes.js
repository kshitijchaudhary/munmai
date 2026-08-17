import express from "express";
import {
  getUserPlanning,
  updateUserPlanning,
} from "../controllers/planningController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getUserPlanning).put(updateUserPlanning);

export default router;
