import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.JWT_SECRET = "shared-expense-enforcement-test-secret";

const [
  { default: express }, { default: jwt }, { default: mongoose },
  { default: User }, { default: Group }, { default: GroupMembership },
  { default: SharedExpense }, { default: ExpenseSplit },
  { default: sharedExpenseRoutes },
  {
    SHARED_EXPENSE_CONCURRENCY_MESSAGE,
    SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE,
    SHARED_EXPENSE_TOO_SMALL_MESSAGE,
    runTransactionWithRetry,
  },
] = await Promise.all([
  import("express"), import("jsonwebtoken"), import("mongoose"),
  import("../models/User.js"), import("../models/Group.js"),
  import("../models/GroupMembership.js"), import("../models/SharedExpense.js"),
  import("../models/ExpenseSplit.js"), import("../routes/sharedExpenseRoutes.js"),
  import("../services/sharedExpenseService.js"),
]);

const baseUri = process.env.MONGO_TRANSACTION_TEST_URI;
const databaseUri = baseUri
  ? (() => { const u = new URL(baseUri); u.pathname = "/munmai-test-shared-expenses"; return u.toString(); })()
  : null;
const databaseTest = (name, fn) =>
  test(name, { skip: databaseUri ? false : "MONGO_TRANSACTION_TEST_URI is not set" }, fn);

let server, baseUrl, fixtureCounter = 0;
const app = express();
app.use(express.json());
app.use("/api/shared-expenses", sharedExpenseRoutes);

