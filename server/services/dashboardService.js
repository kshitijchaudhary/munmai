import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import { getUserGroupBalanceSummaries } from "./balanceService.js";

const roundMoney = (v) =>
  Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

export const getDashboardSummary = async (userId) => {
  const memberships = await GroupMembership.find({
    userId,
    status: "active",
  })
    .select("groupId")
    .lean();

  const groupIds = [
    ...new Set(memberships.map((membership) => String(membership.groupId))),
  ];

  if (groupIds.length === 0) {
    return {
      totalYouOwe: 0,
      totalYouAreOwed: 0,
      netBalance: 0,
      spaces: [],
    };
  }

  const [groups, balanceSummaries] = await Promise.all([
    Group.find({ _id: { $in: groupIds } }).select("_id name").lean(),
    getUserGroupBalanceSummaries(groupIds, userId),
  ]);
  const groupNames = new Map(
    groups.map((group) => [String(group._id), String(group.name || "").trim()])
  );
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  const spaces = balanceSummaries.flatMap((summary) => {
    totalYouOwe += summary.totalYouOwe;
    totalYouAreOwed += summary.totalYouAreOwed;

    const name = groupNames.get(summary.groupId);

    if (
      !name ||
      (summary.totalYouOwe <= 0 && summary.totalYouAreOwed <= 0)
    ) {
      return [];
    }

    return [{ ...summary, name }];
  });

  totalYouOwe = roundMoney(totalYouOwe);
  totalYouAreOwed = roundMoney(totalYouAreOwed);

  return {
    totalYouOwe,
    totalYouAreOwed,
    netBalance: roundMoney(totalYouAreOwed - totalYouOwe),
    spaces,
  };
};
