import assert from "node:assert/strict";
import test from "node:test";

import { parseActivityFeedResponse } from "../src/activity/activity-model.ts";
import { isCanonicalMoneyAmount } from "../src/money/money-amount.js";

test("uses exact canonical-cent boundaries without tolerance", () => {
  for (const accepted of [
    0.01,
    0.1,
    1.2,
    3.33,
    3.34,
    99_999_999.99,
    100_000_000,
  ]) {
    assert.equal(
      isCanonicalMoneyAmount(accepted),
      true,
      `${accepted} should be accepted`,
    );
  }

  for (const rejected of [
    0,
    -1,
    1e-20,
    0.001,
    12.345,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    100_000_000.01,
  ]) {
    assert.equal(
      isCanonicalMoneyAmount(rejected),
      false,
      `${rejected} should be rejected`,
    );
  }
});

test("parses all four event types", () => {
  const events = parseActivityFeedResponse({
    events: [
      { id: "income:i1", sourceId: "i1", type: "income", title: "Payroll", amount: 100, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "Payroll", category: "Salary" },
      { id: "expense:e1", sourceId: "e1", type: "expense", title: "Vendor", amount: 50, occurredAt: "2026-07-19T00:00:00.000Z", destination: "/transactions/expense/e1", recipient: "Vendor", category: "Other" },
      { id: "shared-expense:s1", sourceId: "s1", type: "shared-expense", title: "Dinner", amount: 30, occurredAt: "2026-07-18T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "Team", paidBy: { id: "u1", name: "A" }, userShare: 10, splits: [{ userId: "u1", userName: "A", amount: 10, isCurrentUser: false, isPayer: true }] },
      { id: "settlement:st1", sourceId: "st1", type: "settlement", title: "Alex paid Sam", amount: 25, occurredAt: "2026-07-17T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "Team", from: { id: "u1", name: "A" }, to: { id: "u2", name: "S" } },
    ],
  });
  assert.equal(events.length, 4);
});

test("parses space name", () => {
  const events = parseActivityFeedResponse({ events: [{ id: "shared-expense:s1", sourceId: "s1", type: "shared-expense", title: "Dinner", amount: 30, occurredAt: "2026-07-18T00:00:00.000Z", spaceId: "g1", spaceName: "A&W Team", paidBy: { id: "u1", name: "A" }, userShare: 10, splits: [{ userId: "u1", userName: "A", amount: 10, isCurrentUser: true, isPayer: true }], destination: "/groups/g1" }] });
  assert.equal(events[0].spaceName, "A&W Team");
});

test("parses userShare", () => {
  const events = parseActivityFeedResponse({ events: [{ id: "shared-expense:s1", sourceId: "s1", type: "shared-expense", title: "Dinner", amount: 30, occurredAt: "2026-07-18T00:00:00.000Z", userShare: 3.33, spaceId: "g1", spaceName: "Team", paidBy: { id: "u1", name: "A" }, splits: [{ userId: "u1", userName: "A", amount: 10, isCurrentUser: true, isPayer: true }], destination: "/groups/g1" }] });
  assert.equal(events[0].userShare, 3.33);
});

test("preserves exact split values", () => {
  const events = parseActivityFeedResponse({ events: [{ id: "shared-expense:s1", sourceId: "s1", type: "shared-expense", title: "Dinner", amount: 10, occurredAt: "2026-07-18T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "Team", paidBy: { id: "u1", name: "A" }, userShare: 3.33, splits: [{ userId: "u1", userName: "Avery", amount: 3.34, isCurrentUser: false, isPayer: true }, { userId: "u2", userName: "Kshitij", amount: 3.33, isCurrentUser: true, isPayer: false }, { userId: "u3", userName: "Blair", amount: 3.33, isCurrentUser: false, isPayer: false }] }] });
  assert.equal(events[0].splits[0].amount, 3.34);
  assert.equal(events[0].splits[1].amount, 3.33);
  assert.equal(events[0].splits[2].amount, 3.33);
  assert.equal(events[0].splits[0].isPayer, true);
  assert.equal(events[0].splits[1].isCurrentUser, true);
});

test("handles missing optional fields safely", () => {
  const events = parseActivityFeedResponse({ events: [{ id: "income:i1", sourceId: "i1", type: "income", title: "Payroll", amount: 100, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", category: "Salary" }] });
  assert.equal(events[0].category, "Salary");
  assert.equal(events[0].notes, undefined);
  assert.equal(events[0].spaceName, undefined);
  assert.equal(events[0].userShare, undefined);
  assert.equal(events[0].splits, undefined);
  assert.equal(events[0].paidBy, undefined);
  assert.equal(events[0].from, undefined);
  assert.equal(events[0].to, undefined);
});

test("active Space events remain valid when the current user has no split", () => {
  const events = parseActivityFeedResponse({
    events: [{
      id: "shared-expense:s1",
      sourceId: "s1",
      type: "shared-expense",
      title: "Team expense",
      amount: 10,
      occurredAt: "2026-07-18T00:00:00.000Z",
      destination: "/groups/g1",
      spaceId: "g1",
      spaceName: "Team",
      paidBy: { id: "u2", name: "Avery" },
      splits: [
        {
          userId: "u2",
          userName: "Avery",
          amount: 10,
          isCurrentUser: false,
          isPayer: true,
        },
      ],
    }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].userShare, undefined);
});

test("rejects or skips malformed events safely", () => {
  const validIncome = { id: "income:i1", sourceId: "i1", type: "income", title: "Payroll", amount: 100, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "Payroll", category: "Salary" };
  const events = parseActivityFeedResponse({ events: [validIncome, null, undefined, {}, { id: "bad", type: "invalid" }, { id: "b2", type: "income", amount: "NaN" }] });
  assert.equal(events.length, 1);
});

test("rejects zero or negative amounts", () => {
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: 0, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] }).length, 0);
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: -1, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] }).length, 0);
});

test("rejects NaN, Infinity, fractional-cent amounts", () => {
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: NaN, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] }).length, 0);
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: Infinity, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] }).length, 0);
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: 12.345, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] }).length, 0);
});

