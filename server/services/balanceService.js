import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import Settlement from "../models/Settlement.js";
import User from "../models/User.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeGroupIds = (groupIds) => [
  ...new Set(groupIds.map((groupId) => String(groupId)).filter(Boolean)),
];

const buildBalanceKey = (fromUserId, toUserId) => `${fromUserId}|${toUserId}`;

const addBalanceEntry = (ledger, fromUserId, toUserId, amount) => {
  const normalizedAmount = roundMoney(amount);

  if (!fromUserId || !toUserId || fromUserId === toUserId || normalizedAmount <= 0) {
    return;
  }

  const key = buildBalanceKey(fromUserId, toUserId);
  const currentAmount = ledger.get(key) || 0;
  ledger.set(key, roundMoney(currentAmount + normalizedAmount));
};

const netReverseBalances = (ledger) => {
  const processedPairs = new Set();
  const balances = [];

  for (const key of ledger.keys()) {
    const [from, to] = key.split("|");
    const pairKey = [from, to].sort().join("|");

    if (processedPairs.has(pairKey)) {
      continue;
    }

    processedPairs.add(pairKey);

    const forwardAmount = roundMoney(ledger.get(buildBalanceKey(from, to)) || 0);
    const reverseAmount = roundMoney(ledger.get(buildBalanceKey(to, from)) || 0);
    const netAmount = roundMoney(forwardAmount - reverseAmount);

    if (netAmount > 0) {
      balances.push({
        from,
        to,
        amount: netAmount,
      });
    } else if (netAmount < 0) {
      balances.push({
        from: to,
        to: from,
        amount: roundMoney(Math.abs(netAmount)),
      });
    }
  }

  return balances.sort((a, b) => {
    if (a.from === b.from) {
      return a.to.localeCompare(b.to);
    }

    return a.from.localeCompare(b.from);
  });
};

const hydrateBalanceUsers = async (balances) => {
  if (balances.length === 0) {
    return balances;
  }

  const userIds = [
    ...new Set(
      balances.flatMap((balance) => [balance.from, balance.to]).filter(Boolean)
    ),
  ];

  const users = await User.find({ _id: { $in: userIds } })
    .select("_id username name email")
    .lean();

  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return balances.map((balance) => ({
    from: usersById.get(String(balance.from)) || {
      _id: balance.from,
      name: "",
      email: "",
    },
    to: usersById.get(String(balance.to)) || {
      _id: balance.to,
      name: "",
      email: "",
    },
    amount: balance.amount,
  }));
};

const getRawGroupBalancesByGroupId = async (groupIds) => {
  const normalizedGroupIds = normalizeGroupIds(groupIds);
  const balancesByGroupId = new Map(
    normalizedGroupIds.map((groupId) => [groupId, []])
  );

  if (normalizedGroupIds.length === 0) {
    return balancesByGroupId;
  }

  const [expenses, settlements] = await Promise.all([
    SharedExpense.find({ group: { $in: normalizedGroupIds } })
      .select("_id group paidBy")
      .lean(),
    Settlement.find({ group: { $in: normalizedGroupIds } })
      .select("group from to amount")
      .lean(),
  ]);

  const expenseIds = expenses.map((expense) => expense._id);
  const splits =
    expenseIds.length > 0
      ? await ExpenseSplit.find({
          expense: { $in: expenseIds },
        })
          .select("expense user amount")
          .lean()
      : [];

  const splitsByExpenseId = new Map();

  for (const split of splits) {
    const expenseId = String(split.expense);
    const expenseSplits = splitsByExpenseId.get(expenseId) || [];
    expenseSplits.push(split);
    splitsByExpenseId.set(expenseId, expenseSplits);
  }

  const ledgersByGroupId = new Map(
    normalizedGroupIds.map((groupId) => [groupId, new Map()])
  );

  for (const expense of expenses) {
    const groupId = String(expense.group);
    const ledger = ledgersByGroupId.get(groupId);

    if (!ledger) {
      continue;
    }

    const payerId = String(expense.paidBy);
    const expenseSplits = splitsByExpenseId.get(String(expense._id)) || [];

    for (const split of expenseSplits) {
      const participantId = String(split.user);

      if (participantId === payerId) {
        continue;
      }

      addBalanceEntry(ledger, participantId, payerId, split.amount);
    }
  }

  for (const settlement of settlements) {
    const ledger = ledgersByGroupId.get(String(settlement.group));

    if (!ledger) {
      continue;
    }

    addBalanceEntry(ledger, String(settlement.to), String(settlement.from), settlement.amount);
  }

  for (const [groupId, ledger] of ledgersByGroupId) {
    balancesByGroupId.set(groupId, netReverseBalances(ledger));
  }

  return balancesByGroupId;
};

export const getUserGroupBalanceSummaries = async (groupIds, userId) => {
  const normalizedGroupIds = normalizeGroupIds(groupIds);
  const balancesByGroupId = await getRawGroupBalancesByGroupId(normalizedGroupIds);
  const normalizedUserId = String(userId);

  return normalizedGroupIds.map((groupId) => {
    const balances = balancesByGroupId.get(groupId) || [];
    const totalYouOwe = roundMoney(
      balances.reduce(
        (total, balance) =>
          String(balance.from) === normalizedUserId
            ? total + Number(balance.amount || 0)
            : total,
        0
      )
    );
    const totalYouAreOwed = roundMoney(
      balances.reduce(
        (total, balance) =>
          String(balance.to) === normalizedUserId
            ? total + Number(balance.amount || 0)
            : total,
        0
      )
    );

    return {
      groupId,
      totalYouOwe,
      totalYouAreOwed,
      netBalance: roundMoney(totalYouAreOwed - totalYouOwe),
    };
  });
};

export const getGroupBalances = async (groupId) => {
  const normalizedGroupId = String(groupId);
  const balancesByGroupId = await getRawGroupBalancesByGroupId([
    normalizedGroupId,
  ]);

  return hydrateBalanceUsers(balancesByGroupId.get(normalizedGroupId) || []);
};

export default {
  getGroupBalances,
  getUserGroupBalanceSummaries,
};
