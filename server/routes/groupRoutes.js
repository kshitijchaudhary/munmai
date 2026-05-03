import express from "express";
import { getGroupBalance } from "../controllers/balanceController.js";
import {
  createGroupSettlement,
  getGroupSettlementHistory,
} from "../controllers/settlementController.js";
import { getGroupExpenseHistory } from "../controllers/sharedExpenseController.js";
import {
  addGroupMembers,
  acceptGroupInvite,
  createGroupInvite,
  createGroup,
  declineGroupInvite,
  deleteGroup,
  getGroupById,
  getGroups,
  getGroupInvites,
  getMyPendingGroupInvites,
  getGroupSummary,
  updateGroup,
} from "../controllers/groupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createGroup).get(getGroups);
router.get("/my-invites", getMyPendingGroupInvites);
router.post("/invitations/:invitationId/accept", acceptGroupInvite);
router.post("/invitations/:invitationId/decline", declineGroupInvite);
router.get("/:groupId/summary", getGroupSummary);
router.get("/:groupId/balances", getGroupBalance);
router.get("/:groupId/expenses", getGroupExpenseHistory);
router
  .route("/:groupId/settlements")
  .get(getGroupSettlementHistory)
  .post(createGroupSettlement);
router.route("/:id").get(getGroupById).put(updateGroup).delete(deleteGroup);
router.post("/:id/members", addGroupMembers);
router.route("/:id/invitations").post(createGroupInvite).get(getGroupInvites);

export default router;
