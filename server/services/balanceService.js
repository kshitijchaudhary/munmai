import OpeningBalance from "../models/OpeningBalance.js";
import Settlement from "../models/Settlement.js";
import SharedExpense from "../models/SharedExpense.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toCents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100);
const centsToAmount = (value) => roundMoney(Number(value || 0) / 100);

const buildDirectedKey = (fromUser, toUser) => `${fromUser}|${toUser}`;

const addDirectedAmount = (ledger, fromUser, toUser, amount) => {
  const normalizedAmount = roundMoney(amount);

  if (!fromUser || !toUser || fromUser === toUser || normalizedAmount <= 0) {
    return;
  }

  const key = buildDirectedKey(fromUser, toUser);
  const currentAmount = ledger.get(key) || 0;
  ledger.set(key, roundMoney(currentAmount + normalizedAmount));
};

const normalizePairwiseBalances = (ledger) => {
  const processedPairs = new Set();
  const balances = [];

  for (const key of ledger.keys()) {
    const [fromUser, toUser] = key.split("|");
    const pairKey = [fromUser, toUser].sort().join("|");

    if (processedPairs.has(pairKey)) {
      continue;
    }

    processedPairs.add(pairKey);

    const forwardAmount = ledger.get(buildDirectedKey(fromUser, toUser)) || 0;
    const backwardAmount = ledger.get(buildDirectedKey(toUser, fromUser)) || 0;
    const netAmount = roundMoney(forwardAmount - backwardAmount);

    if (netAmount > 0) {
      balances.push({
        fromUser,
        toUser,
        amount: netAmount,
      });
    } else if (netAmount < 0) {
      balances.push({
        fromUser: toUser,
        toUser: fromUser,
        amount: roundMoney(Math.abs(netAmount)),
      });
    }
  }

  return balances.sort((a, b) => {
    if (a.fromUser === b.fromUser) {
      return a.toUser.localeCompare(b.toUser);
    }

    return a.fromUser.localeCompare(b.fromUser);
  });
};

export const calculateGroupBalances = async (groupId) => {
  const [sharedExpenses, settlements, openingBalances] = await Promise.all([
    SharedExpense.find({ groupId }).lean(),
    Settlement.find({ groupId }).lean(),
    OpeningBalance.find({ groupId }).lean(),
  ]);

  const ledger = new Map();

  for (const entry of openingBalances) {
    addDirectedAmount(
      ledger,
      String(entry.fromUser),
      String(entry.toUser),
      entry.amount
    );
  }

  for (const expense of sharedExpenses) {
    const uniqueParticipants = [...new Set((expense.participants || []).map(String))];
    const paidBy = String(expense.paidBy);
    const amount = Number(expense.amount || 0);

    if (amount <= 0 || uniqueParticipants.length === 0) {
      continue;
    }

    const sortedParticipants = [...uniqueParticipants].sort();
    const amountCents = toCents(amount);
    const baseShareCents = Math.floor(amountCents / sortedParticipants.length);
    const remainderCents = amountCents % sortedParticipants.length;

    for (let index = 0; index < sortedParticipants.length; index += 1) {
      const participantId = sortedParticipants[index];
      if (participantId === paidBy) {
        continue;
      }

      const participantShareCents =
        baseShareCents + (index < remainderCents ? 1 : 0);
      addDirectedAmount(
        ledger,
        participantId,
        paidBy,
        centsToAmount(participantShareCents)
      );
    }
  }

  for (const settlement of settlements) {
    addDirectedAmount(
      ledger,
      String(settlement.toUser),
      String(settlement.fromUser),
      settlement.amount
    );
  }

  return {
    groupId: String(groupId),
    balances: normalizePairwiseBalances(ledger),
  };
};

export default calculateGroupBalances;
