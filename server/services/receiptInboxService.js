import { access } from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import Expense from "../models/Expense.js";
import Receipt, { receiptStatuses } from "../models/Receipt.js";
import { getUploadDir } from "../utils/uploadPaths.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_DAILY_UPLOAD_LIMIT = 3;
const DEFAULT_WEEKLY_UPLOAD_LIMIT = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;
const configuredDailyUploadLimit = Number.parseInt(
  process.env.RECEIPT_UPLOAD_DAILY_LIMIT || DEFAULT_DAILY_UPLOAD_LIMIT,
  10
);
const configuredWeeklyUploadLimit = Number.parseInt(
  process.env.RECEIPT_UPLOAD_WEEKLY_LIMIT || DEFAULT_WEEKLY_UPLOAD_LIMIT,
  10
);
const dailyUploadLimit = Number.isInteger(configuredDailyUploadLimit)
  ? configuredDailyUploadLimit
  : DEFAULT_DAILY_UPLOAD_LIMIT;
const weeklyUploadLimit = Number.isInteger(configuredWeeklyUploadLimit)
  ? configuredWeeklyUploadLimit
  : DEFAULT_WEEKLY_UPLOAD_LIMIT;
const receiptInboxDir = path.join(getUploadDir(), "receipt-inbox");

const createError = (message, statusCode = 400, code = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

const assertValidObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
    throw createError("Invalid receipt id", 400);
  }
};

const normalizeString = (value) => String(value || "").trim();

const normalizeAmount = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError("Amount must be a valid number", 400);
  }

  return Number(amount.toFixed(2));
};

const normalizeDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(normalizeString)
      .filter(Boolean)
      .slice(0, 25);
  }

  const rawValue = normalizeString(value);

  if (!rawValue) {
    return [];
  }

  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    try {
      const parsed = JSON.parse(rawValue);

      if (Array.isArray(parsed)) {
        return normalizeTags(parsed);
      }
    } catch {
      // Fall back to comma-separated parsing below.
    }
  }

  return rawValue
    .split(",")
    .map(normalizeString)
    .filter(Boolean)
    .slice(0, 25);
};

const normalizeStatus = (value, fallback = "uploaded") => {
  const status = normalizeString(value) || fallback;

  if (!receiptStatuses.includes(status)) {
    throw createError("Receipt status is invalid", 400);
  }

  return status;
};

const normalizePositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shouldIncludeArchived = (value) => String(value || "").toLowerCase() === "true";

const assertReceiptUploadLimits = async (userId) => {
  if (dailyUploadLimit <= 0 && weeklyUploadLimit <= 0) {
    return;
  }

  if (dailyUploadLimit > 0) {
    const dailySince = new Date(Date.now() - DAY_IN_MS);
    const dailyUploadCount = await Receipt.countDocuments({
      user: userId,
      uploadedAt: { $gte: dailySince },
    });

    if (dailyUploadCount >= dailyUploadLimit) {
      throw createError(
        `Free receipt upload limit reached. You can upload up to ${dailyUploadLimit} receipts per 24 hours.`,
        429,
        "RECEIPT_DAILY_UPLOAD_LIMIT_REACHED"
      );
    }
  }

  if (weeklyUploadLimit <= 0) {
    return;
  }

  const weeklySince = new Date(Date.now() - DAYS_IN_WEEK * DAY_IN_MS);
  const weeklyUploadCount = await Receipt.countDocuments({
    user: userId,
    uploadedAt: { $gte: weeklySince },
  });

  if (weeklyUploadCount >= weeklyUploadLimit) {
    throw createError(
      `Free receipt upload limit reached. You can upload up to ${weeklyUploadLimit} receipts per week.`,
      429,
      "RECEIPT_WEEKLY_UPLOAD_LIMIT_REACHED"
    );
  }
};

const normalizeMetadataPayload = (payload = {}, { partial = false } = {}) => {
  const updates = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "vendor")) {
    updates.vendor = normalizeString(payload.vendor);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "amount")) {
    updates.amount = normalizeAmount(payload.amount);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "purchaseDate")) {
    updates.purchaseDate = normalizeDate(payload.purchaseDate, "Purchase date");
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "category")) {
    updates.category = normalizeString(payload.category) || "Other";
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "notes")) {
    updates.notes = normalizeString(payload.notes);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "tags")) {
    updates.tags = normalizeTags(payload.tags);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    updates.status = normalizeStatus(payload.status);
    updates.archivedAt = updates.status === "archived" ? new Date() : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkedExpense")) {
    updates.linkedExpense = payload.linkedExpense || null;
  }

  return updates;
};

const assertOwnedLinkedExpense = async (userId, linkedExpense) => {
  if (!linkedExpense) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(String(linkedExpense))) {
    throw createError("Linked expense is invalid", 400);
  }

  const expense = await Expense.exists({ _id: linkedExpense, userId });

  if (!expense) {
    throw createError("Linked expense not found", 404);
  }

  return linkedExpense;
};

