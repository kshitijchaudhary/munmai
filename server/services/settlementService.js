import mongoose from "mongoose";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import Settlement from "../models/Settlement.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toIdString = (value) => String(value || "");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getActiveGroupMemberIds = async (groupId) => {
  const [group, activeMemberships] = await Promise.all([
    Group.findById(groupId).select("_id"),
    GroupMembership.find({
      groupId,
      status: "active",
      userId: { $ne: null },
    })
      .select("userId")
      .lean(),
  ]);

  if (!group) {
    throw createError("Group not found", 404);
  }

  return new Set(
    activeMemberships
      .map((membership) => membership.userId)
      .filter(Boolean)
      .map((userId) => toIdString(userId))
  );
};

export const createSettlement = async (groupId, payload, currentUserId) => {
  const from = payload?.from;
  const to = payload?.to;
  const amount = Number(payload?.amount);
  const note = String(payload?.note || "").trim();

  if (!currentUserId || !isValidObjectId(currentUserId)) {
    throw createError("Not authorized", 401);
  }

  if (!groupId || !isValidObjectId(groupId)) {
    throw createError("Invalid group ID", 400);
  }

  if (!from || !isValidObjectId(from)) {
    throw createError("Valid from user ID is required", 400);
  }

  if (!to || !isValidObjectId(to)) {
    throw createError("Valid to user ID is required", 400);
  }

  if (toIdString(from) === toIdString(to)) {
    throw createError("Settlement users must be different", 400);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError("Amount must be greater than 0", 400);
  }

  const memberIds = await getActiveGroupMemberIds(groupId);

  if (!memberIds.has(toIdString(currentUserId))) {
    throw createError("Only active group members can record settlements", 403);
  }

  if (!memberIds.has(toIdString(from)) || !memberIds.has(toIdString(to))) {
    throw createError("Settlement users must be active group members", 400);
  }

  const settlement = await Settlement.create({
    group: groupId,
    from,
    to,
    amount,
    note,
    recordedBy: currentUserId,
  });

  return { settlement };
};

export const getGroupSettlementHistory = async (groupId) => {
  const settlements = await Settlement.find({ group: groupId })
    .populate("from", "_id name email")
    .populate("to", "_id name email")
    .populate("recordedBy", "_id name email")
    .sort({ createdAt: -1 })
    .lean();

  return {
    settlements: settlements.map((settlement) => ({
      _id: settlement._id,
      group: settlement.group,
      from: settlement.from,
      to: settlement.to,
      amount: settlement.amount,
      note: settlement.note,
      recordedBy: settlement.recordedBy,
      createdAt: settlement.createdAt,
    })),
  };
};

export default {
  createSettlement,
  getGroupSettlementHistory,
};