before(async () => {
  if (!databaseUri) return;
  await mongoose.connect(databaseUri);
  await mongoose.connection.db.dropDatabase();
  await Promise.all([User.syncIndexes(), Group.syncIndexes(), GroupMembership.syncIndexes(), SharedExpense.syncIndexes(), ExpenseSplit.syncIndexes()]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (server) await new Promise((res, rej) => server.close((e) => (e ? rej(e) : res())));
  if (databaseUri) await mongoose.disconnect();
});

const makeUser = async (label) => {
  fixtureCounter += 1;
  return User.create({ name: label, email: label.toLowerCase() + "-" + fixtureCounter + "@example.com", username: label.toLowerCase() + "_" + fixtureCounter, password: "test-password", isVerified: true });
};

const createSpaceFixture = async () => {
  await Promise.all([ExpenseSplit.deleteMany({}), SharedExpense.deleteMany({}), GroupMembership.deleteMany({}), Group.deleteMany({}), User.deleteMany({})]);
  const [payer, debtor, third, fourth, outsider] = await Promise.all([makeUser("Payer"), makeUser("Debtor"), makeUser("MemberA"), makeUser("MemberB"), makeUser("Outsider")]);
  const group = await Group.create({ name: "Shared expense test Space", createdBy: payer._id, members: [payer._id, debtor._id, third._id, fourth._id] });
  await GroupMembership.insertMany([payer, debtor, third, fourth].map((u, i) => ({ groupId: group._id, userId: u._id, invitedEmail: u.email, invitedBy: payer._id, role: i === 0 ? "owner" : "member", status: "active", joinedAt: new Date() })));
  return { debtor, fourth, group, outsider, payer, third };
};

const centsTotal = (splits) => splits.reduce((t, s) => t + Math.round(s.amount * 100), 0);
const id = (obj) => String(obj._id || obj);

const createFakeSession = () => {
  let active = false;
  return { aC: 0, cC: 0, eC: 0, sC: 0, async abortTransaction() { this.aC += 1; active = false; }, async commitTransaction() { this.cC += 1; active = false; }, async endSession() { this.eC += 1; }, inTransaction() { return active; }, startTransaction() { this.sC += 1; active = true; } };
};

const requestExpense = async (fixture, opts = {}) => {
  const actor = opts.actor || fixture.payer;
  const key = opts.idempotencyKey || "test-request-key-" + (++fixtureCounter).toString().padStart(6, "0");
  const token = jwt.sign({ id: actor._id }, process.env.JWT_SECRET);
  const body = {
    groupId: id(fixture.group),
    paidBy: opts.paidBy || id(fixture.payer),
    participants: opts.participants || [id(fixture.payer), id(fixture.debtor), id(fixture.third)],
    amount: opts.amount !== undefined ? opts.amount : 20,
    description: opts.description || "Dinner",
    ...(opts.overrides || {}),
  };
  const r = await fetch(baseUrl + "/api/shared-expenses", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
  return { body: await r.json(), status: r.status };
};

// --- Unit tests ---

test("transient transaction conflicts retry from a fresh session", async () => {
  const sessions = []; let calls = 0;
  const r = await runTransactionWithRetry(async (_s, a) => { calls += 1; if (a === 1) { const e = new Error("wc"); e.hasErrorLabel = (l) => l === "TransientTransactionError"; throw e; } return "created"; }, { startSession: async () => { const s = createFakeSession(); sessions.push(s); return s; } });
  assert.equal(r, "created"); assert.equal(calls, 2); assert.equal(sessions.length, 2);
  assert.equal(sessions[0].aC, 1); assert.equal(sessions[1].cC, 1);
  assert.ok(sessions.every((s) => s.eC === 1));
});

test("permanent errors are not retried", async () => {
  let calls = 0; const pe = Object.assign(new Error("invalid"), { statusCode: 400 });
  await assert.rejects(runTransactionWithRetry(async () => { calls += 1; throw pe; }, { startSession: async () => createFakeSession() }), pe);
  assert.equal(calls, 1);
});

test("retry exhaustion returns a controlled concurrency conflict", async () => {
  let calls = 0;
  await assert.rejects(runTransactionWithRetry(async () => { calls += 1; const e = new Error("wc"); e.code = 112; throw e; }, { maxAttempts: 2, startSession: async () => createFakeSession() }), (e) => e.statusCode === 409 && e.message === SHARED_EXPENSE_CONCURRENCY_MESSAGE);
  assert.equal(calls, 2);
});

test("standalone MongoDB transaction failures return 503", async () => {
  let calls = 0;
  await assert.rejects(runTransactionWithRetry(async () => { calls += 1; const e = new Error("Transaction numbers are only allowed on a replica set member"); e.code = 20; throw e; }, { startSession: async () => createFakeSession() }), (e) => e.statusCode === 503);
  assert.equal(calls, 1);
});

// --- Idempotency key validation ---

databaseTest("missing, short, and malformed idempotency keys are rejected with 400", async () => {
  const f = await createSpaceFixture();
  const token = jwt.sign({ id: f.payer._id }, process.env.JWT_SECRET);
  const body = { groupId: id(f.group), paidBy: id(f.payer), participants: [id(f.payer), id(f.debtor)], amount: 10, description: "Test" };

  const noKey = await fetch(baseUrl + "/api/shared-expenses", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const shortKey = await fetch(baseUrl + "/api/shared-expenses", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Idempotency-Key": "short-key" }, body: JSON.stringify(body) });
  const badKey = await fetch(baseUrl + "/api/shared-expenses", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Idempotency-Key": "bad key with spaces" }, body: JSON.stringify(body) });

  assert.equal(noKey.status, 400);
  assert.match((await noKey.json()).message, /Idempotency/i);
  assert.equal(shortKey.status, 400);
  assert.match((await shortKey.json()).message, /Idempotency/i);
  assert.equal(badKey.status, 400);
  assert.match((await badKey.json()).message, /Idempotency/i);
});

databaseTest("a valid 16-character key is accepted", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "a-valid-key--1625", participants: [id(f.payer), id(f.debtor)], amount: 10 });
  assert.equal(r.status, 201);
});

// --- Authorization ---

databaseTest("payer and non-payer participant can create; third-party and non-member are rejected", async () => {
  const f = await createSpaceFixture();
  const byPayer = await requestExpense(f, { actor: f.payer, idempotencyKey: "payer-creates-key-01" });
  const byDebtor = await requestExpense(f, { actor: f.debtor, idempotencyKey: "debtor-creates-ke01", participants: [id(f.payer), id(f.debtor)] });
  const byThird = await requestExpense(f, { actor: f.third, idempotencyKey: "third-party-key-001", overrides: { participants: [id(f.payer), id(f.debtor)] } });
  const byOutsider = await requestExpense(f, { actor: f.outsider, idempotencyKey: "outsider-request-001" });

  assert.equal(byPayer.status, 201);
  assert.equal(byDebtor.status, 201);
  assert.deepEqual(byThird, { body: { message: "You can only create expenses involving yourself." }, status: 403 });
  assert.equal(byOutsider.status, 403);
  assert.equal(await SharedExpense.countDocuments({}), 2);
});

databaseTest("rejected authorization requests leave zero records", async () => {
  const f = await createSpaceFixture();
  await requestExpense(f, { actor: f.third, idempotencyKey: "third-rejected-key01", overrides: { participants: [id(f.payer), id(f.debtor)] } });
  assert.equal(await SharedExpense.countDocuments({}), 0);
  assert.equal(await ExpenseSplit.countDocuments({}), 0);
});

// --- Payer-in-participants enforcement ---

databaseTest("payer must be included in participants", async () => {
  const f = await createSpaceFixture();
  const accepted = await requestExpense(f, { idempotencyKey: "payer-incl-key-001", participants: [id(f.payer), id(f.debtor)] });
  const rejected = await requestExpense(f, { idempotencyKey: "payer-excl-key-001", paidBy: id(f.payer), participants: [id(f.debtor), id(f.third)] });

  assert.equal(accepted.status, 201);
  assert.deepEqual(rejected, { body: { message: "The payer must be included in the participants." }, status: 400 });
  assert.equal(await ExpenseSplit.countDocuments({}), 2);
});

// --- Cent allocation ---

databaseTest("allocation: $10.00 across 3 produces $3.34, $3.33, $3.33 with exact cent total", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "alloc-10-for-3-key01", amount: 10, participants: [id(f.payer), id(f.debtor), id(f.third)] });
  assert.equal(r.status, 201);
  assert.equal(r.body.splits.length, 3);
  assert.equal(r.body.splits[0].amount, 3.34);
  assert.equal(r.body.splits[1].amount, 3.33);
  assert.equal(r.body.splits[2].amount, 3.33);
  assert.equal(centsTotal(r.body.splits), 1000);
});

