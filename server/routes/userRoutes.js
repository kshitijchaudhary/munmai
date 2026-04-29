import express from "express";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  updateUserProfile,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/me").get(protect, getCurrentUserProfile).put(protect, updateCurrentUserProfile);
router.patch("/profile", protect, updateUserProfile);

export default router;
