import mongoose from "mongoose";
import Group from "../models/Group.js";
import { calculateGroupBalances } from "../services/balanceService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const getGroupBalance = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  if (!isValidObjectId(groupId)) {
    return res.status(400).json({ message: "Invalid group ID" });
  }

  const group = await Group.findOne({
    _id: groupId,
    members: req.user.id,
  }).lean();

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const balanceSummary = await calculateGroupBalances(groupId);

  return res.status(200).json(balanceSummary);
});
