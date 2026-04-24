import { createSettlement } from "../services/settlementService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const respondWithError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Server Error" });

export const createGroupSettlement = asyncHandler(async (req, res) => {
  try {
    const result = await createSettlement(req.params.groupId, req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
});

export const createSettlementFromBody = asyncHandler(async (req, res) => {
  try {
    const result = await createSettlement(req.body?.groupId, req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
});
