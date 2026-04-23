import express from "express";
import {
  acceptGroupInvitation,
  declineGroupInvitation,
  inviteGroupMemberByEmail,
  listCurrentUserInvitations,
  listGroupMemberships,
} from "../controllers/groupMembershipController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/groups/:groupId/invitations", inviteGroupMemberByEmail);
router.get("/groups/:groupId/memberships", listGroupMemberships);
router.get("/group-invitations", listCurrentUserInvitations);
router.post("/group-invitations/:invitationId/accept", acceptGroupInvitation);
router.post("/group-invitations/:invitationId/decline", declineGroupInvitation);

export default router;
