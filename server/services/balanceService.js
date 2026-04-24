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

  return Array.from(ledger.entries())
    .map(([key, amount]) => {
      const [from, to] = key.split("|");

      return {
        from,
        to,
        amount: roundMoney(amount),
      };
    })
    .sort((a, b) => {
      if (a.from === b.from) {
        return a.to.localeCompare(b.to);
      }

      return a.from.localeCompare(b.from);
    });
};

export default {
  getGroupBalances,
};
