import mongoose from "mongoose";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toIdString = (value) => String(value || "");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeParticipantIds = (participants = []) => participants.map((value) => String(value));

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

  const memberIds = new Set(
    activeMemberships
      .map((membership) => membership.userId)
      .filter(Boolean)
      .map((memberId) => toIdString(memberId))
  );

  return memberIds;
};

export const createSharedExpense = async (payload, currentUserId) => {
  const groupId = payload?.groupId;
  const paidBy = payload?.paidBy;
  const participants = Array.isArray(payload?.participants) ? payload.participants : [];
  const amount = Number(payload?.amount);
  const description = String(payload?.description || "").trim();

  if (!currentUserId || !isValidObjectId(currentUserId)) {
    throw createError("Not authorized", 401);
  }

  if (!groupId || !isValidObjectId(groupId)) {
    throw createError("Valid groupId is required", 400);
  }

  if (!paidBy || !isValidObjectId(paidBy)) {
    throw createError("Valid paidBy user ID is required", 400);
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw createError("At least one participant is required", 400);
  }

  if (!participants.every(isValidObjectId)) {
    throw createError("All participant IDs must be valid", 400);
  }

  const normalizedParticipants = normalizeParticipantIds(participants);

  if (new Set(normalizedParticipants).size !== normalizedParticipants.length) {
    throw createError("Participants must be unique", 400);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError("Amount must be greater than 0", 400);
  }

  const memberIds = await getActiveGroupMemberIds(groupId);

  if (!memberIds.has(toIdString(currentUserId))) {
    throw createError("Not authorized to create expenses in this group", 403);
  }

  if (!memberIds.has(toIdString(paidBy))) {
    throw createError("paidBy must be a member of the group", 400);
  }

  const hasInvalidParticipant = normalizedParticipants.some(
    (participantId) => !memberIds.has(participantId)
  );

  if (hasInvalidParticipant) {
    throw createError("All participants must be members of the group", 400);
  }

  const splitAmount = amount / normalizedParticipants.length;

  const expense = await SharedExpense.create({
    group: groupId,
    paidBy,
    amount,
    description,
    createdBy: currentUserId,
  });

  const splits = await ExpenseSplit.insertMany(
    normalizedParticipants.map((participantId) => ({
      expense: expense._id,
      user: participantId,
      amount: splitAmount,
    }))
  );

  return {
    expense,
    splits,
  };
};

export default {
  createSharedExpense,
};
