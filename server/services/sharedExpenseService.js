import mongoose from "mongoose";
import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import { validateMoneyAmount } from "../utils/moneyAmount.js";
import { getActiveMemberIds } from "./groupMembershipService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toIdString = (value) => String(value || "");
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export const SHARED_EXPENSE_TRANSACTION_MAX_ATTEMPTS = 3;
export const SHARED_EXPENSE_CONCURRENCY_MESSAGE =
  "The Space balance changed while recording the expense. Please try again.";
export const SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE =
  "Idempotency key has already been used for a different shared expense.";
export const SHARED_EXPENSE_TOO_SMALL_MESSAGE =
  "The expense amount is too small to split among all participants.";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hasErrorLabel = (error, label) =>
  typeof error?.hasErrorLabel === "function" && error.hasErrorLabel(label);

const isTransientTransactionError = (error) =>
  hasErrorLabel(error, "TransientTransactionError") ||
  hasErrorLabel(error, "UnknownTransactionCommitResult") ||
  [112, 244, 251].includes(error?.code);

const isTransactionUnsupportedError = (error) =>
  error?.code === 20 ||
  /transaction numbers are only allowed|replica set/i.test(
    String(error?.message || ""),
  );

const abortTransaction = async (session) => {
  try {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
  } catch {
    // Preserve the original transaction failure.
  }
};

export const runTransactionWithRetry = async (
  operation,
  {
    maxAttempts = SHARED_EXPENSE_TRANSACTION_MAX_ATTEMPTS,
    startSession = () => mongoose.startSession(),
  } = {},
) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await startSession();

    try {
      session.startTransaction();
      const result = await operation(session, attempt);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await abortTransaction(session);

      if (isTransactionUnsupportedError(error)) {
        throw createError("Shared expense recording is temporarily unavailable.", 503);
      }

      if (!isTransientTransactionError(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw createError(SHARED_EXPENSE_CONCURRENCY_MESSAGE, 409);
      }
    } finally {
      await session.endSession();
    }
  }

  throw createError(SHARED_EXPENSE_CONCURRENCY_MESSAGE, 409);
};

const normalizeIdempotencyKey = (value) => String(value || "").trim();

const isSameParticipants = (existingIds, requestIds) =>
  existingIds.length === requestIds.length &&
  existingIds.every((id, index) => toIdString(id) === toIdString(requestIds[index]));

