import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import dashboardRoutes from "../routes/dashboardRoutes.js";
import Expense from "../models/Expense.js";
import ExpenseSplit from "../models/ExpenseSplit.js";
import Group from "../models/Group.js";
import GroupMembership from "../models/GroupMembership.js";
import Income from "../models/Income.js";
import Settlement from "../models/Settlement.js";
import SharedExpense from "../models/SharedExpense.js";
import User from "../models/User.js";
import {
  getGroupBalances,
  getUserGroupBalanceSummaries,
} from "../services/balanceService.js";
import { getDashboardSummary } from "../services/dashboardService.js";

process.env.JWT_SECRET = "dashboard-summary-test-secret";

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const thirdUserId = "507f1f77bcf86cd799439013";
const firstGroupId = "507f1f77bcf86cd799439021";
const secondGroupId = "507f1f77bcf86cd799439022";
const settledGroupId = "507f1f77bcf86cd799439023";
const inactiveGroupId = "507f1f77bcf86cd799439024";
const firstExpenseId = "507f1f77bcf86cd799439031";
const secondExpenseId = "507f1f77bcf86cd799439032";
const settledExpenseId = "507f1f77bcf86cd799439033";

const app = express();
app.use("/api/dashboard", dashboardRoutes);

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

after(
  () =>
    new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

const queryResult = (value) => {
  const query = {
    lean: async () => value,
    select: () => query,
  };

  return query;
};

const balanceFixtures = {
  expenses: [
    { _id: firstExpenseId, group: firstGroupId, paidBy: otherUserId },
    { _id: secondExpenseId, group: secondGroupId, paidBy: userId },
    { _id: settledExpenseId, group: settledGroupId, paidBy: userId },
  ],
  settlements: [],
  splits: [
    { expense: firstExpenseId, user: userId, amount: 24 },
    { expense: secondExpenseId, user: thirdUserId, amount: 34 },
    { expense: settledExpenseId, user: userId, amount: 10 },
  ],
};

const mockBalanceQueries = (t, expectedGroupIds) => {
  const sharedExpenseFind = t.mock.method(SharedExpense, "find", (filter) => {
    assert.deepEqual(filter, { group: { $in: expectedGroupIds } });
    return queryResult(balanceFixtures.expenses);
  });
  const settlementFind = t.mock.method(Settlement, "find", (filter) => {
    assert.deepEqual(filter, { group: { $in: expectedGroupIds } });
    return queryResult(balanceFixtures.settlements);
  });
  const splitFind = t.mock.method(ExpenseSplit, "find", (filter) => {
    assert.deepEqual(
      filter.expense.$in.map(String),
      [firstExpenseId, secondExpenseId, settledExpenseId],
    );
    return queryResult(balanceFixtures.splits);
  });

  return { settlementFind, sharedExpenseFind, splitFind };
};

test("batched balance summaries calculate every Space with one query set", async (t) => {
  const groupIds = [firstGroupId, secondGroupId, settledGroupId];
  const queries = mockBalanceQueries(t, groupIds);

  const summaries = await getUserGroupBalanceSummaries(groupIds, userId);

  assert.deepEqual(summaries, [
    {
      groupId: firstGroupId,
      totalYouOwe: 24,
      totalYouAreOwed: 0,
      netBalance: -24,
    },
    {
      groupId: secondGroupId,
      totalYouOwe: 0,
      totalYouAreOwed: 34,
      netBalance: 34,
    },
    {
      groupId: settledGroupId,
      totalYouOwe: 0,
      totalYouAreOwed: 0,
      netBalance: 0,
    },
  ]);
  assert.equal(queries.sharedExpenseFind.mock.callCount(), 1);
  assert.equal(queries.settlementFind.mock.callCount(), 1);
  assert.equal(queries.splitFind.mock.callCount(), 1);
});

test("existing hydrated single-Space balance behavior remains compatible", async (t) => {
  mockBalanceQueries(t, [firstGroupId]);
  t.mock.method(User, "find", (filter) => {
    assert.deepEqual(
      new Set(filter._id.$in),
      new Set([userId, otherUserId]),
    );
    return queryResult([
      { _id: userId, name: "Current user" },
      { _id: otherUserId, name: "Other user" },
    ]);
  });

  const balances = await getGroupBalances(firstGroupId);

  assert.deepEqual(balances, [
    {
      from: { _id: userId, name: "Current user" },
      to: { _id: otherUserId, name: "Other user" },
      amount: 24,
    },
  ]);
});

test("dashboard summary preserves aggregates and adds isolated unsettled Spaces", async (t) => {
  const activeGroupIds = [firstGroupId, secondGroupId, settledGroupId];
  const membershipFind = t.mock.method(GroupMembership, "find", (filter) => {
    assert.deepEqual(filter, { userId, status: "active" });
    return queryResult(activeGroupIds.map((groupId) => ({ groupId })));
  });
  const groupFind = t.mock.method(Group, "find", (filter) => {
    assert.deepEqual(filter, { _id: { $in: activeGroupIds } });
    assert.equal(filter._id.$in.includes(inactiveGroupId), false);
    return queryResult([
      { _id: firstGroupId, name: "A&W Team" },
      { _id: secondGroupId, name: "Summer trip" },
      { _id: settledGroupId, name: "Settled Space" },
    ]);
  });
  const queries = mockBalanceQueries(t, activeGroupIds);

  const summary = await getDashboardSummary(userId);

  assert.deepEqual(summary, {
    totalYouOwe: 24,
    totalYouAreOwed: 34,
    netBalance: 10,
    spaces: [
      {
        groupId: firstGroupId,
        name: "A&W Team",
        totalYouOwe: 24,
        totalYouAreOwed: 0,
        netBalance: -24,
      },
      {
        groupId: secondGroupId,
        name: "Summer trip",
        totalYouOwe: 0,
        totalYouAreOwed: 34,
        netBalance: 34,
      },
    ],
  });
  assert.equal(
    summary.spaces.some((space) => space.groupId === settledGroupId),
    false,
  );
  assert.equal(
    summary.spaces.some((space) => space.groupId === inactiveGroupId),
    false,
  );
  assert.equal(membershipFind.mock.callCount(), 1);
  assert.equal(groupFind.mock.callCount(), 1);
  assert.equal(queries.sharedExpenseFind.mock.callCount(), 1);
  assert.equal(queries.settlementFind.mock.callCount(), 1);
  assert.equal(queries.splitFind.mock.callCount(), 1);
});

test("dashboard summary returns an empty breakdown without balance queries", async (t) => {
  t.mock.method(GroupMembership, "find", (filter) => {
    assert.deepEqual(filter, { userId, status: "active" });
    return queryResult([]);
  });
  const groupFind = t.mock.method(Group, "find", () => {
    throw new Error("Group lookup must not run without active memberships");
  });
  const sharedExpenseFind = t.mock.method(SharedExpense, "find", () => {
    throw new Error("Balance lookup must not run without active memberships");
  });

  assert.deepEqual(await getDashboardSummary(userId), {
    totalYouOwe: 0,
    totalYouAreOwed: 0,
    netBalance: 0,
    spaces: [],
  });
  assert.equal(groupFind.mock.callCount(), 0);
  assert.equal(sharedExpenseFind.mock.callCount(), 0);
});

test("dashboard route preserves its response contract and requires authentication", async (t) => {
  const aggregateIncome = t.mock.method(Income, "aggregate", async () => [
    { _id: null, total: 1000 },
  ]);
  let expenseAggregateCall = 0;
  const aggregateExpense = t.mock.method(Expense, "aggregate", async () => {
    expenseAggregateCall += 1;
    return expenseAggregateCall === 1
      ? [{ _id: null, total: 250 }]
      : [{ _id: "Food", amount: 250 }];
  });
  const membershipFind = t.mock.method(GroupMembership, "find", () =>
    queryResult([]),
  );
  t.mock.method(User, "findById", (id) => {
    assert.equal(String(id), userId);
    return { select: async () => ({ _id: userId, id: userId }) };
  });

  const unauthorized = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), {
    message: "Not authorized, no token",
  });
  assert.equal(aggregateIncome.mock.callCount(), 0);
  assert.equal(aggregateExpense.mock.callCount(), 0);
  assert.equal(membershipFind.mock.callCount(), 0);

  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const authorized = await fetch(`${baseUrl}/api/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    incomeTotal: 1000,
    expenseTotal: 250,
    balance: 750,
    categoryBreakdown: [{ category: "Food", amount: 250 }],
    sharedMoney: {
      totalYouOwe: 0,
      totalYouAreOwed: 0,
      netBalance: 0,
      spaces: [],
    },
  });
});
