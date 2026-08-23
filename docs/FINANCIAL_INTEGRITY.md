# Financial Integrity

Munmai uses JavaScript/MongoDB numeric storage; it does not use Decimal128 or a
formal double-entry accounting ledger. The controls below prevent known
precision, authorization, duplication, and concurrency failures within the
current model.

## Canonical monetary amounts

`server/utils/moneyAmount.js` is the authoritative validator for:

- income creation and update;
- personal expense creation and update;
- shared-expense creation;
- settlement creation.

An amount must:

- be a number (multipart controllers may explicitly parse a canonical numeric string);
- be finite;
- be at least `$0.01`;
- contain no more than two decimal places;
- not exceed `$100,000,000.00`.

Invalid values are rejected with HTTP 400. Values are never silently rounded or
truncated.

Precision is checked by calculating the nearest integer cent, confirming it is
a safe integer, and requiring the original numeric value to equal
`nearestCent / 100`. This rejects fractional-cent values without using a
magnitude-scaled epsilon. Mongoose schemas also apply compatible constraints as
defense in depth.

Mobile form models mirror the same minimum, precision, maximum, and error copy
for immediate feedback, while the backend remains authoritative.

## Planning and Safe-to-Spend invariants

Planning amounts use the existing dollar `Number` persistence model and
Planning-specific canonical validation. Safe-to-Spend performs its arithmetic
in integer cents so included obligations and the everyday-use buffer subtract
without floating-point accumulation drift.

The current-cycle calculation follows these invariants:

- credit limits are never treated as available cash;
- current cash comes only from the private Planning document supplied by the
  user, not from opening balances or other inferred records;
- unknown obligation amounts are not fabricated or silently included;
- negative Safe-to-Spend results are preserved rather than clamped to zero;
- recurring, amount-type, and cadence metadata do not alter current-cycle
  arithmetic;
- overdue obligations are not silently removed from the current plan.

Next-cycle preparation is an authenticated, owner-scoped preview rather than a
write. It cannot mutate the saved Planning document. One-off obligations are
not carried, fixed recurring amounts retain their current value and certainty,
and variable recurring amounts reset to `null` with `unknown` certainty. Current
cash never carries forward automatically, while the everyday-use buffer does.
Prior obligation IDs are not reused.

Munmai does not infer the user's next payday, repeatedly skip missed recurrence
intervals, or run rollover in a background job. The user supplies the next
payday, reviews the preview, explicitly applies it to the local web form, and
persists it only through the normal Planning PUT.

Planning reads, writes, Safe-to-Spend calculation, preview preparation, account
export, and account deletion are scoped to the authenticated user.

## Transaction dates

Income and personal expense create/update endpoints validate calendar dates on
the server. Valid past dates and today are accepted; malformed, impossible, and
future calendar dates are rejected without modifying a record.

Mobile additionally uses a rolling 12-month picker boundary and asks for
confirmation when a date is more than 90 days old. Those UX guardrails do not
replace backend validation.

Shared expenses currently use server creation timestamps and do not persist a
client-controlled transaction date.

## Shared-expense enforcement

Shared expenses require:

- an authenticated user;
- a valid Space and active membership;
- an actor who is the payer or one of the participants;
- an active-member payer;
- unique active-member participants including the payer;
- a canonical amount large enough to allocate at least one cent per participant;
- a valid `Idempotency-Key`.

The server converts the total to integer cents and allocates base cents plus any
remainder deterministically. For example, a `$10.00` three-person split may be
persisted as `$3.34`, `$3.33`, and `$3.33`. The Activity feed and Space UI show
those persisted split rows exactly; clients must not recalculate them or assume
the payer receives a remainder.

Expense and split documents are written in one MongoDB transaction. Transient
transaction failures are retried within a bounded attempt count. Unsupported
standalone MongoDB transactions fail safely instead of partially writing data.

## Settlement enforcement

A settlement requires:

- an authenticated active Space member;
- an actor who is one of the two settlement participants;
- distinct active-member participants;
- a canonical amount;
- a valid `Idempotency-Key`;
- a current outstanding balance in the submitted direction;
- an amount no greater than that outstanding balance.

The service increments a Space settlement version, recalculates raw balances,
and writes the settlement inside one MongoDB transaction. No-balance,
wrong-direction, excessive, stale/concurrent, and conflicting-idempotency
requests are rejected. A valid replay returns the original result without
creating a duplicate settlement.

## Activity authorization

`GET /api/activity` always scopes personal income and expenses to the
authenticated user. Shared expenses and settlements are queried only for Spaces
returned by active `GroupMembership` records. Pending, declined, inactive, or
absent membership does not expose Space activity.

Shared Activity events include exact persisted splits, payer/current-user
markers, current-user share when one exists, and their Space destination.

## Protected supporting documents

Expense receipts and income proofs:

- accept only configured JPEG, PNG, and PDF uploads;
- use bounded file sizes and generated stored filenames;
- are not exposed through static file serving;
- require authentication and record ownership for retrieval;
- clean rejected/replaced/deleted files within the guarded upload directory.

Mobile creation/upload is intentionally two-phase. A failed upload retains the
created transaction ID so retry uploads only the attachment and cannot create a
second transaction.

## Integration database requirements

Shared-expense, settlement, Activity authorization, and real password-reset
persistence tests use `MONGO_TRANSACTION_TEST_URI`. It must identify a
disposable transaction-capable replica set. The standalone rollback regression
uses `MONGO_STANDALONE_TEST_URI`.

See [TESTING.md](TESTING.md).
