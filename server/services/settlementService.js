import mongoose from "mongoose";
import Group from "../models/Group.js";
import Settlement from "../models/Settlement.js";
import { validateMoneyAmount } from "../utils/moneyAmount.js";
import { getRawGroupBalances } from "./balanceService.js";
import { getActiveMemberIds } from "./groupMembershipService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toIdString = (value) => String(value || "");
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export const SETTLEMENT_TRANSACTION_MAX_ATTEMPTS = 3;
export const SETTLEMENT_CONCURRENCY_MESSAGE =
  "The Space balance changed while recording the settlement. Please try again.";
export const SETTLEMENT_IDEMPOTENCY_CONFLICT_MESSAGE =
  "Idempotency key has already been used for a different settlement.";
export const SETTLEMENT_NO_BALANCE_MESSAGE =
  "No outstanding balance remains for this settlement.";
export const SETTLEMENT_WRONG_DIRECTION_MESSAGE =
  "Settlement direction no longer matches the current balance.";
export const SETTLEMENT_EXCESSIVE_AMOUNT_MESSAGE =
  "Settlement amount exceeds the current outstanding balance.";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hasErrorLabel = (error, label) =>
  typeof error?.hasErrorLabel === "function" && error.hasErrorLabel(label);

export const isTransientSettlementTransactionError = (error) =>
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

export const runSettlementTransactionWithRetry = async (
  operation,
  {
    maxAttempts = SETTLEMENT_TRANSACTION_MAX_ATTEMPTS,
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
        throw createError("Settlement recording is temporarily unavailable.", 503);
      }

      if (!isTransientSettlementTransactionError(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw createError(SETTLEMENT_CONCURRENCY_MESSAGE, 409);
      }
    } finally {
      await session.endSession();
    }
  }

  throw createError(SETTLEMENT_CONCURRENCY_MESSAGE, 409);
};

const normalizeIdempotencyKey = (value) => String(value || "").trim();

const isSameSettlementRequest = (
  settlement,
  { amount, from, groupId, note, to },
) =>
  toIdString(settlement.group) === toIdString(groupId) &&
  toIdString(settlement.from) === toIdString(from) &&
  toIdString(settlement.to) === toIdString(to) &&
  Number(settlement.amount) === amount &&
  String(settlement.note || "") === note;

const resolveIdempotencyResult = async ({
  amount,
  currentUserId,
  from,
  groupId,
  idempotencyKey,
  note,
  session = null,
  to,
}) => {
  let query = Settlement.findOne({
    idempotencyKey,
    recordedBy: currentUserId,
  });

  if (session) {
    query = query.session(session);
  }

  const settlement = await query;

  if (!settlement) {
    return null;
  }

  if (
    !isSameSettlementRequest(settlement, {
      amount,
      from,
      groupId,
      note,
      to,
    })
  ) {
    throw createError(SETTLEMENT_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }

  return { replayed: true, settlement };
};

const toCents = (amount) => {
  const cents = Math.round(Number(amount) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};

const findPairBalance = (balances, from, to) =>
  balances.find(
    (balance) =>
      (toIdString(balance.from) === toIdString(from) &&
        toIdString(balance.to) === toIdString(to)) ||
      (toIdString(balance.from) === toIdString(to) &&
        toIdString(balance.to) === toIdString(from)),
  );

const createSettlementInTransaction = async ({
  amount,
  currentUserId,
  from,
  groupId,
  idempotencyKey,
  note,
  session,
  to,
}) => {
  const memberIds = await getActiveMemberIds(groupId, { session });

  if (!memberIds.has(toIdString(currentUserId))) {
    throw createError("Only active Space members can record settlements.", 403);
  }

  if (
    toIdString(currentUserId) !== toIdString(from) &&
    toIdString(currentUserId) !== toIdString(to)
  ) {
    throw createError(
      "You can only record settlements involving yourself.",
      403,
    );
  }

  if (!memberIds.has(toIdString(from)) || !memberIds.has(toIdString(to))) {
    throw createError("Settlement participants must be active Space members.", 400);
  }

  const idempotencyResult = await resolveIdempotencyResult({
    amount,
    currentUserId,
    from,
    groupId,
    idempotencyKey,
    note,
    session,
    to,
  });

  if (idempotencyResult) {
    return idempotencyResult;
  }

  const lockResult = await Group.updateOne(
    { _id: groupId },
    { $inc: { settlementVersion: 1 } },
    { session, timestamps: false },
  );

  if (lockResult.matchedCount === 0) {
    throw createError("Group not found", 404);
  }

  const balances = await getRawGroupBalances(groupId, { session });
  const pairBalance = findPairBalance(balances, from, to);

  if (!pairBalance) {
    throw createError(SETTLEMENT_NO_BALANCE_MESSAGE, 409);
  }

  if (
    toIdString(pairBalance.from) !== toIdString(from) ||
    toIdString(pairBalance.to) !== toIdString(to)
  ) {
    throw createError(SETTLEMENT_WRONG_DIRECTION_MESSAGE, 409);
  }

  const requestedCents = toCents(amount);
  const outstandingCents = toCents(pairBalance.amount);

  if (
    requestedCents === null ||
    outstandingCents === null ||
    requestedCents > outstandingCents
  ) {
    throw createError(SETTLEMENT_EXCESSIVE_AMOUNT_MESSAGE, 409);
  }

  const [settlement] = await Settlement.create(
    [
      {
        group: groupId,
        from,
        to,
        amount,
        note,
        recordedBy: currentUserId,
        idempotencyKey,
      },
    ],
    { session },
  );

  return { replayed: false, settlement };
};

export const createSettlement = async (
  groupId,
  payload,
  currentUserId,
  { idempotencyKey: rawIdempotencyKey } = {},
) => {
  const from = payload?.from;
  const to = payload?.to;
  const note = String(payload?.note || "").trim();
  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);

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
    currentUserId,
    from,
    groupId,
    idempotencyKey,
    note,
    to,
  };

  try {
    return await runSettlementTransactionWithRetry((session) =>
      createSettlementInTransaction({ ...request, session }),
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const duplicateResult = await resolveIdempotencyResult(request);

    if (duplicateResult) {
      return duplicateResult;
    }

    throw createError(SETTLEMENT_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }
};

export const getGroupSettlementHistory = async (groupId) => {
  const settlements = await Settlement.find({ group: groupId })
    .populate("from", "_id username name email")
    .populate("to", "_id username name email")
    .populate("recordedBy", "_id username name email")
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
