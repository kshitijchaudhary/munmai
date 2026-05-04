import {
  createLiability,
  deleteLiability,
  getLiabilitySummary,
  listLiabilities,
  updateLiability,
} from "../services/liabilityService.js";

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

export const getLiabilities = asyncHandler(async (req, res) => {
  const liabilities = await listLiabilities(getUserId(req), {
    status: req.query.status,
    liabilityType: req.query.liabilityType,
  });

  return res.status(200).json(liabilities);
});

export const createUserLiability = asyncHandler(async (req, res) => {
  const liability = await createLiability(getUserId(req), req.body || {});
  return res.status(201).json({ liability });
});

export const updateUserLiability = asyncHandler(async (req, res) => {
  const liability = await updateLiability(
    getUserId(req),
    req.params.id,
    req.body || {}
  );

  return res.status(200).json({ liability });
});

export const deleteUserLiability = asyncHandler(async (req, res) => {
  const result = await deleteLiability(getUserId(req), req.params.id);
  return res.status(200).json(result);
});

export const getUserLiabilitySummary = asyncHandler(async (req, res) => {
  const summary = await getLiabilitySummary(getUserId(req));
  return res.status(200).json(summary);
});
