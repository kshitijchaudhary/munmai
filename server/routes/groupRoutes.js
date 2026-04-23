import express from "express";
import {
  addGroupMembers,
  acceptGroupInvite,
  createGroupInvite,
  createGroup,
  declineGroupInvite,
  getGroupById,
  getGroups,
  getGroupInvites,
  getMyPendingGroupInvites,
} from "../controllers/groupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createGroup).get(getGroups);
router.get("/my-invites", getMyPendingGroupInvites);
router.post("/invitations/:invitationId/accept", acceptGroupInvite);
router.post("/invitations/:invitationId/decline", declineGroupInvite);
router.get("/:id", getGroupById);
router.post("/:id/members", addGroupMembers);
router.route("/:id/invitations").post(createGroupInvite).get(getGroupInvites);

export default router;
