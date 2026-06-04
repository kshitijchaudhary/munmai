import Expense from "../../models/Expense.js";
import Income from "../../models/Income.js";
import ImportBatch from "../../models/ImportBatch.js";
import ImportRow from "../../models/ImportRow.js";
import ImportedRecordFingerprint from "../../models/ImportedRecordFingerprint.js";
import {
  createImportHash,
  dateOnlyToUtcNoonDate,
  normalizeDateOnly,
} from "./importDeduplication.js";

const MAX_PDF_CONFIRM_ROWS = 100;
const MAX_STORED_RAW_TEXT_LENGTH = 1000;

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

const truncateRawText = (value) =>
  normalizeText(value).slice(0, MAX_STORED_RAW_TEXT_LENGTH);

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
  originalRawText: truncateRawText(row.rawText),
  sourceRowNumber: Number(row.rowNumber || 0),
});

const isDuplicateKeyError = (error) => error?.code === 11000;

const findDuplicateImport = async (userId, importHash) => {
  const fingerprint = await ImportedRecordFingerprint.findOne({
    user: userId,
    importHash,
    status: { $ne: "reverted" },
  })
    .select("_id importHash recordType recordId recordModel status")
    .lean();

  if (fingerprint) {
    return { source: "fingerprint", fingerprint };
  }

  const [incomeDuplicate, expenseDuplicate] = await Promise.all([
    Income.findOne({ userId, importHash }).select("_id").lean(),
    Expense.findOne({ userId, importHash }).select("_id").lean(),
  ]);

  if (incomeDuplicate) {
    return {
      source: "legacy",
      recordType: "income",
      recordModel: "Income",
      recordId: incomeDuplicate._id,
    };
  }

  if (expenseDuplicate) {
    return {
      source: "legacy",
      recordType: "expense",
      recordModel: "Expense",
      recordId: expenseDuplicate._id,
    };
  }

  return null;
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

const getRowNumber = (row, index) => {
  const parsedRowNumber = Number(row?.rowNumber);
  return Number.isFinite(parsedRowNumber) && parsedRowNumber > 0
    ? parsedRowNumber
    : index + 1;
};

const getHistoryDirection = (type) => (type === "income" ? "inflow" : "outflow");

const getHistoryClassification = (type) =>
  ["income", "expense"].includes(type) ? type : "unclassified";

const getHistoryAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0;
};

const buildHistoryRowBase = ({
  userId,
  importBatchId,
  row,
  rowNumber,
  type,
  date,
  amount,
  importHash = "",
}) => ({
  user: userId,
  importBatch: importBatchId,
  rawDate: normalizeText(row?.date),
  rawDescription: normalizeText(row?.description),
  rawAmount: normalizeText(row?.amount),
  parsedDate: date || null,
  description: normalizeText(row?.description),
  amount: amount || getHistoryAmount(row?.amount),
  direction: getHistoryDirection(type),
  suggestedClassification: getHistoryClassification(type),
  classification: getHistoryClassification(type),
  category: normalizeText(row?.category),
  importHash,
  sourceRowNumber: rowNumber,
  originalRawText: truncateRawText(row?.rawText),
});

const createHistoryRow = async (payload) => ImportRow.create(payload);

const syncBatchAfterPdfConfirm = async ({ batch, summary, dateValues }) => {
  const sortedDates = dateValues
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const importedRows = summary.incomeImported + summary.expensesImported;

  batch.status = "imported";
  batch.reviewedRows = summary.totalProcessed;
  batch.importedRows = importedRows;
  batch.committedAt = new Date();
  batch.summary = summary;

  if (sortedDates.length > 0) {
    batch.dateRangeStart = sortedDates[0];
    batch.dateRangeEnd = sortedDates[sortedDates.length - 1];
  }

  await batch.save();
};

