const MAX_PARSED_ROWS = 100;
const MONEY_PATTERN = "-?\\$?\\(?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})\\)?|-?\\$?\\(?\\d+(?:\\.\\d{2})\\)?";
const DATE_PATTERN = "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4})";
const DATE_ANCHORED_PATTERN = new RegExp(
  `${DATE_PATTERN}\\s+(.+?)\\s+(${MONEY_PATTERN})(?:\\s+(${MONEY_PATTERN}))?\\s*$`
);

const incomeKeywords = [
  "payroll",
  "salary",
  "paycheque",
  "paycheck",
  "direct deposit",
  "deposit",
  "refund",
  "interest",
];

const expenseKeywords = [
  "payment",
  "purchase",
  "withdrawal",
  "debit",
  "fee",
  "charge",
  "rogers",
  "tim hortons",
  "uber",
  "amazon",
];

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const parseMoney = (value) => {
  const normalized = normalizeText(value)
    .replace(/\$/g, "")
    .replace(/,/g, "");

  if (!normalized) return NaN;

  if (/^\(.*\)$/.test(normalized)) {
    return -Number(normalized.slice(1, -1));
  }

  return Number(normalized);
};

const normalizeDate = (value) => {
  const rawDate = normalizeText(value);
  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) return rawDate;

  const slashMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!slashMatch) return rawDate;

  const month = slashMatch[1].padStart(2, "0");
  const day = slashMatch[2].padStart(2, "0");
  return `${slashMatch[3]}-${month}-${day}`;
};

const getKeywordType = (description) => {
  const normalizedDescription = normalizeText(description).toLowerCase();

  if (incomeKeywords.some((keyword) => normalizedDescription.includes(keyword))) {
    return "income";
  }

  if (expenseKeywords.some((keyword) => normalizedDescription.includes(keyword))) {
    return "expense";
  }

  return "unknown";
};

const getTypeFromBalanceMovement = ({ amount, balance, previousBalance }) => {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(balance) ||
    !Number.isFinite(previousBalance)
  ) {
    return null;
  }

  const tolerance = 0.02;
  const incomeDelta = Math.abs(balance - previousBalance - amount);
  const expenseDelta = Math.abs(previousBalance - balance - amount);

  if (incomeDelta <= tolerance) {
    return "income";
  }

  if (expenseDelta <= tolerance) {
    return "expense";
  }

  return null;
};

const getConfidence = ({ typeFromBalance, keywordType, hasBalance }) => {
  if (typeFromBalance) return "high";
  if (keywordType !== "unknown" && hasBalance) return "medium";
  if (keywordType !== "unknown") return "low";
  return "low";
};

const splitCandidateLines = (text) => {
  const source = String(text || "").replace(/\r/g, "\n");
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines;
  }

  return source
    .split(new RegExp(`(?=${DATE_PATTERN}\\s+)`, "g"))
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseCandidateLine = ({ line, rowNumber, previousBalance }) => {
  const match = line.match(DATE_ANCHORED_PATTERN);

  if (!match) {
    return null;
  }

  const [, rawDate, rawDescription, rawAmount, rawBalance] = match;
  const amount = parseMoney(rawAmount);
  const balance = parseMoney(rawBalance);
  const description = normalizeText(rawDescription);

  if (!description || !Number.isFinite(amount) || amount === 0) {
    return null;
  }

  const absoluteAmount = Math.abs(amount);
  const hasBalance = Number.isFinite(balance);
  const typeFromBalance = getTypeFromBalanceMovement({
    amount: absoluteAmount,
    balance,
    previousBalance,
  });
  const keywordType = getKeywordType(description);
  let type = typeFromBalance || keywordType;

  if (amount < 0) {
    type = "expense";
  }

  if (amount > 0 && !typeFromBalance && keywordType === "unknown" && !hasBalance) {
    type = "unknown";
  }

  return {
    parsedRow: {
      rowNumber,
      date: normalizeDate(rawDate),
      description,
      amount: absoluteAmount,
      type,
      confidence: getConfidence({ typeFromBalance, keywordType, hasBalance }),
      rawText: line,
    },
    balance: hasBalance ? balance : previousBalance,
  };
};

export const parsePdfTransactionPreviewRows = (text, options = {}) => {
  const limit = Number(options.limit || MAX_PARSED_ROWS);
  const parsedRows = [];
  let previousBalance = null;

  for (const line of splitCandidateLines(text)) {
    if (parsedRows.length >= limit) break;

    const result = parseCandidateLine({
      line,
      rowNumber: parsedRows.length + 1,
      previousBalance,
    });

    if (!result) continue;

    parsedRows.push(result.parsedRow);
    previousBalance = result.balance;
  }

  const parserSummary = {
    totalParsedRows: parsedRows.length,
    highConfidenceRows: parsedRows.filter((row) => row.confidence === "high").length,
    mediumConfidenceRows: parsedRows.filter((row) => row.confidence === "medium").length,
    lowConfidenceRows: parsedRows.filter((row) => row.confidence === "low").length,
    unknownTypeRows: parsedRows.filter((row) => row.type === "unknown").length,
  };

  return {
    parsedRows,
    parserSummary,
  };
};
