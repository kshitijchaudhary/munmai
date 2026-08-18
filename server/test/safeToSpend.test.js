import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.JWT_SECRET = "safe-to-spend-test-secret";

const [
  { default: express },
  { default: jwt },
  { default: User },
  { default: Planning },
  { default: planningRoutes },
  { calculateSafeToSpend },
] = await Promise.all([
  import("express"),
  import("jsonwebtoken"),
  import("../models/User.js"),
  import("../models/Planning.js"),
  import("../routes/planningRoutes.js"),
  import("../services/safeToSpendService.js"),
]);

const AS_OF = "2026-08-17";
const NEXT_PAYDAY = "2026-08-20";
const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const tokens = {
  [userId]: jwt.sign({ id: userId }, process.env.JWT_SECRET),
  [otherUserId]: jwt.sign({ id: otherUserId }, process.env.JWT_SECRET),
};

let obligationSequence = 20;
const obligation = ({
  amount = 100,
  category = "bill",
  certainty = "confirmed",
  dueDate = "2026-08-19",
  name = "Bill",
} = {}) => ({
  _id: `507f1f77bcf86cd7994390${obligationSequence++}`,
  amount,
  category,
  certainty,
  dueDate,
  name,
  note: "",
});

const planning = ({
  currentCash = 1000,
  essentialBuffer = 0,
  nextPayday = NEXT_PAYDAY,
  obligations = [],
} = {}) => ({
  currentCash,
  currency: "CAD",
  essentialBuffer,
  nextPayday,
  obligations,
  user: userId,
});

const calculate = (state) =>
  calculateSafeToSpend(state, { asOf: AS_OF });

const warningCodes = (result) =>
  result.warnings.map((warning) => warning.code);

const toCents = (amount) => Math.round(amount * 100);

test("basic Safe-to-Spend calculation is high confidence", () => {
  const result = calculate(
    planning({
      currentCash: 1000,
      essentialBuffer: 200,
      obligations: [
        obligation({ amount: 70, name: "Phone" }),
        obligation({ amount: 230, name: "Car" }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 500);
  assert.equal(result.confidence, "high");
  assert.equal(result.breakdown.includedObligationsTotal, 300);
  assert.deepEqual(result.warnings, []);
});

test("obligation after payday is excluded and obligation on payday is included", () => {
  const dueOnPayday = obligation({
    amount: 100,
    dueDate: NEXT_PAYDAY,
    name: "Due on payday",
  });
  const dueAfterPayday = obligation({
    amount: 300,
    dueDate: "2026-08-25",
    name: "Due later",
  });
  const result = calculate(
    planning({ obligations: [dueOnPayday, dueAfterPayday] }),
  );

  assert.equal(result.safeToSpend, 900);
  assert.equal(result.breakdown.obligations[0].included, true);
  assert.equal(result.breakdown.obligations[1].included, false);
  assert.equal(
    result.breakdown.obligations[1].exclusionReason,
    "AFTER_NEXT_PAYDAY",
  );
});

test("multiple obligations subtract using integer-cent totals", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({ amount: 100, name: "TD" }),
        obligation({ amount: 300, name: "Scotia" }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 600);
  assert.equal(result.breakdown.includedObligationsTotal, 400);
});

test("included estimated obligation lowers confidence to estimated", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({ amount: 300, name: "Confirmed" }),
        obligation({
          amount: 150,
          certainty: "estimated",
          name: "Estimated",
        }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 550);
  assert.equal(result.confidence, "estimated");
});

test("incomplete confidence overrides an included estimate", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({ amount: 150, certainty: "estimated" }),
        obligation({ amount: null, certainty: "unknown" }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 850);
  assert.equal(result.confidence, "incomplete");
  assert.ok(warningCodes(result).includes("UNKNOWN_OBLIGATION_AMOUNT"));
});

test("unknown in-horizon amount is not fabricated and makes confidence incomplete", () => {
  const unknown = obligation({
    amount: null,
    certainty: "unknown",
    name: "Amex",
  });
  const result = calculate(
    planning({
      obligations: [
        obligation({ amount: 300, name: "Confirmed" }),
        unknown,
      ],
    }),
  );

  assert.equal(result.safeToSpend, 700);
  assert.equal(result.confidence, "incomplete");
  assert.equal(result.breakdown.obligations[1].included, false);
  assert.ok(warningCodes(result).includes("UNKNOWN_OBLIGATION_AMOUNT"));
});

test("unknown obligation without a date makes confidence incomplete", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({
          amount: null,
          certainty: "unknown",
          dueDate: null,
          name: "Unknown date",
        }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 1000);
  assert.equal(result.confidence, "incomplete");
  assert.ok(warningCodes(result).includes("UNKNOWN_OBLIGATION_DATE"));
  assert.ok(warningCodes(result).includes("UNKNOWN_OBLIGATION_AMOUNT"));
});

test("unknown obligation known to be after payday does not lower confidence", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({
          amount: null,
          certainty: "unknown",
          dueDate: "2026-08-25",
          name: "Later unknown",
        }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 1000);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.breakdown.obligations[0].exclusionReason,
    "AFTER_NEXT_PAYDAY",
  );
});

test("unknown obligation with a known in-horizon amount remains excluded and warned", () => {
  const result = calculate(
    planning({
      obligations: [
        obligation({
          amount: 125,
          certainty: "unknown",
          name: "Unknown certainty",
        }),
      ],
    }),
  );

  assert.equal(result.safeToSpend, 1000);
  assert.equal(result.confidence, "incomplete");
  assert.equal(result.breakdown.obligations[0].amount, 125);
  assert.equal(result.breakdown.obligations[0].included, false);
  assert.ok(warningCodes(result).includes("UNKNOWN_OBLIGATION_CERTAINTY"));
});