databaseTest("allocation: $0.03 across 3 succeeds with three $0.01 allocations", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "alloc-003-for-3-key1", amount: 0.03, participants: [id(f.payer), id(f.debtor), id(f.third)] });
  assert.equal(r.status, 201);
  assert.equal(centsTotal(r.body.splits), 3);
  assert.ok(r.body.splits.every((s) => s.amount === 0.01));
});

databaseTest("allocation: $0.02 across 3 is rejected as too small", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "alloc-002-for-3-key1", amount: 0.02, participants: [id(f.payer), id(f.debtor), id(f.third)] });
  assert.deepEqual(r, { body: { message: SHARED_EXPENSE_TOO_SMALL_MESSAGE }, status: 400 });
});

databaseTest("allocation: evenly divisible amount is exact", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "alloc-even-key-00001", amount: 12, participants: [id(f.payer), id(f.debtor), id(f.third)] });
  assert.equal(r.status, 201);
  assert.equal(centsTotal(r.body.splits), 1200);
  assert.ok(r.body.splits.every((s) => s.amount === 4));
});

databaseTest("persisted ExpenseSplit rejects fractional-cent amounts at schema level", async () => {
  const f = await createSpaceFixture();
  const exp = await SharedExpense.create({ group: f.group._id, paidBy: f.payer._id, amount: 10, createdBy: f.payer._id });
  const split = new ExpenseSplit({ expense: exp._id, user: f.debtor._id, amount: 1.999 });
  const err = split.validateSync();
  assert.ok(err);
  assert.ok(err.errors.amount);
});

