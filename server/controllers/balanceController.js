import mongoose from "mongoose";
import Group from "../models/Group.js";
import { isActiveGroupMember } from "../services/groupMembershipService.js";
import { getGroupBalances } from "../services/balanceService.js";

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

  const group = await Group.findById(groupId).select("_id").lean();

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const isMember = await isActiveGroupMember(groupId, req.user.id);

  if (!isMember) {
    return res.status(403).json({ message: "Only active group members can view balances" });
  }

  const balances = await getGroupBalances(groupId);

  return res.status(200).json(balances);
});
