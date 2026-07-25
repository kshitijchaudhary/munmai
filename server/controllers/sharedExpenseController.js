import mongoose from "mongoose";
import Group from "../models/Group.js";
import { getActiveMemberIds } from "../services/groupMembershipService.js";
import {
  createSharedExpense as createSharedExpenseService,
  getGroupExpenseHistory as getGroupExpenseHistoryService,
} from "../services/sharedExpenseService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const respondWithError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Server Error" });

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const createSharedExpense = asyncHandler(async (req, res) => {
  try {
    const result = await createSharedExpenseService(
      req.body,
      req.user.id,
      { idempotencyKey: req.get("Idempotency-Key") },
    );
    return res
      .status(result.replayed ? 200 : 201)
      .json({ expense: result.expense, splits: result.splits });
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const getGroupExpenseHistory = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  if (!isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await Group.findById(groupId).select("_id").lean();

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const activeMemberIds = await getActiveMemberIds(groupId);
  const isMember = activeMemberIds.has(String(req.user.id));

  if (!isMember) {
    return res.status(403).json({ message: "Only active group members can view expenses" });
  }

  const history = await getGroupExpenseHistoryService(groupId);

  return res.status(200).json(history);
});
