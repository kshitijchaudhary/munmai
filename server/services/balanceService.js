import SharedExpense from "../models/SharedExpense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

export const getGroupBalances = async (groupId) => {
  const expenses = await SharedExpense.find({ group: groupId })
    .select("_id paidBy")
    .lean();

  if (expenses.length === 0) {
    return [];
  }

  const expenseIds = expenses.map((expense) => expense._id);
  const splits = await ExpenseSplit.find({
    expense: { $in: expenseIds },
  })
    .select("expense user amount")
    .lean();

  const splitsByExpenseId = new Map();

  for (const split of splits) {
    const expenseId = String(split.expense);
    const expenseSplits = splitsByExpenseId.get(expenseId) || [];
    expenseSplits.push(split);
    splitsByExpenseId.set(expenseId, expenseSplits);
  }

  const ledger = new Map();

  for (const expense of expenses) {
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

  return netReverseBalances(ledger);
};

export default {
  getGroupBalances,
};