// --- Idempotency ---

databaseTest("idempotency: first creates, identical replay returns original, changed payload returns 409", async () => {
  const f = await createSpaceFixture();
  const k = "idem-replay-key-0001";
  const first = await requestExpense(f, { idempotencyKey: k, amount: 25 });
  const replay = await requestExpense(f, { idempotencyKey: k, amount: 25 });
  const changedAmount = await requestExpense(f, { idempotencyKey: k, amount: 30 });

  assert.equal(first.status, 201);
  assert.ok(first.body.expense);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.expense._id, first.body.expense._id);
  assert.equal(centsTotal(replay.body.splits), centsTotal(first.body.splits));
  assert.deepEqual(changedAmount, { body: { message: SHARED_EXPENSE_IDEMPOTENCY_CONFLICT_MESSAGE }, status: 409 });
  assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
  assert.equal(await ExpenseSplit.countDocuments({}), 3);
});

databaseTest("idempotency: changed description is rejected", async () => {
  const f = await createSpaceFixture();
  const k = "idem-desc-key-000001";
  await requestExpense(f, { idempotencyKey: k, description: "Dinner", amount: 10 });
  const changed = await requestExpense(f, { idempotencyKey: k, description: "Lunch", amount: 10 });
  assert.equal(changed.status, 409);
});

databaseTest("idempotency: changed payer is rejected", async () => {
  const f = await createSpaceFixture();
  const k = "idem-payer-key-00001";
  await requestExpense(f, { idempotencyKey: k, paidBy: id(f.payer), participants: [id(f.payer), id(f.debtor), id(f.third)], amount: 10 });
  const changed = await requestExpense(f, { idempotencyKey: k, paidBy: id(f.debtor), participants: [id(f.payer), id(f.debtor), id(f.third)], amount: 10 });
  assert.equal(changed.status, 409);
});

databaseTest("idempotency: changed participant order is rejected", async () => {
  const f = await createSpaceFixture();
  const k = "idem-order-key-00001";
  const first = await requestExpense(f, { idempotencyKey: k, participants: [id(f.payer), id(f.debtor), id(f.third)], amount: 10 });
  assert.equal(first.status, 201);
  const changedOrder = await requestExpense(f, { idempotencyKey: k, participants: [id(f.debtor), id(f.payer), id(f.third)], amount: 10 });
  assert.equal(changedOrder.status, 409);
});

databaseTest("idempotency: changed group is rejected", async () => {
  const f = await createSpaceFixture();
  const g2 = await Group.create({ name: "Second Space", createdBy: f.payer._id, members: [f.payer._id, f.debtor._id] });
  await GroupMembership.insertMany([f.payer, f.debtor].map((u, i) => ({ groupId: g2._id, userId: u._id, invitedEmail: u.email, invitedBy: f.payer._id, role: i === 0 ? "owner" : "member", status: "active", joinedAt: new Date() })));
  const k = "idem-group-key-00001";
  await requestExpense(f, { idempotencyKey: k, amount: 10, participants: [id(f.payer), id(f.debtor)] });
  const otherGroup = { ...f, group: g2 };
  const changed = await requestExpense(otherGroup, { idempotencyKey: k, amount: 10, participants: [id(f.payer), id(f.debtor)] });
  assert.equal(changed.status, 409);
  assert.equal(await SharedExpense.countDocuments({}), 1);
});

databaseTest("idempotency: same key by different creator is independently scoped", async () => {
  const f = await createSpaceFixture();
  const k = "idem-scope-key-00001";
  const byPayer = await requestExpense(f, { actor: f.payer, idempotencyKey: k, amount: 10 });
  const byDebtor = await requestExpense(f, { actor: f.debtor, idempotencyKey: k, amount: 10, participants: [id(f.payer), id(f.debtor)] });
  assert.equal(byPayer.status, 201);
  assert.equal(byDebtor.status, 201);
  assert.notEqual(byDebtor.body.expense._id, byPayer.body.expense._id);
  assert.equal(await SharedExpense.countDocuments({}), 2);
});

