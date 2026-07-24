import {
  TRANSACTION_DATE_FUTURE_MESSAGE,
  getTransactionDateValidationError,
  normalizeTransactionDateValue,
} from "./transactionDateValidation.js";

const findHeader = (headers, keywords) => {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: header.toLowerCase(),
  }));

  const match = normalizedHeaders.find(({ normalized }) =>
    keywords.some((keyword) => normalized.includes(keyword))
  );

  return match?.original || "";
};

export const guessMappings = (headers) => ({
  date: findHeader(headers, [
    "transaction date",
    "posting date",
    "posted date",
    "date",
  ]),
  amount: findHeader(headers, ["amount", "value", "amt"]),
  description: findHeader(headers, [
    "description",
    "merchant",
    "payee",
    "details",
    "narration",
    "name",
  ]),
  category: findHeader(headers, ["category"]),
  type: findHeader(headers, ["type"]),
});

export const parseAmount = (value) => {
  const normalized = String(value ?? "")
    .trim()
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

export const inferTypeFromCell = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (
    ["expense", "debit", "withdrawal", "payment", "outflow", "purchase"].some(
      (keyword) => normalized.includes(keyword)
    )
  ) {
    return "expense";
  }

  if (
    ["income", "credit", "deposit", "refund", "inflow"].some((keyword) =>
      normalized.includes(keyword)
    )
  ) {
    return "income";
  }

  return "";
};

export const validateReviewRow = (
  row,
  { now = new Date() } = {},
) => {
  const issues = [];
  const amount = parseAmount(row.amount);
  const dateError = getTransactionDateValidationError(row.date, {
    allowFlexibleFormat: true,
    now,
  });

  if (!["income", "expense"].includes(row.type)) {
    issues.push("Type");
  }

  if (!String(row.title || "").trim()) {
    issues.push("Description");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push("Amount");
  }

  if (dateError) {
    issues.push(
      dateError === TRANSACTION_DATE_FUTURE_MESSAGE ? dateError : "Date"
    );
  }

  return issues;
};

const resolveImportType = ({ importMode, amount, typeCell }) => {
  if (importMode === "expenses_only") {
    return "expense";
  }

  if (importMode === "income_only") {
    return "income";
  }

  if (importMode === "type_column") {
    return inferTypeFromCell(typeCell);
  }

  return amount < 0 ? "expense" : "income";
};

export const buildReviewRows = ({ rows, mappings, importMode }) =>
  rows.map((row, index) => {
    const amount = parseAmount(row[mappings.amount]);
    const nextRow = {
      id: `review-row-${index}`,
      rowNumber: index + 2,
      selected: true,
      type: resolveImportType({
        importMode,
        amount,
        typeCell: row[mappings.type],
      }),
      date:
        normalizeTransactionDateValue(row[mappings.date]) ||
        row[mappings.date] ||
        "",
      title: row[mappings.description] || "",
      amount: Number.isFinite(amount) ? String(Math.abs(amount)) : row[mappings.amount] || "",
      category: mappings.category ? row[mappings.category] || "" : "",
      issues: [],
    };

    nextRow.issues = validateReviewRow(nextRow);
    nextRow.selected = nextRow.issues.length === 0;

    return nextRow;
  });
