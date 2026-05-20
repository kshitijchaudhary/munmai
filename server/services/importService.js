import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import ImportBatch from "../models/ImportBatch.js";
import ImportRow, { importClassifications } from "../models/ImportRow.js";
import Income from "../models/Income.js";
import Liability from "../models/Liability.js";
import { recordLiabilityPayment } from "./liabilityService.js";

const MAX_IMPORT_ROWS = 1000;

const expenseCategories = new Set([
  "Rent",
  "Food",
  "Groceries",
  "Utilities",
  "Entertainment",
  "Transport",
  "Fuel",
  "Healthcare",
  "Shopping",
  "Phone & Internet",
  "Software & SaaS",
  "Office Supplies",
  "Equipment",
  "Education",
  "Marketing",
  "Travel",
  "Meals",
  "Insurance",
  "Bank Fees",
  "Taxes & Licenses",
  "Professional Services",
  "Contractors",
  "Home Office",
  "Client Gifts",
  "Other",
]);

const expenseCategoryAliases = {
  grocery: "Groceries",
  groceries: "Groceries",
  restaurant: "Meals",
  restaurants: "Meals",
  dining: "Meals",
  transit: "Transport",
  transport: "Transport",
  transportation: "Transport",
  gas: "Fuel",
  fuel: "Fuel",
  internet: "Phone & Internet",
  phone: "Phone & Internet",
  mobile: "Phone & Internet",
  software: "Software & SaaS",
  saas: "Software & SaaS",
  bank: "Bank Fees",
  fees: "Bank Fees",
  tax: "Taxes & Licenses",
  taxes: "Taxes & Licenses",
};

const incomeCategories = new Set([
  "Salary",
  "Freelance",
  "Contract",
  "Marketplace",
  "Business",
  "Gift",
  "Investment",
  "Refund",
  "Other",
]);

const incomeCategoryAliases = {
  payroll: "Salary",
  salary: "Salary",
  paycheque: "Salary",
  paycheck: "Salary",
  freelance: "Freelance",
  contract: "Contract",
  refund: "Refund",
};

const headerAliases = {
  date: ["date", "transaction date", "posted date", "posting date"],
  description: ["description", "details", "detail", "memo", "name", "merchant"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "withdrawal", "withdrawals", "paid out"],
  credit: ["credit", "deposit", "deposits", "paid in"],
};

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const normalizeText = (value) => String(value ?? "").trim();

const normalizeHeader = (value) =>
  normalizeText(value).toLowerCase().replace(/\s+/g, " ");

const assertValidObjectId = (value, message) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
    throw createError(message, 400);
  }
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvText = (text) => {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw createError("CSV must include a header row and at least one data row", 400);
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  if (!headers.length) {
    throw createError("CSV header row is missing", 400);
  }

  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });

  return { headers, rows };
};

const findHeader = (headers, aliases) => {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return (
    normalizedHeaders.find((header) =>
      aliases.some((alias) => header.normalized === alias)
    )?.original || ""
  );
};

const parseAmountValue = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const normalized = normalizeText(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  if (!normalized) {
    return NaN;
  }

  if (/^\(.*\)$/.test(normalized)) {
    return -Number(normalized.slice(1, -1));
  }

  return Number(normalized);
};

const createUtcNoonDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

const parseDateValue = (value) => {
  const rawValue = normalizeText(value);

  if (!rawValue) {
    return null;
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return createUtcNoonDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    return createUtcNoonDate(
      Number(slashMatch[3]),
      Number(slashMatch[1]),
      Number(slashMatch[2])
    );
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return createUtcNoonDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
};

const normalizeRecordDate = (value) => {
  const date = value instanceof Date ? value : parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return new Date();
  }

  return createUtcNoonDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
};

const inferSuggestion = ({ direction, description }) => {
  const normalizedDescription = normalizeText(description).toLowerCase();

  if (/(payroll|salary|paycheque|paycheck|deposit)/i.test(normalizedDescription)) {
    return "income";
  }

  if (
    /(visa payment|mastercard payment|credit card payment|loan|finance)/i.test(
      normalizedDescription
    )
  ) {
    return "debt_payment";
  }

  if (/(transfer|e-transfer between own accounts)/i.test(normalizedDescription)) {
    return "transfer";
  }

  if (direction === "inflow") {
    return "income";
  }

  if (direction === "outflow") {
    return "expense";
  }

  return "unclassified";
};