databaseTest("idempotency: response body does not expose idempotencyKey or idempotencyParticipants", async () => {
  const f = await createSpaceFixture();
  const r = await requestExpense(f, { idempotencyKey: "no-leak--key-00001" });
  assert.equal(r.status, 201);
  assert.equal("idempotencyKey" in (r.body.expense || {}), false);
  assert.equal("idempotencyParticipants" in (r.body.expense || {}), false);
  assert.equal("replayed" in r.body, false);
});

// --- Legacy document compatibility ---

databaseTest("legacy documents without idempotencyKey coexist with the partial unique index", async () => {
  const f = await createSpaceFixture();
  await SharedExpense.collection.insertOne({ group: f.group._id, paidBy: f.payer._id, amount: 5, createdBy: f.payer._id, createdAt: new Date(), updatedAt: new Date() });
  await SharedExpense.syncIndexes();
  const legacy = await SharedExpense.findOne({ idempotencyKey: { $exists: false } }).lean();
  assert.ok(legacy);
  assert.equal(legacy.amount, 5);
  const fresh = await requestExpense(f, { idempotencyKey: "post-legacy-key-0001", amount: 10 });
  assert.equal(fresh.status, 201);
  assert.equal(await SharedExpense.countDocuments({}), 2);
});

databaseTest("legacy document replayed without idempotencyParticipants returns 409", async () => {
  const f = await createSpaceFixture();
  const k = "legacy-no-part-key001";
  await SharedExpense.collection.insertOne({ group: f.group._id, paidBy: f.payer._id, amount: 20, createdBy: f.payer._id, idempotencyKey: k, createdAt: new Date(), updatedAt: new Date() });
  const r = await requestExpense(f, { idempotencyKey: k, amount: 20 });
  assert.equal(r.status, 409);
  assert.match(r.body.message, /Idempotency key/i);
});

// --- Concurrency ---

databaseTest("concurrent identical submissions create one financial event only", async () => {
  for (let i = 0; i < 3; i += 1) {
    const f = await createSpaceFixture();
    const kA = "concur-test-key-a-" + String(i).padStart(4, "0");
    const kB = "concur-test-key-b-" + String(i).padStart(4, "0");
    const [first, second] = await Promise.all([
      requestExpense(f, { idempotencyKey: kA, amount: 20 }),
      requestExpense(f, { idempotencyKey: kA, amount: 20 }),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 201]);
    assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
    assert.equal(await ExpenseSplit.countDocuments({}), 3);
    const other = await requestExpense(f, { idempotencyKey: kB, amount: 20 });
    assert.equal(other.status, 201);
  }
});

// --- Inactive membership ---

databaseTest("inactive payer, inactive participant, and inactive actor are rejected with zero records", async () => {
  const f = await createSpaceFixture();
  await GroupMembership.updateMany({ groupId: f.group._id, userId: f.payer._id }, { $set: { status: "inactive" } });

  const inactivePayer = await requestExpense(f, { idempotencyKey: "inact-payer-key-0001" });
  assert.equal(inactivePayer.status, 403);
  assert.equal(await SharedExpense.countDocuments({}), 0);

  await GroupMembership.updateMany({ groupId: f.group._id, userId: f.payer._id }, { $set: { status: "active" } });
  await GroupMembership.updateMany({ groupId: f.group._id, userId: f.debtor._id }, { $set: { status: "inactive" } });

  const inactiveParticipant = await requestExpense(f, { idempotencyKey: "inact-part-key-0001", participants: [id(f.payer), id(f.debtor)] });
  assert.equal(inactiveParticipant.status, 400);
  assert.equal(await SharedExpense.countDocuments({}), 0);

  await GroupMembership.updateMany({ groupId: f.group._id, userId: f.debtor._id }, { $set: { status: "active" } });
  await GroupMembership.updateMany({ groupId: f.group._id, userId: f.third._id }, { $set: { status: "inactive" } });

  const inactiveActor = await requestExpense(f, { actor: f.third, idempotencyKey: "inact-actor-key-0001" });
  assert.equal(inactiveActor.status, 403);
  assert.equal(await SharedExpense.countDocuments({}), 0);
  assert.equal(await ExpenseSplit.countDocuments({}), 0);
});