const resolveIdempotencyResult = async ({
  amount,
  createdBy,
  description,
  groupId,
  idempotencyKey,
  paidBy,
  participants,
  session = null,
}) => {
  const expense = await SharedExpense.findOne({
    idempotencyKey,
    createdBy,
  })
    .select("+idempotencyKey +idempotencyParticipants")
    .session(session || null)
    .lean();

  if (!expense) {
    return null;
  }

  if (
    !expense.idempotencyParticipants ||
    !Array.isArray(expense.idempotencyParticipants)
  ) {
    throw createError(SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }

  if (
    toIdString(expense.group) !== toIdString(groupId) ||
    toIdString(expense.paidBy) !== toIdString(paidBy) ||
    Number(expense.amount) !== amount ||
    String(expense.description || "") !== description ||
    !isSameParticipants(expense.idempotencyParticipants, participants)
  ) {
    throw createError(SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }

  const existingSplits = await ExpenseSplit.find({ expense: expense._id })
    .sort({ createdAt: 1 })
    .session(session || null)
    .lean();

  delete expense.idempotencyKey;
  delete expense.idempotencyParticipants;
  return { expense, splits: existingSplits, replayed: true };
};

const computeCentsAllocations = (totalCents, participantCount) => {
  const baseCents = Math.floor(totalCents / participantCount);
  const remainderCents = totalCents % participantCount;
  const allocations = [];

  for (let index = 0; index < participantCount; index += 1) {
    allocations.push(baseCents + (index < remainderCents ? 1 : 0));
  }

  return allocations;
};

const createExpenseInTransaction = async ({
  amount,
  createdBy,
  description,
  groupId,
  idempotencyKey,
  normalizedParticipants,
  paidBy,
  session,
}) => {
  const memberIds = await getActiveMemberIds(groupId, { session });

  if (!memberIds.has(toIdString(createdBy))) {
    throw createError("Not authorized to create expenses in this group", 403);
  }

  const isPayer = toIdString(createdBy) === toIdString(paidBy);
  const isParticipant = normalizedParticipants.some(
    (id) => toIdString(createdBy) === id,
  );

  if (!isPayer && !isParticipant) {
    throw createError(
      "You can only create expenses involving yourself.",
      403,
    );
  }

  if (!memberIds.has(toIdString(paidBy))) {
    throw createError("paidBy must be a member of the group", 400);
  }

  if (!normalizedParticipants.includes(toIdString(paidBy))) {
    throw createError("The payer must be included in the participants.", 400);
  }

  const hasInvalidParticipant = normalizedParticipants.some(
    (participantId) => !memberIds.has(participantId),
  );

  if (hasInvalidParticipant) {
    throw createError("All participants must be members of the group", 400);
  }

  const idempotencyResult = await resolveIdempotencyResult({
    amount,
    createdBy,
    description,
    groupId,
    idempotencyKey,
    paidBy,
    participants: normalizedParticipants,
    session,
  });

  if (idempotencyResult) {
    return idempotencyResult;
  }

  const totalCents = Math.round(amount * 100);

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw createError("Amount must be greater than 0.", 400);
  }

  if (totalCents < normalizedParticipants.length) {
    throw createError(SHARED_EXPENSE_TOO_SMALL_MESSAGE, 400);
  }

  const allocations = computeCentsAllocations(
    totalCents,
    normalizedParticipants.length,
  );

  const [expense] = await SharedExpense.create(
    [
      {
        group: groupId,
        paidBy,
        amount,
        description,
        createdBy,
        idempotencyKey,
        idempotencyParticipants: normalizedParticipants,
      },
    ],
    { session },
  );

  const splitDocuments = normalizedParticipants.map((participantId, index) => ({
    expense: expense._id,
    user: participantId,
    amount: allocations[index] / 100,
  }));

  const splits = await ExpenseSplit.insertMany(splitDocuments, { session });

  return { expense, splits, replayed: false };
};

export const createSharedExpense = async (
  payload,
  currentUserId,
  { idempotencyKey: rawIdempotencyKey } = {},
) => {
  const groupId = payload?.groupId;
  const paidBy = payload?.paidBy;
  const participants = Array.isArray(payload?.participants)
    ? payload.participants
    : [];
  const description = String(payload?.description || "").trim();
  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

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

  const normalizedParticipants = participants.map((value) =>
    String(value),
  );

  if (new Set(normalizedParticipants).size !== normalizedParticipants.length) {
    throw createError("Participants must be unique", 400);
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw createError("A valid Idempotency-Key header is required.", 400);
  }

  const amountValidation = validateMoneyAmount(payload?.amount);

  if (!amountValidation.valid) {
    throw createError(amountValidation.error, 400);
  }

  const amount = amountValidation.amount;
  const request = {
    amount,
    createdBy: currentUserId,
    description,
    groupId,
    idempotencyKey,
    normalizedParticipants,
    participants: normalizedParticipants,
    paidBy,
  };

  try {
    return await runTransactionWithRetry((session) =>
      createExpenseInTransaction({ ...request, session }),
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const duplicateResult = await resolveIdempotencyResult(request);

    if (duplicateResult) {
      return duplicateResult;
    }

    throw createError(SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }
};

export const getGroupExpenseHistory = async (groupId) => {
  const expenses = await SharedExpense.find({ group: groupId })
    .populate("paidBy", "_id username name email")
    .populate("createdBy", "_id username name email")
    .sort({ createdAt: -1 })
    .lean();

  if (expenses.length === 0) {
    return { expenses: [] };
  }

  const expenseIds = expenses.map((expense) => expense._id);
  const splits = await ExpenseSplit.find({
    expense: { $in: expenseIds },
  })
    .populate("user", "_id username name email")
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
