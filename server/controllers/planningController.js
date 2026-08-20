import {
  getPlanning,
  getSavedPlanning,
  upsertPlanning,
} from "../services/planningService.js";
import { prepareNextPlanningCycle } from "../services/planningRecurrenceService.js";
import { getSafeToSpendForUser } from "../services/safeToSpendService.js";

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

export const prepareUserNextPlanningCycle = asyncHandler(async (req, res) => {
  const planning = await getSavedPlanning(getUserId(req));

  if (!planning) {
    const error = new Error(
      "No current planning cycle is available to prepare.",
    );
    error.statusCode = 409;
    throw error;
  }

  const preview = prepareNextPlanningCycle(planning, {
    nextPayday: req.body?.nextPayday,
  });

  return res.status(200).json(preview);
});

export const getUserSafeToSpend = asyncHandler(async (req, res) => {
  const result = await getSafeToSpendForUser(getUserId(req));
  return res.status(200).json(result);
});
