import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.JWT_SECRET = "shared-expense-standalone-test-secret";

const standaloneUri = process.env.MONGO_STANDALONE_TEST_URI;

let express, jwt, mongoose, User, Group, GroupMembership,
  SharedExpense, ExpenseSplit, sharedExpenseRoutes, authMiddleware;

const standaloneTest = (name, fn) =>
  test(name, { skip: standaloneUri ? false : "MONGO_STANDALONE_TEST_URI is not set" }, fn);

let server, baseUrl;

before(async () => {
  if (!standaloneUri) return;
  const mods = await Promise.all([
    import("express"), import("jsonwebtoken"), import("mongoose"),
    import("../models/User.js"), import("../models/Group.js"),
    import("../models/GroupMembership.js"), import("../models/SharedExpense.js"),
    import("../models/ExpenseSplit.js"), import("../routes/sharedExpenseRoutes.js"),
    import("../middleware/authMiddleware.js"),
  ]);
  express = mods[0].default;
  jwt = mods[1].default;
  mongoose = mods[2].default;
  User = mods[3].default;
  Group = mods[4].default;
  GroupMembership = mods[5].default;
  SharedExpense = mods[6].default;
  ExpenseSplit = mods[7].default;
  sharedExpenseRoutes = mods[8].default;
  authMiddleware = mods[9];

  await mongoose.connect(standaloneUri);
  await mongoose.connection.db.dropDatabase();
  await Promise.all([User.syncIndexes(), Group.syncIndexes(), GroupMembership.syncIndexes(), SharedExpense.syncIndexes(), ExpenseSplit.syncIndexes()]);
});

after(async () => {
  if (server) await new Promise((res, rej) => server.close((e) => (e ? rej(e) : res())));
  if (standaloneUri) await mongoose.disconnect();
});

standaloneTest("shared-expense creation returns 503 on standalone MongoDB with zero records persisted", async () => {
  const user = await User.create({ name: "Standalone", email: "standalone@example.com", username: "standalone", password: "test-password", isVerified: true });
  const group = await Group.create({ name: "Standalone Space", createdBy: user._id, members: [user._id] });
  await GroupMembership.create({ groupId: group._id, userId: user._id, invitedEmail: user.email, invitedBy: user._id, role: "owner", status: "active", joinedAt: new Date() });

  const app = express();
  app.use(express.json());
  app.use("/api/shared-expenses", sharedExpenseRoutes);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  baseUrl = "http://127.0.0.1:" + server.address().port;

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + "/api/shared-expenses", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Idempotency-Key": "standalone-test-key-0001" },
    body: JSON.stringify({
      groupId: String(group._id),
      paidBy: String(user._id),
      participants: [String(user._id)],
      amount: 10,
      description: "Standalone test",
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.message, /temporarily unavailable/i);
  assert.equal(await SharedExpense.countDocuments({}), 0);
  assert.equal(await ExpenseSplit.countDocuments({}), 0);
});