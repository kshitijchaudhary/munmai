import express from "express";
import {
  createUserLiability,
  createUserLiabilityPayment,
  deleteUserLiability,
  getLiabilities,
  getUserLiabilityPayments,
  getUserLiabilitySummary,
  updateUserLiability,
} from "../controllers/liabilityController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/summary", getUserLiabilitySummary);
router.route("/").get(getLiabilities).post(createUserLiability);
router
  .route("/:id/payments")
  .get(getUserLiabilityPayments)
  .post(createUserLiabilityPayment);
router.route("/:id").put(updateUserLiability).delete(deleteUserLiability);

export default router;