const normalizeCategory = (value, classification) => {
  const category = normalizeText(value);

  if (classification === "expense") {
    if (!category) return "Other";
    if (expenseCategories.has(category)) return category;
    return expenseCategoryAliases[category.toLowerCase()] || "Other";
  }

  if (classification === "income") {
    if (!category) return "Other";
    if (incomeCategories.has(category)) return category;
    return incomeCategoryAliases[category.toLowerCase()] || "Other";
  }

  return category;
};

const normalizeImportAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError("Amount must be greater than 0", 400);
  }

  return roundMoney(amount);
};

const getRowStatusForPayload = (payload) => {
  const classification = payload.classification || "unclassified";

  if (classification === "ignore") {
    return "ignored";
  }

  if (classification === "unclassified") {
    return "needs_review";
  }

  if (classification === "debt_payment" && !payload.linkedLiability) {
    return "needs_review";
  }

  if (!payload.description || !payload.amount || !payload.parsedDate) {
    return "needs_review";
  }

  return "ready";
};

const syncBatchCounts = async (batchId, { updateStatus = false } = {}) => {
  const rows = await ImportRow.find({ importBatch: batchId }).select(
    "status classification importedRecordType"
  );
  const totalRows = rows.length;
  const reviewedRows = rows.filter(
    (row) => row.classification !== "unclassified" || row.status !== "needs_review"
  ).length;
  const importedRows = rows.filter((row) => row.status === "imported").length;
  const finalizedRows = rows.filter(
    (row) =>
      row.status === "imported" ||
      (row.status === "ignored" && row.importedRecordType === "ignore")
  ).length;
  const updates = { totalRows, reviewedRows, importedRows };

  if (updateStatus) {
    if (totalRows > 0 && finalizedRows === totalRows) {
      updates.status = "imported";
    } else if (finalizedRows > 0 || rows.some((row) => row.status === "error")) {
      updates.status = "partially_imported";
    } else {
      updates.status = "pending_review";
    }
  }

  return ImportBatch.findByIdAndUpdate(batchId, updates, { new: true });
};

const ensureOwnBatch = async (userId, batchId) => {
  assertValidObjectId(batchId, "Invalid import batch ID");

  const batch = await ImportBatch.findOne({ _id: batchId, user: userId });

  if (!batch) {
    throw createError("Import batch not found", 404);
  }

  return batch;
};

const buildRowsFromCsv = ({ userId, batchId, headers, rows }) => {
  const dateHeader = findHeader(headers, headerAliases.date);
  const descriptionHeader = findHeader(headers, headerAliases.description);
  const amountHeader = findHeader(headers, headerAliases.amount);
  const debitHeader = findHeader(headers, headerAliases.debit);
  const creditHeader = findHeader(headers, headerAliases.credit);

  if (!dateHeader || !descriptionHeader || (!amountHeader && !debitHeader && !creditHeader)) {
    throw createError(
      "CSV must include date, description, and amount or debit/credit columns",
      400
    );
  }

  return rows
    .map((row) => {
      const rawDate = normalizeText(row[dateHeader]);
      const rawDescription = normalizeText(row[descriptionHeader]);
      let rawAmount = "";
      let signedAmount = NaN;

      if (debitHeader || creditHeader) {
        const debit = parseAmountValue(row[debitHeader]);
        const credit = parseAmountValue(row[creditHeader]);

        if (Number.isFinite(debit) && debit > 0) {
          signedAmount = -Math.abs(debit);
          rawAmount = normalizeText(row[debitHeader]);
        } else if (Number.isFinite(credit) && credit > 0) {
          signedAmount = Math.abs(credit);
          rawAmount = normalizeText(row[creditHeader]);
        }
      }

      if (!Number.isFinite(signedAmount) && amountHeader) {
        rawAmount = normalizeText(row[amountHeader]);
        signedAmount = parseAmountValue(rawAmount);
      }

      if (!Number.isFinite(signedAmount) || signedAmount === 0) {
        return null;
      }

      const direction = signedAmount >= 0 ? "inflow" : "outflow";
      const amount = roundMoney(Math.abs(signedAmount));
      const suggestedClassification = inferSuggestion({
        direction,
        description: rawDescription,
      });

      return {
        user: userId,
        importBatch: batchId,
        rawDate,
        rawDescription,
        rawAmount,
        parsedDate: parseDateValue(rawDate),
        description: rawDescription,
        amount,
        direction,
        suggestedClassification,
        classification: "unclassified",
        category: "",
        status: "needs_review",
      };
    })
    .filter(Boolean);
};

