import express from "express";
import {
  acceptGroupInvitation,
  approveGroupJoinRequest,
  declineGroupInvitation,
  inviteGroupMemberByEmail,
  listCurrentUserInvitations,
  listGroupMemberships,
  rejectGroupJoinRequest,
  requestGroupJoinByCode,
} from "../controllers/groupMembershipController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/groups/join", requestGroupJoinByCode);
router.post("/groups/:groupId/invitations", inviteGroupMemberByEmail);
router.get("/groups/:groupId/memberships", listGroupMemberships);
router.post("/groups/:groupId/memberships/:membershipId/approve", approveGroupJoinRequest);
router.post("/groups/:groupId/memberships/:membershipId/reject", rejectGroupJoinRequest);
router.get("/group-invitations", listCurrentUserInvitations);
router.post("/group-invitations/:invitationId/accept", acceptGroupInvitation);
router.post("/group-invitations/:invitationId/decline", declineGroupInvitation);

export default router;