test("preserves exact valid amounts like 3.34 and 3.33", () => {
  const events = parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: 3.34, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" }] });
  assert.equal(events.length, 1);
  assert.equal(events[0].amount, 3.34);
});

test("rejects shared-expense without spaceId", () => {
  assert.equal(parseActivityFeedResponse({ events: [{ id: "s1", sourceId: "s1", type: "shared-expense", title: "D", amount: 10, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/groups/g1" }] }).length, 0);
});

test("rejects settlement without from and to", () => {
  assert.equal(parseActivityFeedResponse({ events: [{ id: "st1", sourceId: "st1", type: "settlement", title: "T", amount: 10, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "Team" }] }).length, 0);
});

test("rejects income without correct destination prefix", () => {
  assert.equal(parseActivityFeedResponse({ events: [{ id: "i1", sourceId: "i1", type: "income", title: "X", amount: 10, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/groups/g1", source: "X", category: "X" }] }).length, 0);
});

test("sort order from the server remains stable", () => {
  const events = parseActivityFeedResponse({ events: [
    { id: "settlement:a", sourceId: "a", type: "settlement", title: "T", amount: 10, occurredAt: "2026-07-18T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "S", from: { id: "u1", name: "A" }, to: { id: "u2", name: "S" } },
    { id: "income:b", sourceId: "b", type: "income", title: "T", amount: 10, occurredAt: "2026-07-17T00:00:00.000Z", destination: "/transactions/income/b", source: "X", category: "X" },
    { id: "shared-expense:c", sourceId: "c", type: "shared-expense", title: "T", amount: 10, occurredAt: "2026-07-16T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "S", paidBy: { id: "u1", name: "A" }, userShare: 5, splits: [{ userId: "u1", userName: "A", amount: 5, isCurrentUser: true, isPayer: true }] },
  ] });
  assert.equal(events[0].id, "settlement:a");
  assert.equal(events[1].id, "income:b");
  assert.equal(events[2].id, "shared-expense:c");
});

test("destination routes are public app paths", () => {
  const events = parseActivityFeedResponse({ events: [
    { id: "income:i1", sourceId: "i1", type: "income", title: "T", amount: 10, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/transactions/income/i1", source: "X", category: "X" },
    { id: "shared-expense:s1", sourceId: "s1", type: "shared-expense", title: "T", amount: 10, occurredAt: "2026-07-20T00:00:00.000Z", destination: "/groups/g1", spaceId: "g1", spaceName: "S", paidBy: { id: "u1", name: "A" }, userShare: 5, splits: [{ userId: "u1", userName: "A", amount: 5, isCurrentUser: true, isPayer: true }] },
  ] });
  assert.equal(events[0].destination, "/transactions/income/i1");
  assert.equal(events[1].destination, "/groups/g1");
});

test("empty response works", () => {
  assert.deepEqual(parseActivityFeedResponse({ events: [] }), []);
  assert.deepEqual(parseActivityFeedResponse({}), []);
  assert.deepEqual(parseActivityFeedResponse(null), []);
  assert.deepEqual(parseActivityFeedResponse(undefined), []);
});
