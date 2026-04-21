import mongoose from "mongoose";
import Group from "../models/Group.js";
import SharedExpense from "../models/SharedExpense.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeUniqueObjectIds = (values = []) => [
  ...new Set(values.map((value) => String(value))),
];

const getGroupMemberIdSet = (group) => new Set((group.members || []).map(String));

const findAccessibleGroup = (groupId, userId) =>
  Group.findOne({
    _id: groupId,
    members: userId,
  });

const parseExpenseDate = (value) => (value ? new Date(value) : new Date());
const hasMaxTwoDecimalPlaces = (value) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

export const createSharedExpense = asyncHandler(async (req, res) => {
  const {
    groupId,
    paidBy,
    participants = [],
    amount,
    description = "",
    splitType = "equal",
    expenseDate,
  } = req.body;

  if (!groupId || !isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Valid groupId is required" });
  }

  if (!paidBy || !isValidObjectId(paidBy)) {
    return res.status(400).json({ message: "Valid paidBy user ID is required" });
  }

  const normalizedParticipants = normalizeUniqueObjectIds(
    Array.isArray(participants) ? participants : []
  );

  if (normalizedParticipants.length === 0) {
    return res.status(400).json({ message: "At least one participant is required" });
  }

  if (!normalizedParticipants.every(isValidObjectId)) {
    return res.status(400).json({ message: "All participant IDs must be valid" });
  }

  const normalizedAmount = Number(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  if (!hasMaxTwoDecimalPlaces(normalizedAmount)) {
    return res.status(400).json({ message: "Amount cannot have more than 2 decimal places" });
  }

  if (splitType !== "equal") {
    return res.status(400).json({ message: "Only equal split is supported" });
  }

  const normalizedExpenseDate = parseExpenseDate(expenseDate);

  if (Number.isNaN(normalizedExpenseDate.getTime())) {
    return res.status(400).json({ message: "Please provide a valid expense date" });
  }

  const group = await findAccessibleGroup(groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const groupMemberIds = getGroupMemberIdSet(group);

  if (!groupMemberIds.has(String(paidBy))) {
    return res.status(400).json({ message: "paidBy must be a member of the group" });
  }

  const hasInvalidParticipant = normalizedParticipants.some(
    (participantId) => !groupMemberIds.has(participantId)
  );

  if (hasInvalidParticipant) {
    return res.status(400).json({ message: "All participants must be group members" });
  }

  const sharedExpense = await SharedExpense.create({
    groupId,
    paidBy,
    participants: normalizedParticipants,
    amount: normalizedAmount,
    description: String(description || "").trim(),
    splitType: "equal",
    expenseDate: normalizedExpenseDate,
    createdBy: req.user.id,
  });

  return res.status(201).json(sharedExpense);
});

export const getSharedExpenses = asyncHandler(async (req, res) => {
  const { groupId } = req.query;

  if (!groupId || !isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Valid groupId query parameter is required" });
  }

  const group = await findAccessibleGroup(groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const sharedExpenses = await SharedExpense.find({ groupId }).sort({
    expenseDate: -1,
    createdAt: -1,
  });

  return res.status(200).json(sharedExpenses);
});

export const getSharedExpenseById = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid shared expense ID" });
  }

  const sharedExpense = await SharedExpense.findById(req.params.id);

  if (!sharedExpense) {
    return res.status(404).json({ message: "Shared expense not found" });
  }

  const group = await findAccessibleGroup(sharedExpense.groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Shared expense not found" });
  }

  return res.status(200).json(sharedExpense);
});

export const deleteSharedExpense = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid shared expense ID" });
  }

  const sharedExpense = await SharedExpense.findById(req.params.id);

  if (!sharedExpense) {
    return res.status(404).json({ message: "Shared expense not found" });
  }

  const group = await findAccessibleGroup(sharedExpense.groupId, req.user.id);

  if (!group) {
    return res.status(404).json({ message: "Shared expense not found" });
  }

  const canDelete =
    String(sharedExpense.createdBy) === String(req.user.id) ||
    String(group.createdBy) === String(req.user.id);

  if (!canDelete) {
    return res.status(403).json({ message: "Not authorized to delete this shared expense" });
  }

  await sharedExpense.deleteOne();

  return res.status(200).json({
    id: req.params.id,
    message: "Shared expense removed",
  });
});
