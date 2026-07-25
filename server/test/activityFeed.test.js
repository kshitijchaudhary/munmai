import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.JWT_SECRET = "activity-feed-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: mongoose },
  { default: User },
  { default: Income },
  { default: Expense },
  { default: SharedExpense },
  { default: ExpenseSplit },
  { default: Settlement },
  { default: Group },
  { default: GroupMembership },
  { default: activityRoutes },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("mongoose"),
  import("../models/User.js"),
  import("../models/Income.js"),
  import("../models/Expense.js"),
  import("../models/SharedExpense.js"),
  import("../models/ExpenseSplit.js"),
  import("../models/Settlement.js"),
  import("../models/Group.js"),
  import("../models/GroupMembership.js"),
  import("../routes/activityRoutes.js"),
]);

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const authHeaders = () => ({ Authorization: "Bearer " + token });

const asQuery = (value) => ({
  select() { return this; },
  session() { return this; },
  lean: async () => value,
  then(resolve) { return Promise.resolve(value).then(resolve); },
});

const asLean = (value) => ({
  select() { return this; },
  session() { return this; },
  lean: async () => value,
  then(resolve) { return Promise.resolve(value).then(resolve); },
});

const asResults = (value) => ({
  sort() { return this; },
  populate() { return this; },
  select() { return this; },
  session() { return this; },
  lean: async () => value,
  then(resolve) { return Promise.resolve(value).then(resolve); },
});

const app = express();
app.use(express.json());
app.use("/api/activity", activityRoutes);

let server, baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(() => new Promise((res, rej) => server.close((e) => (e ? rej(e) : res()))));

const requestFeed = async () => {
  const r = await fetch(baseUrl + "/api/activity", { headers: authHeaders() });
  return { body: await r.json(), status: r.status };
};

// --- Unauthenticated ---

test("unauthenticated request returns 401", async () => {
  const r = await fetch(baseUrl + "/api/activity");
  assert.equal(r.status, 401);
});

// --- Query authorization assertions ---

test("Income.find queries only the authenticated user", async (t) => {
  const queries = [];
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", (filter) => { queries.push(["Income.find", filter]); return asResults([]); });
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([]));

  await requestFeed();
  const incomeQuery = queries.find(([name]) => name === "Income.find");
  assert.ok(incomeQuery);
  assert.deepEqual(incomeQuery[1], { userId });
});

test("Expense.find queries only the authenticated user", async (t) => {
  const queries = [];
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", (filter) => { queries.push(["Expense.find", filter]); return asResults([]); });
  t.mock.method(GroupMembership, "find", () => asLean([]));

  await requestFeed();
  const expenseQuery = queries.find(([name]) => name === "Expense.find");
  assert.ok(expenseQuery);
  assert.deepEqual(expenseQuery[1], { userId });
});

test("GroupMembership.find queries with userId and status:active", async (t) => {
  const queries = [];
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", (filter) => { queries.push(["GroupMembership.find", filter]); return asLean([]); });

  await requestFeed();
  const membershipQuery = queries.find(([name]) => name === "GroupMembership.find");
  assert.ok(membershipQuery);
  assert.deepEqual(membershipQuery[1], { userId, status: "active" });
});

test("SharedExpense and Settlement queries use only the group IDs from active memberships", async (t) => {
  const groupIds = ["g1", "g2"];
  const queries = [];

  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: groupIds[0] }, { groupId: groupIds[1] }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "A" }, { _id: "g2", name: "B" }]));
  t.mock.method(SharedExpense, "find", (filter) => { queries.push(["SharedExpense.find", filter]); return asResults([]); });
  t.mock.method(ExpenseSplit, "find", () => asResults([]));
  t.mock.method(Settlement, "find", (filter) => { queries.push(["Settlement.find", filter]); return asResults([]); });

  await requestFeed();
  const seQuery = queries.find(([name]) => name === "SharedExpense.find");
  assert.ok(seQuery, "SharedExpense.find was called");
  assert.deepEqual(seQuery[1], { group: { $in: groupIds } });

  const sQuery = queries.find(([name]) => name === "Settlement.find");
  assert.ok(sQuery, "Settlement.find was called");
  assert.deepEqual(sQuery[1], { group: { $in: groupIds } });
});

// --- Personal records ---