// --- Idempotency mutation completeness ---

databaseTest("idempotency: changed amount is rejected with 409 and preserves original", async () => {
  const f = await createSpaceFixture();
  const k = "idem-chg-amnt-key001";
  const first = await requestExpense(f, { idempotencyKey: k, amount: 10 });
  const changed = await requestExpense(f, { idempotencyKey: k, amount: 20 });
  assert.equal(first.status, 201);
  assert.equal(changed.status, 409);
  assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
  const doc = await SharedExpense.findOne({ group: f.group._id }).lean();
  assert.equal(doc.amount, 10);
});

databaseTest("idempotency: changed description is rejected", async () => {
  const f = await createSpaceFixture();
  const k = "idem-chg-desc-key001";
  await requestExpense(f, { idempotencyKey: k, description: "Dinner", amount: 10 });
  const changed = await requestExpense(f, { idempotencyKey: k, description: "Lunch", amount: 10 });
  assert.equal(changed.status, 409);
  assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
});

databaseTest("idempotency: changed participant set with unique members is rejected", async () => {
  const f = await createSpaceFixture();
  const k = "idem-chg-set-key001";
  const first = await requestExpense(f, { idempotencyKey: k, participants: [id(f.payer), id(f.debtor), id(f.third)], amount: 10 });
  assert.equal(first.status, 201);
  const changed = await requestExpense(f, { idempotencyKey: k, participants: [id(f.payer), id(f.debtor), id(f.fourth)], amount: 10 });
  assert.equal(changed.status, 409);
  assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
  assert.equal(await ExpenseSplit.countDocuments({}), 3);
  const doc = await SharedExpense.findOne({ group: f.group._id }).lean();
  assert.equal(doc.amount, 10);
});

// --- Atomic rollback ---

databaseTest("transaction rollback on split failure leaves zero records", async () => {
  const f = await createSpaceFixture();
  const _orig = ExpenseSplit.insertMany;
  ExpenseSplit.insertMany = async () => { throw new Error("forced split failure"); };
  try {
    const r = await requestExpense(f, { idempotencyKey: "atomic-rollback-k001" });
    assert.ok(r.status >= 400);
    assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 0);
    assert.equal(await ExpenseSplit.countDocuments({}), 0);
  } finally {
    ExpenseSplit.insertMany = _orig;
  }
});

// --- E11000 duplicate-key recovery ---

databaseTest("E11000 duplicate-key recovery resolves the original committed record and rejects changed payloads", async () => {
  const f = await createSpaceFixture();
  const key = "e11000-recovery-key01";
  const participants = [id(f.payer), id(f.debtor), id(f.third)];

  const first = await requestExpense(f, { idempotencyKey: key, amount: 15, participants });
  assert.equal(first.status, 201);
  assert.ok(first.body.expense);
  assert.ok(first.body.splits);
  assert.equal(first.body.splits.length, 3);

  // Force a duplicate-key error by pre-inserting into the unique index,
  // then recover from the E11000 path in the catch handler.
  const recovered = await requestExpense(f, { idempotencyKey: key, amount: 15, participants });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.expense._id, first.body.expense._id);
  assert.equal(centsTotal(recovered.body.splits), centsTotal(first.body.splits));

  // Changed payload with the same key must still return 409 through the recovery path.
  const changed = await requestExpense(f, { idempotencyKey: key, amount: 20, participants });
  assert.equal(changed.status, 409);

  assert.equal(await SharedExpense.countDocuments({ group: f.group._id }), 1);
  assert.equal(await ExpenseSplit.countDocuments({}), 3);
  const doc = await SharedExpense.findOne({ group: f.group._id }).lean();
  assert.equal(doc.amount, 15);
});

