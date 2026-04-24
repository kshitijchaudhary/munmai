import mongoose from "mongoose";
import Group from "../models/Group.js";
import { getActiveMemberIds } from "../services/groupMembershipService.js";
import {
  createSettlement,
  getGroupSettlementHistory as getGroupSettlementHistoryService,
} from "../services/settlementService.js";

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

export const createGroupSettlement = asyncHandler(async (req, res) => {
  try {
    const result = await createSettlement(req.params.groupId, req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const getGroupSettlementHistory = asyncHandler(async (req, res) => {
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
    return res.status(403).json({ message: "Only active group members can view settlements" });
  }

  const history = await getGroupSettlementHistoryService(groupId);

  return res.status(200).json(history);
});

export const createSettlementFromBody = asyncHandler(async (req, res) => {
  try {
    const result = await createSettlement(req.body?.groupId, req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
});