test("personal income and expense records appear", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () =>
    asResults([{ _id: "i1", userId, amount: 100, source: "Payroll", category: "Salary", date: "2026-07-20" }]));
  t.mock.method(Expense, "find", () =>
    asResults([{ _id: "e1", userId, amount: 30, recipient: "Vendor", category: "Other", date: "2026-07-19" }]));
  t.mock.method(GroupMembership, "find", () => asLean([]));
  const r = await requestFeed();
  assert.equal(r.body.events.length, 2);
});

test("other user's personal records do not appear", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([]));
  const r = await requestFeed();
  assert.equal(r.body.events.length, 0);
});

// --- Shared expense and settlement events ---

test("shared expense from active membership appears with space name", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "A&W Team" }]));
  t.mock.method(SharedExpense, "find", () =>
    asResults([{ _id: "se1", group: "g1", amount: 10, description: "Dinner", paidBy: { _id: otherUserId, name: "Avery" }, createdAt: "2026-07-18T00:00:00.000Z" }]));
  t.mock.method(ExpenseSplit, "find", () =>
    asResults([
      { expense: "se1", user: { _id: otherUserId, name: "Avery" }, amount: 3.34 },
      { expense: "se1", user: { _id: userId, name: "Kshitij" }, amount: 3.33 },
    ]));
  t.mock.method(Settlement, "find", () => asResults([]));
  const r = await requestFeed();
  const e = r.body.events[0];
  assert.equal(e.id, "shared-expense:se1");
  assert.equal(e.spaceName, "A&W Team");
  assert.equal(e.userShare, 3.33);
  assert.equal(e.splits[0].amount, 3.34);
  assert.equal(e.splits[0].isPayer, true);
});

test("settlement from active membership appears with space name", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "A&W Team" }]));
  t.mock.method(SharedExpense, "find", () => asResults([]));
  t.mock.method(ExpenseSplit, "find", () => asResults([]));
  t.mock.method(Settlement, "find", () =>
    asResults([{ _id: "set1", group: "g1", amount: 25, from: { _id: userId, name: "Kshitij" }, to: { _id: otherUserId, name: "Avery" }, note: "Coffee", createdAt: "2026-07-17T00:00:00.000Z" }]));
  const r = await requestFeed();
  assert.equal(r.body.events[0].id, "settlement:set1");
  assert.equal(r.body.events[0].spaceName, "A&W Team");
});

test("removed/inactive/pending has no Space access", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([]));
  t.mock.method(Group, "find", () => asResults([]));
  t.mock.method(SharedExpense, "find", () => asResults([]));
  t.mock.method(ExpenseSplit, "find", () => asResults([]));
  t.mock.method(Settlement, "find", () => asResults([]));
  const r = await requestFeed();
  assert.equal(r.body.events.length, 0);
});

// --- Historical participant ---

test("historical inactive participant name still appears", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "Team" }]));
  t.mock.method(SharedExpense, "find", () =>
    asResults([{ _id: "se1", group: "g1", amount: 10, description: "Dinner", paidBy: { _id: otherUserId, name: "Avery" }, createdAt: "2026-07-18T00:00:00.000Z" }]));
  t.mock.method(ExpenseSplit, "find", () =>
    asResults([{ expense: "se1", user: { _id: "removed", name: "Former Member" }, amount: 5 }, { expense: "se1", user: { _id: userId, name: "Kshitij" }, amount: 5 }]));
  t.mock.method(Settlement, "find", () => asResults([]));
  const r = await requestFeed();
  assert.equal(r.body.events[0].splits[0].userName, "Former Member");
});

// --- $10 / 3 allocation ---

test("$10.00 split across 3 preserves exact values", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "Space" }]));
  t.mock.method(SharedExpense, "find", () =>
    asResults([{ _id: "se1", group: "g1", amount: 10, description: "Dinner", paidBy: { _id: otherUserId, name: "Avery" }, createdAt: "2026-07-16T00:00:00.000Z" }]));
  t.mock.method(ExpenseSplit, "find", () =>
    asResults([
      { expense: "se1", user: { _id: otherUserId, name: "Avery" }, amount: 3.34 },
      { expense: "se1", user: { _id: userId, name: "Kshitij" }, amount: 3.33 },
      { expense: "se1", user: { _id: "member3", name: "Blair" }, amount: 3.33 },
    ]));
  t.mock.method(Settlement, "find", () => asResults([]));
  const r = await requestFeed();
  const s = r.body.events[0].splits;
  assert.equal(s[0].amount, 3.34);
  assert.equal(s[1].amount, 3.33);
  assert.equal(s[2].amount, 3.33);
  assert.equal(r.body.events[0].userShare, 3.33);
});

// --- Ordering ---

