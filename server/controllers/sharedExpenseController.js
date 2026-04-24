import { createSharedExpense as createSharedExpenseService } from "../services/sharedExpenseService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const respondWithError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Server Error" });

export const createSharedExpense = asyncHandler(async (req, res) => {
  try {
    const result = await createSharedExpenseService(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
});