test("negative Safe-to-Spend remains negative", () => {
  const result = calculate(
    planning({
      currentCash: 500,
      obligations: [obligation({ amount: 650 })],
    }),
  );

  assert.equal(result.safeToSpend, -150);
});

test("exact-cent arithmetic has no floating-point accumulation drift", () => {
  const result = calculate(
    planning({
      currentCash: 500.1,
      essentialBuffer: 40.15,
      obligations: [obligation({ amount: 233.45 })],
    }),
  );

  assert.equal(result.safeToSpend, 226.5);
  assert.equal(result.breakdown.includedObligationsTotal, 233.45);
});

test("essential buffer supports zero, non-zero, and a negative resulting balance", () => {
  assert.equal(calculate(planning({ essentialBuffer: 0 })).safeToSpend, 1000);
  assert.equal(calculate(planning({ essentialBuffer: 250 })).safeToSpend, 750);
  assert.equal(
    calculate(planning({ currentCash: 100, essentialBuffer: 250 })).safeToSpend,
    -150,
  );
});

test("breakdown exactly reconstructs the result and exposes exclusions", () => {
  const result = calculate(
    planning({
      currentCash: 750.55,
      essentialBuffer: 40.15,
      obligations: [
        obligation({ amount: 100.1, name: "Included one" }),
        obligation({ amount: 50.2, name: "Included two" }),
        obligation({
          amount: 500,
          dueDate: "2026-08-21",
          name: "Excluded",
        }),
      ],
    }),
  );
  const reconstructedCents =
    toCents(result.breakdown.currentCash) -
    toCents(result.breakdown.includedObligationsTotal) -
    toCents(result.breakdown.essentialBuffer);

  assert.equal(toCents(result.safeToSpend), reconstructedCents);
  assert.equal(result.breakdown.includedObligationsTotal, 150.3);
  assert.equal(result.breakdown.obligations[2].included, false);
  assert.equal(
    result.breakdown.obligations[2].exclusionReason,
    "AFTER_NEXT_PAYDAY",
  );
});

test("same Planning state and asOf produce a deep-equal result", () => {
  const state = planning({
    currentCash: 500.1,
    essentialBuffer: 40.15,
    obligations: [
      obligation({ amount: 233.45 }),
      obligation({ amount: null, certainty: "unknown", dueDate: null }),
    ],
  });

  assert.deepEqual(calculate(state), calculate(state));
});

test("missing Planning state returns an incomplete non-numeric result", () => {
  const result = calculate(null);

  assert.equal(result.safeToSpend, null);
  assert.equal(result.confidence, "incomplete");
  assert.equal(result.horizon.start, AS_OF);
  assert.equal(result.horizon.end, null);
  assert.ok(warningCodes(result).includes("MISSING_CURRENT_CASH"));
  assert.ok(warningCodes(result).includes("MISSING_NEXT_PAYDAY"));
});

test("stale nextPayday returns incomplete instead of a misleading calculation", () => {
  const result = calculate(planning({ nextPayday: "2026-08-16" }));

  assert.equal(result.safeToSpend, null);
  assert.equal(result.confidence, "incomplete");
  assert.ok(warningCodes(result).includes("MISSING_NEXT_PAYDAY"));
});

const app = express();
app.use(express.json());
app.use("/api/planning", planningRoutes);

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

const allowAuthentication = (t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => ({ _id: id, id }),
  }));
};

const requestSafeToSpend = async (token, query = "") => {
  const response = await fetch(
    `${baseUrl}/api/planning/safe-to-spend${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return {
    body: await response.json(),
    status: response.status,
  };
};

test("Safe-to-Spend API is protected and returns incomplete defaults without Planning", async (t) => {
  const unauthenticated = await fetch(
    `${baseUrl}/api/planning/safe-to-spend`,
  );
  assert.equal(unauthenticated.status, 401);

  allowAuthentication(t);
  t.mock.method(Planning, "findOne", (filter) => {
    assert.deepEqual(filter, { user: userId });
    return { lean: async () => null };
  });
  const response = await requestSafeToSpend(tokens[userId]);

  assert.equal(response.status, 200);
  assert.equal(response.body.safeToSpend, null);
  assert.equal(response.body.confidence, "incomplete");
  assert.ok(warningCodes(response.body).includes("MISSING_CURRENT_CASH"));
  assert.ok(warningCodes(response.body).includes("MISSING_NEXT_PAYDAY"));
});

test("Safe-to-Spend API loads only the authenticated owner's Planning state", async (t) => {
  allowAuthentication(t);
  const states = new Map([
    [
      userId,
      planning({
        currentCash: 1000,
        nextPayday: "2099-08-20",
        obligations: [
          obligation({ amount: 100, dueDate: "2099-08-19" }),
        ],
      }),
    ],
    [
      otherUserId,
      {
        ...planning({
          currentCash: 2000,
          nextPayday: "2099-08-20",
          obligations: [
            obligation({ amount: 500, dueDate: "2099-08-19" }),
          ],
        }),
        user: otherUserId,
      },
    ],
  ]);
  const queriedOwners = [];

  t.mock.method(Planning, "findOne", ({ user }) => {
    queriedOwners.push(String(user));
    return { lean: async () => states.get(String(user)) || null };
  });

  const first = await requestSafeToSpend(
    tokens[userId],
    `?user=${otherUserId}`,
  );
  const second = await requestSafeToSpend(tokens[otherUserId]);

  assert.equal(first.status, 200);
  assert.equal(first.body.safeToSpend, 900);
  assert.equal(second.status, 200);
  assert.equal(second.body.safeToSpend, 1500);
  assert.deepEqual(queriedOwners, [userId, otherUserId]);
});