export const createImportBatchFromCsv = async (userId, file) => {
  if (!file?.buffer) {
    throw createError("CSV file is required", 400);
  }

  const { headers, rows } = parseCsvText(file.buffer.toString("utf8"));

  if (rows.length > MAX_IMPORT_ROWS) {
    throw createError(`CSV imports are limited to ${MAX_IMPORT_ROWS} rows`, 400);
  }

  const batch = await ImportBatch.create({
    user: userId,
    originalFilename: file.originalname || "import.csv",
    totalRows: 0,
    reviewedRows: 0,
    importedRows: 0,
  });

  const importRows = buildRowsFromCsv({
    userId,
    batchId: batch._id,
    headers,
    rows,
  });

  if (!importRows.length) {
    await ImportBatch.findByIdAndDelete(batch._id);
    throw createError("No valid rows were found in that CSV", 400);
  }

  await ImportRow.insertMany(importRows);
  const updatedBatch = await syncBatchCounts(batch._id);

  return { batch: updatedBatch, rowsCreated: importRows.length };
};

export const listImportBatches = async (userId) =>
  ImportBatch.find({
    user: userId,
    $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .limit(25);

export const listImportRows = async (userId, batchId) => {
  await ensureOwnBatch(userId, batchId);

  return ImportRow.find({ user: userId, importBatch: batchId })
    .populate("linkedLiability", "_id creditorName currentBalance status")
    .sort({ createdAt: 1 });
};

export const updateImportRow = async (userId, rowId, payload = {}) => {
  assertValidObjectId(rowId, "Invalid import row ID");

  const row = await ImportRow.findOne({ _id: rowId, user: userId });

  if (!row) {
    throw createError("Import row not found", 404);
  }

  if (row.status === "imported" || row.importedRecordType) {
    throw createError("Imported rows cannot be edited", 400);
  }

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(payload, "classification")) {
    const classification = normalizeText(payload.classification) || "unclassified";

    if (!importClassifications.includes(classification)) {
      throw createError("Import classification is invalid", 400);
    }

    updates.classification = classification;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "category")) {
    updates.category = normalizeText(payload.category);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkedLiability")) {
    const linkedLiability = normalizeText(payload.linkedLiability);

    if (linkedLiability) {
      assertValidObjectId(linkedLiability, "Invalid linked debt ID");

      const liability = await Liability.exists({
        _id: linkedLiability,
        user: userId,
      });

      if (!liability) {
        throw createError("Linked debt not found", 404);
      }
    }

    updates.linkedLiability = linkedLiability || null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    updates.notes = normalizeText(payload.notes);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    updates.description = normalizeText(payload.description);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "amount")) {
    updates.amount = normalizeImportAmount(payload.amount);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "parsedDate")) {
    const parsedDate = parseDateValue(payload.parsedDate);

    if (!parsedDate) {
      throw createError("Parsed date must be a valid date", 400);
    }

    updates.parsedDate = parsedDate;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = normalizeText(payload.status);

    if (!["needs_review", "ready"].includes(status)) {
      throw createError("Import row status is invalid", 400);
    }

    updates.status = status;
  }

  const merged = {
    classification: updates.classification ?? row.classification,
    linkedLiability:
      updates.linkedLiability !== undefined
        ? updates.linkedLiability
        : row.linkedLiability,
    description: updates.description ?? row.description,
    amount: updates.amount ?? row.amount,
    parsedDate: updates.parsedDate ?? row.parsedDate,
  };

  if (!updates.status) {
    updates.status = getRowStatusForPayload(merged);
  }

  const updatedRow = await ImportRow.findOneAndUpdate(
    { _id: rowId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  ).populate("linkedLiability", "_id creditorName currentBalance status");

  await syncBatchCounts(row.importBatch);

  return updatedRow;
};

