import express from "express";
import {
  addGroupMembers,
  createGroup,
  getGroupById,
  getGroups,
} from "../controllers/groupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createGroup).get(getGroups);
router.get("/:id", getGroupById);
router.post("/:id/members", addGroupMembers);

export default router;
