import mongoose from "mongoose";
import BudgetSetting from "../models/BudgetSetting.js";
import Expense from "../models/Expense.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const getCurrentMonthRange = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return {
    month,
    year,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 1),
  };
};

const getAggregateUserId = (userId) => {
  const normalizedUserId = String(userId || "");

  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return normalizedUserId;
  }

  return new mongoose.Types.ObjectId(normalizedUserId);
};

const getBudgetStatus = (monthlySpendingLimit, percentUsed) => {
  if (!monthlySpendingLimit || monthlySpendingLimit <= 0) {
    return "no_budget";
  }

  if (percentUsed < 70) {
    return "safe";
  }

  if (percentUsed <= 100) {
    return "warning";
  }

  return "over";
};

export const getMonthlyBudgetSummary = async (userId) => {
  const { month, year, startDate, endDate } = getCurrentMonthRange();
  const aggregateUserId = getAggregateUserId(userId);

  const [setting, spendingResult, categoryResult] = await Promise.all([
    BudgetSetting.findOne({ user: userId }).lean(),
    Expense.aggregate([
      {
        $match: {
          userId: aggregateUserId,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          userId: aggregateUserId,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const monthlySpendingLimit = roundMoney(setting?.monthlySpendingLimit || 0);
  const spentThisMonth = roundMoney(spendingResult[0]?.total || 0);
  const remaining = roundMoney(monthlySpendingLimit - spentThisMonth);
  const percentUsed =
    monthlySpendingLimit > 0
      ? roundMoney((spentThisMonth / monthlySpendingLimit) * 100)
      : 0;

  return {
    monthlySpendingLimit,
    month,
    year,
    spentThisMonth,
    remaining,
    percentUsed,
    status: getBudgetStatus(monthlySpendingLimit, percentUsed),
    topCategory: categoryResult[0]?._id || null,
  };
};

export const updateMonthlyBudgetLimit = async (userId, monthlySpendingLimit) => {
  const normalizedLimit = Number(monthlySpendingLimit);

  if (!Number.isFinite(normalizedLimit)) {
    const error = new Error("Monthly spending limit must be a number");
    error.statusCode = 400;
    throw error;
  }

  if (normalizedLimit < 0) {
    const error = new Error("Monthly spending limit must be greater than or equal to 0");
    error.statusCode = 400;
    throw error;
  }

  await BudgetSetting.findOneAndUpdate(
    { user: userId },
    { $set: { monthlySpendingLimit: roundMoney(normalizedLimit) } },
    { new: true, upsert: true, runValidators: true }
  );

  return getMonthlyBudgetSummary(userId);
};
