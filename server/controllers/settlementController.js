import mongoose from "mongoose";
import Group from "../models/Group.js";
import Settlement from "../models/Settlement.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const findAccessibleGroup = (groupId, userId) =>
  Group.findOne({
    _id: groupId,
    members: userId,
  });

const getGroupMemberIdSet = (group) => new Set((group.members || []).map(String));
const hasMaxTwoDecimalPlaces = (value) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

export const createSettlement = asyncHandler(async (req, res) => {
  const {
    groupId,
    fromUser,
    toUser,
    amount,
    note = "",
    settlementDate,
  } = req.body;

  if (!groupId || !isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Valid groupId is required" });
  }

  if (!fromUser || !isValidObjectId(fromUser)) {
    return res.status(400).json({ message: "Valid fromUser ID is required" });
  }

  if (!toUser || !isValidObjectId(toUser)) {
    return res.status(400).json({ message: "Valid toUser ID is required" });
  }

  if (String(fromUser) === String(toUser)) {
    return res.status(400).json({ message: "Settlement users must be different" });
  }

  const normalizedAmount = Number(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  if (!hasMaxTwoDecimalPlaces(normalizedAmount)) {
    return res.status(400).json({ message: "Amount cannot have more than 2 decimal places" });
  }

  const normalizedSettlementDate = settlementDate
    ? new Date(settlementDate)
    : new Date();

  if (Number.isNaN(normalizedSettlementDate.getTime())) {
    return res.status(400).json({ message: "Please provide a valid settlement date" });
  }

  const group = await findAccessibleGroup(groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const groupMemberIds = getGroupMemberIdSet(group);

  if (!groupMemberIds.has(String(fromUser)) || !groupMemberIds.has(String(toUser))) {
    return res.status(400).json({ message: "Settlement users must belong to the group" });
  }

  const settlement = await Settlement.create({
    groupId,
    fromUser,
    toUser,
    amount: normalizedAmount,
    note: String(note || "").trim(),
    settlementDate: normalizedSettlementDate,
    createdBy: req.user.id,
  });

  return res.status(201).json(settlement);
});

export const getSettlements = asyncHandler(async (req, res) => {
  const { groupId } = req.query;

  if (!groupId || !isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Valid groupId query parameter is required" });
  }

  const group = await findAccessibleGroup(groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const settlements = await Settlement.find({ groupId }).sort({
    settlementDate: -1,
    createdAt: -1,
  });

  return res.status(200).json(settlements);
});
