import Income from "../models/Income.js";
import Expense from "../models/Expense.js";
import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import Settlement from "../models/Settlement.js";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";

const toIdString = (value) => String(value || "");

const getActiveSpaceIds = async (userId) => {
  const memberships = await GroupMembership.find({
    userId,
    status: "active",
  })
    .select("groupId")
    .lean();

  return memberships.map((m) => toIdString(m.groupId));
};

const buildPersonalIncomeEvents = (records) =>
  records.map((record) => ({
    id: `income:${record._id}`,
    sourceId: toIdString(record._id),
    type: "income",
    title: record.source,
    amount: record.amount,
    occurredAt: record.date instanceof Date ? record.date.toISOString() : record.date,
    category: record.category,
    notes: record.notes || undefined,
    destination: `/transactions/income/${record._id}`,
  }));

const buildPersonalExpenseEvents = (records) =>
  records.map((record) => ({
    id: `expense:${record._id}`,
    sourceId: toIdString(record._id),
    type: "expense",
    title: record.recipient,
    amount: record.amount,
    occurredAt: record.date instanceof Date ? record.date.toISOString() : record.date,
    category: record.category,
    notes: record.notes || undefined,
    destination: `/transactions/expense/${record._id}`,
  }));

const buildSharedExpenseEvents = (expenses, splitsByExpenseId, groupsById, userId) =>
  expenses.map((expense) => {
    const expenseId = toIdString(expense._id);
    const groupId = toIdString(expense.group);
    const group = groupsById.get(groupId);
    const expenseSplits = splitsByExpenseId.get(expenseId) || [];
    const userIdStr = toIdString(userId);
    const payerId = toIdString(expense.paidBy?._id || expense.paidBy);
    const payerName = expense.paidBy?.name || "";
    let userShare;

    const splits = expenseSplits.map((split) => {
      const splitUserId = toIdString(split.user?._id || split.user);
      const splitUserName = split.user?.name || "Member";
      const isCurrentUser = splitUserId === userIdStr;
      const isPayer = splitUserId === payerId;

      if (isCurrentUser) {
        userShare = split.amount;
      }

      return {
        userId: splitUserId,
        userName: splitUserName,
        amount: split.amount,
        isCurrentUser,
        isPayer,
      };
    });

    return {
      id: `shared-expense:${expenseId}`,
      sourceId: expenseId,
      type: "shared-expense",
      title: expense.description || "Shared expense",
      amount: expense.amount,
      occurredAt: new Date(expense.createdAt).toISOString(),
      spaceId: groupId,
      spaceName: group?.name || "",
      paidBy: { id: payerId, name: payerName },
      userShare,
      splits,
      destination: `/groups/${groupId}`,
    };
  });

const buildSettlementEvents = (settlements, groupsById) =>
  settlements.map((settlement) => {
    const groupId = toIdString(settlement.group);
    const group = groupsById.get(groupId);

    return {
      id: `settlement:${settlement._id}`,
      sourceId: toIdString(settlement._id),
      type: "settlement",
      title: `${settlement.from?.name || ""} paid ${settlement.to?.name || ""}`,
      amount: settlement.amount,
      occurredAt: new Date(settlement.createdAt).toISOString(),
      spaceId: groupId,
      spaceName: group?.name || "",
      from: { id: toIdString(settlement.from?._id || settlement.from), name: settlement.from?.name || "" },
      to: { id: toIdString(settlement.to?._id || settlement.to), name: settlement.to?.name || "" },
      note: settlement.note || undefined,
      destination: `/groups/${groupId}`,
    };
  });

const compareByDateDescThenIdAsc = (a, b) => {
  const dateDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
};

export const getActivityFeed = async (userId) => {
  const [income, expenses, activeGroupIds] = await Promise.all([
    Income.find({ userId }).sort({ date: -1 }).lean(),
    Expense.find({ userId }).sort({ date: -1 }).lean(),
    getActiveSpaceIds(userId),
  ]);

  let sharedExpenses = [];
  let settlements = [];
  const groupsById = new Map();

  if (activeGroupIds.length > 0) {
    const [groups, expensesData, settlementData] = await Promise.all([
      Group.find({ _id: { $in: activeGroupIds } }).select("_id name").lean(),
      SharedExpense.find({ group: { $in: activeGroupIds } })
        .populate("paidBy", "_id username name email")
        .sort({ createdAt: -1 })
        .lean(),
      Settlement.find({ group: { $in: activeGroupIds } })
        .populate("from", "_id username name email")
        .populate("to", "_id username name email")
        .populate("recordedBy", "_id username name email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    for (const group of groups) {
      groupsById.set(toIdString(group._id), group);
    }

    sharedExpenses = expensesData;
    settlements = settlementData;
  }

  const splitsByExpenseId = new Map();
  if (sharedExpenses.length > 0) {
    const expenseIds = sharedExpenses.map((e) => e._id);
    const allSplits = await ExpenseSplit.find({ expense: { $in: expenseIds } })
      .populate("user", "_id username name email")
      .sort({ createdAt: 1 })
      .lean();

    for (const split of allSplits) {
      const expenseId = toIdString(split.expense);
      const splits = splitsByExpenseId.get(expenseId) || [];
      splits.push(split);
      splitsByExpenseId.set(expenseId, splits);
    }
  }

  const events = [
    ...buildPersonalIncomeEvents(income),
    ...buildPersonalExpenseEvents(expenses),
    ...buildSharedExpenseEvents(sharedExpenses, splitsByExpenseId, groupsById, userId),
    ...buildSettlementEvents(settlements, groupsById),
  ].sort(compareByDateDescThenIdAsc);

  return { events };
};
