import Expense from "../../models/Expense.js";
import Income from "../../models/Income.js";
import {
  createImportHash,
  dateOnlyToUtcNoonDate,
  normalizeDateOnly,
} from "./importDeduplication.js";

const MAX_PDF_CONFIRM_ROWS = 100;

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

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) => String(value ?? "").trim();

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const normalizeAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return roundMoney(amount);
};

const normalizeType = (value) => normalizeText(value).toLowerCase();

const normalizeIncomeCategory = (value) => normalizeText(value) || "Other";

const normalizeExpenseCategory = (value) => {
  const category = normalizeText(value);

  if (!category) return "Other";
  if (expenseCategories.has(category)) return category;

  return "Other";
};

const buildMetadata = ({ fileName, importHash, row }) => ({
  importSource: "pdf",
  importFileName: fileName,
  importHash,
  importedAt: new Date(),
  originalDescription: normalizeText(row.description),
  originalRawText: normalizeText(row.rawText),
  sourceRowNumber: Number(row.rowNumber || 0),
});

const isDuplicateKeyError = (error) => error?.code === 11000;

const hasDuplicateImportHash = async (userId, importHash) => {
  const [incomeDuplicate, expenseDuplicate] = await Promise.all([
    Income.exists({ userId, importHash }),
    Expense.exists({ userId, importHash }),
  ]);

  return Boolean(incomeDuplicate || expenseDuplicate);
};

const buildSkippedResult = (rowNumber, reason) => ({
  rowNumber,
  status: "skipped",
  reason,
});

const buildErrorResult = (rowNumber, message) => ({
  rowNumber,
  status: "error",
  message,
});

const validateConfirmPayload = (userId, payload) => {
  if (!userId) {
    throw createError("Authenticated user is required", 401);
  }

  if (!normalizeText(payload?.fileName)) {
    throw createError("PDF file name is required", 400);
  }

  if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
    throw createError("At least one PDF row is required", 400);
  }

  if (payload.rows.length > MAX_PDF_CONFIRM_ROWS) {
    throw createError(
      `PDF confirm import is limited to ${MAX_PDF_CONFIRM_ROWS} rows`,
      400
    );
  }
};

export const confirmPdfImportRows = async (userId, payload = {}) => {
  validateConfirmPayload(userId, payload);

  const fileName = normalizeText(payload.fileName);
  const summary = {
    totalProcessed: payload.rows.length,
    incomeImported: 0,
    expensesImported: 0,
    duplicatesSkipped: 0,
    unsupportedSkipped: 0,
    errorsCount: 0,
  };
  const results = [];

  for (const [index, row] of payload.rows.entries()) {
    const parsedRowNumber = Number(row?.rowNumber);
    const rowNumber =
      Number.isFinite(parsedRowNumber) && parsedRowNumber > 0
        ? parsedRowNumber
        : index + 1;
    const type = normalizeType(row?.type);

    if (type === "unknown") {
      summary.unsupportedSkipped += 1;
      results.push(
        buildSkippedResult(rowNumber, "Unsupported or unknown type")
      );
      continue;
    }

    if (!["income", "expense"].includes(type)) {
      summary.unsupportedSkipped += 1;
      results.push(
        buildSkippedResult(rowNumber, "Unsupported or unknown type")
      );
      continue;
    }

    const date = dateOnlyToUtcNoonDate(row?.date);
    const dateOnly = normalizeDateOnly(row?.date);
    const description = normalizeText(row?.description);
    const amount = normalizeAmount(row?.amount);

    if (!date || !dateOnly) {
      summary.errorsCount += 1;
      results.push(buildErrorResult(rowNumber, "Date is required and must be valid"));
      continue;
    }

    if (!description) {
      summary.errorsCount += 1;
      results.push(buildErrorResult(rowNumber, "Description is required"));
      continue;
    }

    if (!amount) {
      summary.errorsCount += 1;
      results.push(buildErrorResult(rowNumber, "Amount must be greater than 0"));
      continue;
    }

    const importHash = createImportHash({
      userId,
      date: dateOnly,
      type,
      amount,
      description,
    });

    if (!importHash) {
      summary.errorsCount += 1;
      results.push(buildErrorResult(rowNumber, "Unable to create import hash"));
      continue;
    }

    if (await hasDuplicateImportHash(userId, importHash)) {
      summary.duplicatesSkipped += 1;
      results.push({
        rowNumber,
        status: "duplicate_skipped",
        duplicateHash: importHash,
      });
      continue;
    }

    const metadata = buildMetadata({ fileName, importHash, row });

    try {
      if (type === "income") {
        const income = await Income.create({
          userId,
          amount,
          source: description,
          category: normalizeIncomeCategory(row.category),
          date,
          notes: "Imported from PDF bank statement.",
          ...metadata,
        });

        summary.incomeImported += 1;
        results.push({
          rowNumber,
          status: "imported",
          recordType: "income",
          recordId: income._id,
        });
        continue;
      }

      const expense = await Expense.create({
        userId,
        amount,
        recipient: description,
        category: normalizeExpenseCategory(row.category),
        date,
        notes: "Imported from PDF bank statement.",
        expenseType: "personal",
        deductible: false,
        deductiblePercent: 0,
        taxCategory: "",
        receiptUrl: "",
        ...metadata,
      });

      summary.expensesImported += 1;
      results.push({
        rowNumber,
        status: "imported",
        recordType: "expense",
        recordId: expense._id,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        summary.duplicatesSkipped += 1;
        results.push({
          rowNumber,
          status: "duplicate_skipped",
          duplicateHash: importHash,
        });
        continue;
      }

      summary.errorsCount += 1;
      results.push(buildErrorResult(rowNumber, error.message || "Import row failed"));
    }
  }

  return {
    message: "PDF rows processed.",
    summary,
    results,
  };
};