const createLegacyFingerprintIfNeeded = async ({
  userId,
  duplicate,
  importHash,
  fileName,
  row,
  rowNumber,
  type,
  date,
  amount,
  category,
  importBatchId,
}) => {
  if (!duplicate || duplicate.source !== "legacy") {
    return duplicate?.fingerprint || null;
  }

  try {
    return await ImportedRecordFingerprint.create({
      user: userId,
      importHash,
      importSource: "pdf",
      importFileName: fileName,
      importBatch: importBatchId,
      recordType: duplicate.recordType,
      recordId: duplicate.recordId,
      recordModel: duplicate.recordModel,
      date,
      amount,
      description: normalizeText(row?.description),
      category,
      sourceRowNumber: rowNumber,
      originalRawText: truncateRawText(row?.rawText),
      status: "imported",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return ImportedRecordFingerprint.findOne({ user: userId, importHash })
        .select("_id importHash recordType recordId recordModel status")
        .lean();
    }

    throw error;
  }
};

const createImportedFingerprint = async ({
  userId,
  importHash,
  fileName,
  row,
  rowNumber,
  type,
  record,
  date,
  amount,
  category,
  importBatchId,
}) => {
  const fingerprintPayload = {
    user: userId,
    importHash,
    importSource: "pdf",
    importFileName: fileName,
    importBatch: importBatchId,
    recordType: type,
    recordId: record._id,
    recordModel: type === "income" ? "Income" : "Expense",
    date,
    amount,
    description: normalizeText(row?.description),
    category,
    sourceRowNumber: rowNumber,
    originalRawText: truncateRawText(row?.rawText),
    status: "imported",
    errorMessage: "",
  };

  const reactivatedFingerprint =
    await ImportedRecordFingerprint.findOneAndUpdate(
      { user: userId, importHash, status: "reverted" },
      { $set: fingerprintPayload },
      { new: true, runValidators: true }
    );

  if (reactivatedFingerprint) {
    return reactivatedFingerprint;
  }

  return ImportedRecordFingerprint.create(fingerprintPayload);
};

export const confirmPdfImportRows = async (userId, payload = {}) => {
  validateConfirmPayload(userId, payload);

  const fileName = normalizeText(payload.fileName);
  const batch = await ImportBatch.create({
    user: userId,
    originalFilename: fileName,
    importSource: "pdf",
    status: "pending_review",
    totalRows: payload.rows.length,
    reviewedRows: 0,
    importedRows: 0,
  });
  const summary = {
    totalProcessed: payload.rows.length,
    incomeImported: 0,
    expensesImported: 0,
    duplicatesSkipped: 0,
    unsupportedSkipped: 0,
    errorsCount: 0,
  };
  const results = [];
  const processedDates = [];

  for (const [index, row] of payload.rows.entries()) {
    const rowNumber = getRowNumber(row, index);
    const type = normalizeType(row?.type);

    if (type === "unknown") {
      summary.unsupportedSkipped += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date: null,
          amount: getHistoryAmount(row?.amount),
        }),
        status: "ignored",
        errorMessage: "Unsupported or unknown type",
      });
      results.push(
        buildSkippedResult(rowNumber, "Unsupported or unknown type")
      );
      continue;
    }

    if (!["income", "expense"].includes(type)) {
      summary.unsupportedSkipped += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date: null,
          amount: getHistoryAmount(row?.amount),
        }),
        status: "ignored",
        errorMessage: "Unsupported or unknown type",
      });
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
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date: null,
          amount: getHistoryAmount(row?.amount),
        }),
        status: "error",
        errorMessage: "Date is required and must be valid",
      });
      results.push(buildErrorResult(rowNumber, "Date is required and must be valid"));
      continue;
    }

    if (!description) {
      summary.errorsCount += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount: getHistoryAmount(row?.amount),
        }),
        status: "error",
        errorMessage: "Description is required",
      });
      results.push(buildErrorResult(rowNumber, "Description is required"));
      continue;
    }

    if (!amount) {
      summary.errorsCount += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount: getHistoryAmount(row?.amount),
        }),
        status: "error",
        errorMessage: "Amount must be greater than 0",
      });
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
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount,
        }),
        status: "error",
        errorMessage: "Unable to create import hash",
      });
      results.push(buildErrorResult(rowNumber, "Unable to create import hash"));
      continue;
    }

    const duplicate = await findDuplicateImport(userId, importHash);

    if (duplicate) {
      const duplicateFingerprint = await createLegacyFingerprintIfNeeded({
        userId,
        duplicate,
        importHash,
        fileName,
        row,
        rowNumber,
        type,
        date,
        amount,
        category:
          type === "income"
            ? normalizeIncomeCategory(row.category)
            : normalizeExpenseCategory(row.category),
        importBatchId: batch._id,
      });

      summary.duplicatesSkipped += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount,
          importHash,
        }),
        status: "duplicate_skipped",
        duplicateOfFingerprint:
          duplicate.source === "fingerprint"
            ? duplicate.fingerprint?._id
            : duplicateFingerprint?._id || null,
        errorMessage: "Duplicate import row skipped",
      });
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
        const category = normalizeIncomeCategory(row.category);
        const income = await Income.create({
          userId,
          amount,
          source: description,
          category,
          date,
          notes: "Imported from PDF bank statement.",
          ...metadata,
        });

        await createImportedFingerprint({
          userId,
          importHash,
          fileName,
          row,
          rowNumber,
          type,
          record: income,
          date,
          amount,
          category,
          importBatchId: batch._id,
        });

        await createHistoryRow({
          ...buildHistoryRowBase({
            userId,
            importBatchId: batch._id,
            row,
            rowNumber,
            type,
            date,
            amount,
            importHash,
          }),
          category,
          status: "imported",
          importedRecordType: "income",
          importedRecordId: income._id,
        });

        summary.incomeImported += 1;
        processedDates.push(date);
        results.push({
          rowNumber,
          status: "imported",
          recordType: "income",
          recordId: income._id,
        });
        continue;
      }

      const category = normalizeExpenseCategory(row.category);
      const expense = await Expense.create({
        userId,
        amount,
        recipient: description,
        category,
        date,
        notes: "Imported from PDF bank statement.",
        expenseType: "personal",
        deductible: false,
        deductiblePercent: 0,
        taxCategory: "",
        receiptUrl: "",
        ...metadata,
      });

      await createImportedFingerprint({
        userId,
        importHash,
        fileName,
        row,
        rowNumber,
        type,
        record: expense,
        date,
        amount,
        category,
        importBatchId: batch._id,
      });

      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount,
          importHash,
        }),
        category,
        status: "imported",
        importedRecordType: "expense",
        importedRecordId: expense._id,
      });

      summary.expensesImported += 1;
      processedDates.push(date);
      results.push({
        rowNumber,
        status: "imported",
        recordType: "expense",
        recordId: expense._id,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        summary.duplicatesSkipped += 1;
        const existingFingerprint = await ImportedRecordFingerprint.findOne({
          user: userId,
          importHash,
        })
          .select("_id")
          .lean();

        await createHistoryRow({
          ...buildHistoryRowBase({
            userId,
            importBatchId: batch._id,
            row,
            rowNumber,
            type,
            date,
            amount,
            importHash,
          }),
          status: "duplicate_skipped",
          duplicateOfFingerprint: existingFingerprint?._id || null,
          errorMessage: "Duplicate import row skipped",
        });
        results.push({
          rowNumber,
          status: "duplicate_skipped",
          duplicateHash: importHash,
        });
        continue;
      }

      summary.errorsCount += 1;
      await createHistoryRow({
        ...buildHistoryRowBase({
          userId,
          importBatchId: batch._id,
          row,
          rowNumber,
          type,
          date,
          amount,
          importHash,
        }),
        status: "error",
        errorMessage: error.message || "Import row failed",
      });
      results.push(buildErrorResult(rowNumber, error.message || "Import row failed"));
    }
  }

  await syncBatchAfterPdfConfirm({
    batch,
    summary,
    dateValues: processedDates,
  });

  return {
    message: "PDF rows processed.",
    batchId: batch._id,
    importBatchId: batch._id,
    summary,
    results,
  };
};