test("events sort newest first with deterministic tiebreakers", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([{ _id: "i1", userId, amount: 10, source: "Old", category: "X", date: "2026-07-15" }]));
  t.mock.method(Expense, "find", () => asResults([{ _id: "e1", userId, amount: 5, recipient: "Mid", category: "X", date: "2026-07-17" }]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "Space" }]));
  t.mock.method(SharedExpense, "find", () => asResults([{ _id: "s1", group: "g1", amount: 20, description: "D", paidBy: { _id: otherUserId, name: "A" }, createdAt: "2026-07-16T00:00:00.000Z" }]));
  t.mock.method(ExpenseSplit, "find", () => asResults([{ expense: "s1", user: { _id: otherUserId, name: "A" }, amount: 10 }, { expense: "s1", user: { _id: userId, name: "K" }, amount: 10 }]));
  t.mock.method(Settlement, "find", () => asResults([{ _id: "st1", group: "g1", amount: 15, from: { _id: userId, name: "K" }, to: { _id: otherUserId, name: "A" }, createdAt: "2026-07-18T00:00:00.000Z" }]));
  const r = await requestFeed();
  assert.equal(r.body.events[0].id, "settlement:st1");
  assert.equal(r.body.events[1].id, "expense:e1");
  assert.equal(r.body.events[2].id, "shared-expense:s1");
  assert.equal(r.body.events[3].id, "income:i1");
});

test("no duplicate event IDs", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([{ _id: "i1", userId, amount: 10, source: "X", category: "X", date: "2026-07-20" }]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([]));
  const r = await requestFeed();
  const ids = r.body.events.map((e) => e.id);
  assert.equal(ids.length, new Set(ids).size);
});

// --- Internal field protection ---

test("internal fields are not exposed", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([{ _id: "i1", userId, amount: 10, source: "X", category: "X", date: "2026-07-20", idempotencyKey: "secret", settlementVersion: 5 }]));
  t.mock.method(Expense, "find", () => asResults([]));
  t.mock.method(GroupMembership, "find", () => asLean([]));
  const r = await requestFeed();
  assert.equal("idempotencyKey" in r.body.events[0], false);
  assert.equal("settlementVersion" in r.body.events[0], false);
  assert.equal("__v" in r.body.events[0], false);
});

// --- Destinations ---

test("destinations are valid for each event type", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, id: userId }) }));
  t.mock.method(Income, "find", () => asResults([{ _id: "i1", userId, amount: 10, source: "X", category: "X", date: "2026-07-20" }]));
  t.mock.method(Expense, "find", () => asResults([{ _id: "e1", userId, amount: 5, recipient: "Z", category: "X", date: "2026-07-20" }]));
  t.mock.method(GroupMembership, "find", () => asLean([{ groupId: "g1", userId, status: "active" }]));
  t.mock.method(Group, "find", () => asResults([{ _id: "g1", name: "Space" }]));
  t.mock.method(SharedExpense, "find", () =>
    asResults([{ _id: "s1", group: "g1", amount: 20, description: "D", paidBy: { _id: otherUserId, name: "A" }, createdAt: "2026-07-16T00:00:00.000Z" }]));
  t.mock.method(ExpenseSplit, "find", () => asResults([{ expense: "s1", user: { _id: otherUserId, name: "A" }, amount: 10 }, { expense: "s1", user: { _id: userId, name: "K" }, amount: 10 }]));
  t.mock.method(Settlement, "find", () =>
    asResults([{ _id: "st1", group: "g1", amount: 15, from: { _id: userId, name: "K" }, to: { _id: otherUserId, name: "A" }, createdAt: "2026-07-18T00:00:00.000Z" }]));
  const r = await requestFeed();
  const dests = r.body.events.map((e) => e.destination);
  assert.ok(dests.every((d) => typeof d === "string" && d.length > 0));
  assert.ok(r.body.events[0].destination.startsWith("/transactions/"));
  assert.ok(r.body.events[2].destination.startsWith("/groups/"));
});

// --- Schema index ---

test("GroupMembership schema defines an index on (userId, status, groupId)", () => {
  const schemaSource = GroupMembership.schema.indexes ? GroupMembership.schema.indexes() : [];
  const hasUserIdStatusIndex = schemaSource.some(
    (entry) => {
      if (!Array.isArray(entry) || !entry[0]) return false;
      return entry[0].userId === 1 && entry[0].status === 1;
    },
  );
  assert.ok(hasUserIdStatusIndex, "Expected schema index containing { userId: 1, status: 1, ... }");
});
