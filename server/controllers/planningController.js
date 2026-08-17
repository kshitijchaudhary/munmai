import {
  getPlanning,
  upsertPlanning,
} from "../services/planningService.js";

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

export const getUserPlanning = asyncHandler(async (req, res) => {
  const planning = await getPlanning(getUserId(req));
  return res.status(200).json({ planning });
});

export const updateUserPlanning = asyncHandler(async (req, res) => {
  const planning = await upsertPlanning(getUserId(req), req.body || {});
  return res.status(200).json({ planning });
});
