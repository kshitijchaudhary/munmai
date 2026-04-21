import express from "express";
import { getGroupBalance } from "../controllers/balanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/:groupId", getGroupBalance);

export default router;
