import {
  getMonthlyBudgetSummary,
  updateMonthlyBudgetLimit,
} from "../services/budgetService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getUserId = (req) => req.user?.id || req.user?._id;

export const getBudget = asyncHandler(async (req, res) => {
  const budget = await getMonthlyBudgetSummary(getUserId(req));
  return res.status(200).json(budget);
});

export const updateBudget = asyncHandler(async (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "monthlySpendingLimit")) {
    return res.status(400).json({ message: "Monthly spending limit is required" });
  }

  const monthlySpendingLimit = Number(req.body.monthlySpendingLimit);

  if (!Number.isFinite(monthlySpendingLimit)) {
    return res.status(400).json({ message: "Monthly spending limit must be a number" });
  }

  if (monthlySpendingLimit < 0) {
    return res.status(400).json({
      message: "Monthly spending limit must be greater than or equal to 0",
    });
  }

  const budget = await updateMonthlyBudgetLimit(
    getUserId(req),
    monthlySpendingLimit
  );

  return res.status(200).json(budget);
});