const serializeReceipt = (receipt) => {
  if (!receipt) {
    return receipt;
  }

  const receiptObject =
    typeof receipt.toObject === "function" ? receipt.toObject() : { ...receipt };

  delete receiptObject.filePath;
  delete receiptObject.storedFilename;
  delete receiptObject.__v;

  return receiptObject;
};

const buildReceiptQuery = (userId, query = {}) => {
  const receiptQuery = { user: userId };
  const includeArchived = shouldIncludeArchived(query.includeArchived);

  if (!includeArchived) {
    receiptQuery.status = { $ne: "archived" };
  }

  if (query.status) {
    const status = normalizeStatus(query.status);
    receiptQuery.status =
      status === "archived" && !includeArchived ? "__archived_hidden__" : status;
  }

  if (query.category) {
    receiptQuery.category = normalizeString(query.category);
  }

  const fromDate = normalizeDate(query.from, "From date");
  const toDate = normalizeDate(query.to, "To date");

  if (fromDate || toDate) {
    receiptQuery.purchaseDate = {};

    if (fromDate) {
      receiptQuery.purchaseDate.$gte = fromDate;
    }

    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
      receiptQuery.purchaseDate.$lte = toDate;
    }
  }

  const search = normalizeString(query.search);

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    receiptQuery.$or = [
      { vendor: regex },
      { notes: regex },
      { originalFilename: regex },
      { tags: regex },
    ];
  }

  return receiptQuery;
};

export const createReceipt = async (userId, file, metadata = {}) => {
  if (!file) {
    throw createError("Receipt file is required", 400);
  }

  await assertReceiptUploadLimits(userId);

  const normalizedMetadata = normalizeMetadataPayload(metadata);
  const linkedExpense = await assertOwnedLinkedExpense(
    userId,
    normalizedMetadata.linkedExpense
  );

  const receipt = await Receipt.create({
    user: userId,
    originalFilename: normalizeString(file.originalname),
    storedFilename: path.basename(file.filename),
    filePath: file.path,
    mimeType: file.mimetype,
    sizeBytes: Number(file.size || 0),
    fileExtension: path.extname(file.originalname || "").toLowerCase(),
    ...normalizedMetadata,
    linkedExpense,
    status: normalizedMetadata.status || "uploaded",
    uploadedAt: new Date(),
  });

  return serializeReceipt(receipt);
};

export const listReceipts = async (userId, query = {}) => {
  const page = normalizePositiveInteger(query.page, 1);
  const limit = normalizePositiveInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const receiptQuery = buildReceiptQuery(userId, query);

  const [receipts, total] = await Promise.all([
    Receipt.find(receiptQuery)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Receipt.countDocuments(receiptQuery),
  ]);

  return {
    receipts: receipts.map(serializeReceipt),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getReceiptById = async (userId, receiptId, options = {}) => {
  assertValidObjectId(receiptId);

  const query = { _id: receiptId, user: userId };

  if (!options.includeArchived) {
    query.status = { $ne: "archived" };
  }

  const receipt = await Receipt.findOne(query).lean();

  if (!receipt) {
    throw createError("Receipt not found", 404);
  }

  return options.serialize === false ? receipt : serializeReceipt(receipt);
};

export const updateReceipt = async (userId, receiptId, payload = {}) => {
  assertValidObjectId(receiptId);

  const updates = normalizeMetadataPayload(payload, { partial: true });

  if (Object.prototype.hasOwnProperty.call(updates, "linkedExpense")) {
    updates.linkedExpense = await assertOwnedLinkedExpense(userId, updates.linkedExpense);
  }

  const receipt = await Receipt.findOneAndUpdate(
    { _id: receiptId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!receipt) {
    throw createError("Receipt not found", 404);
  }

  return serializeReceipt(receipt);
};

export const archiveReceipt = async (userId, receiptId) => {
  assertValidObjectId(receiptId);

  const receipt = await Receipt.findOneAndUpdate(
    { _id: receiptId, user: userId },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );

  if (!receipt) {
    throw createError("Receipt not found", 404);
  }

  return {
    message: "Receipt archived.",
    receipt: serializeReceipt(receipt),
  };
};

export const getReceiptFile = async (userId, receiptId) => {
  const receipt = await getReceiptById(userId, receiptId, { serialize: false });
  const storedFilename = path.basename(receipt.storedFilename || "");

  if (!storedFilename) {
    throw createError("Receipt file not found", 404);
  }

  const filePath = path.join(receiptInboxDir, storedFilename);

  try {
    await access(filePath);
  } catch {
    throw createError("Receipt file not found", 404);
  }

  return {
    filePath,
    mimeType: receipt.mimeType,
    originalFilename: receipt.originalFilename,
  };
};
