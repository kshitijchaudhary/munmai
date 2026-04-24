import mongoose from "mongoose";
import Group from "../models/Group.js";
import SharedExpense from "../models/SharedExpense.js";
import Settlement from "../models/Settlement.js";
import { getGroupBalances } from "./balanceService.js";
import { getActiveMemberIds } from "./groupMembershipService.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getAggregateSummary = async (Model, groupId) => {
  const [result] = await Model.aggregate([
    { $match: { group: groupId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: "$amount" },
      },
    },
  ]);

  return {
    count: result?.count || 0,
    total: roundMoney(result?.total || 0),
  };
};

export const getGroupSummary = async (groupId, currentUserId) => {
  if (!isValidObjectId(groupId)) {
    throw createError("Invalid group ID", 400);
  }

  const group = await Group.findById(groupId).select("_id name").lean();

  if (!group) {
    throw createError("Group not found", 404);
  }

  const activeMemberIds = await getActiveMemberIds(group._id);

  if (!activeMemberIds.has(String(currentUserId))) {
    throw createError("Only active group members can view group summary", 403);
  }

  const [expenseSummary, settlementSummary, balances] = await Promise.all([
    getAggregateSummary(SharedExpense, group._id),
    getAggregateSummary(Settlement, group._id),
    getGroupBalances(group._id),
  ]);

  const totalYouOwe = roundMoney(
    balances.reduce(
      (sum, balance) =>
        String(balance.from) === String(currentUserId) ? sum + Number(balance.amount || 0) : sum,
      0
    )
  );
  const totalYouAreOwed = roundMoney(
    balances.reduce(
      (sum, balance) =>
        String(balance.to) === String(currentUserId) ? sum + Number(balance.amount || 0) : sum,
      0
    )
  );

  return {
    group,
    summary: {
      expenseCount: expenseSummary.count,
      settlementCount: settlementSummary.count,
      totalExpenses: expenseSummary.total,
      totalSettlements: settlementSummary.total,
      totalYouOwe,
      totalYouAreOwed,
      netBalance: roundMoney(totalYouAreOwed - totalYouOwe),
    },
    balances,
  };
};

export default {
  getGroupSummary,
};
