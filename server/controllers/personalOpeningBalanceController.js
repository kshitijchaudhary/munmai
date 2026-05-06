import {
  getPersonalOpeningBalance,
  upsertPersonalOpeningBalance,
} from "../services/personalOpeningBalanceService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    next(error);
  }
};

const getUserId = (req) => req.user?.id || req.user?._id;

export const getOpeningBalance = asyncHandler(async (req, res) => {
  const openingBalance = await getPersonalOpeningBalance(getUserId(req));
  return res.status(200).json({ openingBalance });
});

export const updateOpeningBalance = asyncHandler(async (req, res) => {
  const openingBalance = await upsertPersonalOpeningBalance(
    getUserId(req),
    req.body || {}
  );

  return res.status(200).json({ openingBalance });
});
