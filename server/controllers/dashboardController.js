import mongoose from "mongoose";
import Income from "../models/Income.js";
import Expense from "../models/Expense.js";
import { getDashboardSummary as getDashboardSharedMoneySummary } from "../services/dashboardService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getUserId = (req) => req.user?.id || req.user?._id;

const getAggregateUserId = (req) => {
  const userId = String(getUserId(req) || "");

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return userId;
  }

  return new mongoose.Types.ObjectId(userId);
};

const parseTaxYear = (value) => {
  const currentYear = new Date().getFullYear();
  const parsedYear = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > currentYear + 1) {
    return currentYear;
  }

  return parsedYear;
};

const getYearRange = (year) => ({
  startDate: new Date(Date.UTC(year, 0, 1)),
  endDate: new Date(Date.UTC(year + 1, 0, 1)),
});

const hasReceipt = (expense) => Boolean(String(expense.receiptUrl || "").trim());

const hasTaxCategory = (expense) => Boolean(String(expense.taxCategory || "").trim());

const hasValidDeductiblePercent = (expense) => {
  const deductiblePercent = Number(expense.deductiblePercent);
  return Number.isFinite(deductiblePercent) && deductiblePercent > 0 && deductiblePercent <= 100;
};

const isExportReadyExpense = (expense) =>
  expense.deductible &&
  hasReceipt(expense) &&
  hasTaxCategory(expense) &&
  hasValidDeductiblePercent(expense);

const needsReviewExpense = (expense) =>
  expense.deductible &&
  (!hasReceipt(expense) || !hasTaxCategory(expense) || !hasValidDeductiblePercent(expense));

const getDeductibleAmount = (expense) => {
  if (!expense.deductible || !hasValidDeductiblePercent(expense)) {
    return 0;
  }

  return Number(expense.amount || 0) * (Number(expense.deductiblePercent) / 100);
};

const createEmptyImportSourceSummary = () => ({
  income: {
    manual: 0,
    csv: 0,
    pdf: 0,
  },
  expenses: {
    manual: 0,
    csv: 0,
    pdf: 0,
  },
  totals: {
    manual: 0,
    csv: 0,
    pdf: 0,
  },
});

const getImportSourceBucket = (importSource) => {
  const normalizedSource = String(importSource || "").trim().toLowerCase();
  return normalizedSource === "csv" || normalizedSource === "pdf"
    ? normalizedSource
    : "manual";
};

const buildTaxPackImportSourceSummary = (expenses) => {
  const importSourceSummary = createEmptyImportSourceSummary();

  expenses.forEach((expense) => {
    const source = getImportSourceBucket(expense.importSource);
    importSourceSummary.expenses[source] += 1;
    importSourceSummary.totals[source] += 1;
  });

  return importSourceSummary;
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue.replace(/"/g, '""');
  return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
};

const getReceiptExportValue = (expense) => {
  const receiptUrl = String(expense.receiptUrl || "").trim();
  const serverUrl = String(process.env.SERVER_URL || "").trim().replace(/\/+$/, "");

  if (!receiptUrl) {
    return "";
  }

  if (!serverUrl) {
    return receiptUrl;
  }

  try {
    return new URL(receiptUrl, `${serverUrl}/`).toString();
  } catch (error) {
    return receiptUrl;
  }
};

const buildTaxPackSummary = ({ expenses, taxYear }) => {
  const deductibleExpenses = expenses.filter((expense) => expense.deductible);
  const trackedBusinessExpenseTotal = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );
  const deductibleExpenseTotal = deductibleExpenses.reduce(
    (sum, expense) => sum + getDeductibleAmount(expense),
    0
  );
  const missingReceiptCount = deductibleExpenses.filter((expense) => !hasReceipt(expense)).length;
  const needsReviewCount = deductibleExpenses.filter(needsReviewExpense).length;
  const exportReadyCount = deductibleExpenses.filter(isExportReadyExpense).length;
  const deductibleReceiptCount = deductibleExpenses.filter((expense) => hasReceipt(expense)).length;
  const deductibleByCategoryMap = deductibleExpenses.reduce((accumulator, expense) => {
    if (!hasTaxCategory(expense)) {
      return accumulator;
    }

    const category = String(expense.taxCategory).trim();
    accumulator[category] = (accumulator[category] || 0) + getDeductibleAmount(expense);
    return accumulator;
  }, {});

  const deductibleByCategory = Object.entries(deductibleByCategoryMap)
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    taxYear,
    summary: {
      trackedExpenseCount: expenses.length,
      trackedBusinessExpenseTotal: Number(trackedBusinessExpenseTotal.toFixed(2)),
      deductibleTransactionCount: deductibleExpenses.length,
      deductibleExpenseTotal: Number(deductibleExpenseTotal.toFixed(2)),
      missingReceiptCount,
      needsReviewCount,
      exportReadyCount,
      receiptCoveragePercent:
        deductibleExpenses.length > 0
          ? Number(((deductibleReceiptCount / deductibleExpenses.length) * 100).toFixed(2))
          : 0,
      deductibleByCategory,
      importSourceSummary: buildTaxPackImportSourceSummary(expenses),
    },
    records: [],
  };
};

