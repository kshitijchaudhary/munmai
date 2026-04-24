import GroupMembership from "../models/GroupMembership.js";
import { getGroupBalances } from "./balanceService.js";

const roundMoney = (v) =>
  Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

export const getDashboardSummary = async (userId) => {
  // 1. get all groups where user is active
  const memberships = await GroupMembership.find({
    userId,
    status: "active",
  })
    .select("groupId")
    .lean();

  const groupIds = memberships.map((m) => m.groupId);

  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  // 2. aggregate balances across groups
  for (const groupId of groupIds) {
    const balances = await getGroupBalances(groupId);

    for (const b of balances) {
      if (String(b.from) === String(userId)) {
        totalYouOwe += Number(b.amount);
      }
      if (String(b.to) === String(userId)) {
        totalYouAreOwed += Number(b.amount);
      }
    }
  }

  totalYouOwe = roundMoney(totalYouOwe);
  totalYouAreOwed = roundMoney(totalYouAreOwed);

  return {
    totalYouOwe,
    totalYouAreOwed,
    netBalance: roundMoney(totalYouAreOwed - totalYouOwe),
  };
};