import mongoose from "mongoose";
import Group from "../models/Group.js";
import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import { getActiveMemberIds } from "./groupMembershipService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toIdString = (value) => String(value || "");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeParticipantIds = (participants = []) => participants.map((value) => String(value));

const getActiveGroupMemberIds = async (groupId) => {
  const [group, memberIds] = await Promise.all([
    Group.findById(groupId).select("_id"),
    getActiveMemberIds(groupId),
  ]);

  if (!group) {
    throw createError("Group not found", 404);
  }

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

export const getGroupExpenseHistory = async (groupId) => {
  const expenses = await SharedExpense.find({ group: groupId })
    .populate("paidBy", "_id name email")
    .populate("createdBy", "_id name email")
    .sort({ createdAt: -1 })
    .lean();

  if (expenses.length === 0) {
    return { expenses: [] };
  }

  const expenseIds = expenses.map((expense) => expense._id);
  const splits = await ExpenseSplit.find({
    expense: { $in: expenseIds },
  })
    .populate("user", "_id name email")
    .sort({ createdAt: 1 })
    .lean();

  const splitsByExpenseId = new Map();

  for (const split of splits) {
    const expenseId = toIdString(split.expense);
    const expenseSplits = splitsByExpenseId.get(expenseId) || [];
    expenseSplits.push({
      _id: split._id,
      user: split.user,
      amount: split.amount,
    });
    splitsByExpenseId.set(expenseId, expenseSplits);
  }

  return {
    expenses: expenses.map((expense) => ({
      _id: expense._id,
      group: expense.group,
      paidBy: expense.paidBy,
      amount: expense.amount,
      description: expense.description,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      splits: splitsByExpenseId.get(toIdString(expense._id)) || [],
    })),
  };
};

export default {
  createSharedExpense,
  getGroupExpenseHistory,
};