const buildTaxPackCsv = (expenses) => {
  const headers = [
    "Date",
    "Vendor",
    "Category",
    "Tax Category",
    "Amount",
    "Deductible %",
    "Deductible Amount",
    "Receipt",
  ];

  const rows = expenses.map((expense) => [
    expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "",
    expense.recipient || "",
    expense.category || "",
    expense.taxCategory || "",
    Number(expense.amount || 0).toFixed(2),
    hasValidDeductiblePercent(expense) ? Number(expense.deductiblePercent).toFixed(2) : "",
    getDeductibleAmount(expense).toFixed(2),
    getReceiptExportValue(expense),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
};

const getTaxPackExpenses = async (req, year) => {
  const taxYear = parseTaxYear(year);
  const { startDate, endDate } = getYearRange(taxYear);

  const expenses = await Expense.find({
    userId: getUserId(req),
    expenseType: { $ne: "personal" },
    date: { $gte: startDate, $lt: endDate },
  })
    .sort({ date: -1 })
    .lean();

  return { expenses, taxYear };
};

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const aggregateUserId = getAggregateUserId(req);

  const incomeTotalResult = await Income.aggregate([
    { $match: { userId: aggregateUserId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const expenseTotalResult = await Expense.aggregate([
    { $match: { userId: aggregateUserId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const categoryBreakdown = await Expense.aggregate([
    { $match: { userId: aggregateUserId } },
    {
      $group: {
        _id: "$category",
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  const incomeTotal = incomeTotalResult[0]?.total || 0;
  const expenseTotal = expenseTotalResult[0]?.total || 0;
  const sharedMoney = await getDashboardSharedMoneySummary(userId);

  res.json({
    incomeTotal,
    expenseTotal,
    balance: incomeTotal - expenseTotal,
    categoryBreakdown: categoryBreakdown.map((item) => ({
      category: item._id,
      amount: item.amount,
    })),
    sharedMoney,
  });
});

export const getTaxPackSummary = asyncHandler(async (req, res) => {
  const { expenses, taxYear } = await getTaxPackExpenses(req, req.query.year);
  res.status(200).json(buildTaxPackSummary({ expenses, taxYear }));
});

export const exportTaxPackCsv = asyncHandler(async (req, res) => {
  const { expenses, taxYear } = await getTaxPackExpenses(req, req.query.year);
  const deductibleExpenses = expenses.filter((expense) => expense.deductible);
  const csv = buildTaxPackCsv(deductibleExpenses);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="tax-pack-${taxYear}.csv"`
  );

  res.status(200).send(csv);
});