const createIncomeFromRow = async (userId, row) =>
  Income.create({
    userId,
    amount: row.amount,
    source: row.description || "Imported income",
    category: normalizeCategory(row.category, "income"),
    date: normalizeRecordDate(row.parsedDate),
    notes: row.notes,
  });

const createExpenseFromRow = async (userId, row) =>
  Expense.create({
    userId,
    amount: row.amount,
    recipient: row.description || "Imported expense",
    category: normalizeCategory(row.category, "expense"),
    date: normalizeRecordDate(row.parsedDate),
    notes: row.notes,
    expenseType: "personal",
    deductible: false,
    deductiblePercent: 0,
    taxCategory: "",
    receiptUrl: "",
  });

export const commitImportBatch = async (userId, batchId) => {
  const batch = await ensureOwnBatch(userId, batchId);

  if (batch.status === "cancelled") {
    throw createError("Cancelled imports cannot be committed", 400);
  }

  const summary = {
    incomeImported: 0,
    expensesImported: 0,
    debtPaymentsImported: 0,
    transfersSkipped: 0,
    ignored: 0,
    errors: [],
    totalProcessed: 0,
  };

  const invalidDebtRows = await ImportRow.find({
    user: userId,
    importBatch: batchId,
    classification: "debt_payment",
    importedRecordType: "",
    $or: [{ linkedLiability: null }, { linkedLiability: { $exists: false } }],
  });

  for (const row of invalidDebtRows) {
    row.status = "error";
    await row.save();
    summary.errors.push({
      rowId: row._id,
      message: "Choose which debt this payment belongs to.",
    });
  }

  const rows = await ImportRow.find({
    user: userId,
    importBatch: batchId,
    status: { $in: ["ready", "ignored"] },
    importedRecordType: "",
  }).sort({ createdAt: 1 });

  for (const row of rows) {
    try {
      if (row.classification === "ignore") {
        row.status = "ignored";
        row.importedRecordType = "ignore";
        await row.save();
        summary.ignored += 1;
        continue;
      }

      if (row.classification === "transfer") {
        row.status = "imported";
        row.importedRecordType = "transfer";
        await row.save();
        summary.transfersSkipped += 1;
        continue;
      }

      if (row.classification === "income") {
        const income = await createIncomeFromRow(userId, row);
        row.status = "imported";
        row.importedRecordType = "income";
        row.importedRecordId = income._id;
        await row.save();
        summary.incomeImported += 1;
        continue;
      }

      if (row.classification === "expense") {
        const expense = await createExpenseFromRow(userId, row);
        row.status = "imported";
        row.importedRecordType = "expense";
        row.importedRecordId = expense._id;
        await row.save();
        summary.expensesImported += 1;
        continue;
      }

      if (row.classification === "debt_payment") {
        if (!row.linkedLiability) {
          throw createError("Choose which debt this payment belongs to.", 400);
        }

        const { payment } = await recordLiabilityPayment(userId, row.linkedLiability, {
          amount: row.amount,
          paymentDate: normalizeRecordDate(row.parsedDate),
          note: row.notes || row.description,
        });

        row.status = "imported";
        row.importedRecordType = "liability_payment";
        row.importedRecordId = payment._id;
        await row.save();
        summary.debtPaymentsImported += 1;
      }
    } catch (error) {
      row.status = "error";
      await row.save();
      summary.errors.push({
        rowId: row._id,
        message: error.message || "Import row failed",
      });
    }
  }

  summary.totalProcessed =
    summary.incomeImported +
    summary.expensesImported +
    summary.debtPaymentsImported +
    summary.transfersSkipped +
    summary.ignored +
    summary.errors.length;

  const updatedBatch = await syncBatchCounts(batchId, { updateStatus: true });

  return { batch: updatedBatch, summary };
};

export const deleteImportBatch = async (userId, batchId) => {
  const batch = await ensureOwnBatch(userId, batchId);

  if (!["cancelled", "pending_review"].includes(batch.status)) {
    throw createError(
      "Only cancelled or pending review imports can be removed",
      400
    );
  }

  await ImportRow.deleteMany({
    user: userId,
    importBatch: batchId,
  });

  await ImportBatch.deleteOne({ _id: batchId, user: userId });

  return { message: "Import removed." };
};
