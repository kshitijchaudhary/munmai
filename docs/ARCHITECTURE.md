# Munmai Architecture

## System context

```text
React/Vite web ─┐
                ├── HTTPS/JSON or multipart ── Express API ── MongoDB
Expo mobile ────┘                                 │
                                                 ├── protected upload storage
                                                 └── SMTP
```

The API is shared by the web and mobile clients. Clients do not send ownership
identifiers for personal records; the authenticated user is resolved from the
JWT. Shared operations additionally require active Space membership.

## Repository boundaries

- `server/`: Express entry point, routes, controllers, services, Mongoose
  models, validation utilities, scripts, and Node tests.
- `client/`: React/Vite SPA, browser authentication context, web-only review
  and reporting workflows, and Node-native tests.
- `mobile/`: Expo Router application, platform-specific session persistence, API modules,
  domain parsers/models, request coordinators, screens, and Node-native tests.
- `docs/`: maintained architecture, security, testing, deployment, and release
  guidance.

## API boot and middleware

`server/server.js`:

1. Loads environment configuration and requires `MONGO_URI` and `JWT_SECRET`.
2. creates the upload directory;
3. configures trusted proxy handling, request IDs, optional HTTPS redirects,
   CORS, and bounded JSON/form bodies;
4. mounts public authentication and protected financial routes;
5. applies centralized error handling;
6. connects to MongoDB and starts listening.

The API health route is `GET /api/health`.

## Authentication boundary

Public authentication endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/resend-verification
POST /api/auth/forgot-password
POST /api/auth/reset-password/:token
GET  /api/auth/verify-email
```

Protected endpoints use `Authorization: Bearer <JWT>`. The middleware verifies
the signature, loads the referenced user, and returns 401 when the token is
invalid or its user no longer exists. JWTs expire after seven days.

Native mobile sessions persist the token/profile through SecureStore. Expo web
uses versioned browser storage. API 401 handling coordinates a single session
failure; 403 does not sign the user out.

See [AUTHENTICATION.md](AUTHENTICATION.md).

## Personal financial data

Income and expenses are owner-scoped Mongoose records. Their create/update
paths use shared server-authoritative amount and transaction-date validation.
Expense receipts and income proofs are uploaded with multipart requests and
retrieved only through authenticated, ownership-checked routes.

The API stores protected attachment paths but does not mount the upload
directory as public static content.

Dashboard and tax-pack endpoints aggregate personal and shared records for the
current user. The web client additionally exposes imports, budgets, liabilities,
opening balances, monthly review, receipts, and tax-oriented CSV/PDF exports.

## Activity feed

`GET /api/activity` returns one sorted event array containing:

- personal income;
- personal expenses;
- shared expenses;
- settlements.

The server queries personal records by authenticated user ID. Shared records
are included only for Space IDs obtained from `GroupMembership` rows whose
status is `active`. Pending, declined, and inactive membership do not grant feed
access.

Shared-expense events include Space identity, payer, current-user share when
present, and the persisted split rows. The mobile client displays those exact
values; it does not recalculate splits. Events use deterministic date-then-ID
sorting and destination routes.

## Spaces and shared money

Groups are presented as Spaces in the mobile UI. Active membership gates
summaries, balances, expense history, settlement history, and Activity data.

Shared-expense creation:

1. validates group, payer, participants, canonical amount, and idempotency key;
2. verifies active membership and that the actor is involved;
3. allocates integer cents deterministically;
4. writes the expense and all split documents in one MongoDB transaction;
5. returns persisted split amounts.

Settlement creation:

1. validates participants, canonical amount, active membership, actor
   involvement, and idempotency key;
2. locks the Space settlement version inside a transaction;
3. recalculates the current pair balance;
4. rejects wrong-direction, excessive, or no-balance settlements;
5. writes the settlement atomically.

Both workflows retry transient transaction errors, reject conflicting
idempotency-key reuse, and require a transaction-capable MongoDB deployment.

See [FINANCIAL_INTEGRITY.md](FINANCIAL_INTEGRITY.md).

## Web routes

The React Router SPA includes public login, registration, forgot/reset password,
privacy, terms, and storage-information routes. Protected routes cover
dashboard, money transactions/receipts/tax pack, imports, monthly summary,
opening balance, debt, Spaces, invitations, profile, and settings.

Vercel rewrites all SPA paths to `index.html`.

## Mobile routes

Expo Router uses `mobile/src/app`. Route groups organize code but never appear
in public URLs.

The authenticated tabs are Today (`/`), Activity (`/transactions`), Capture
(`/add`), Insights (`/analytics`), and Spaces (`/groups`). Account (`/more`) and
nested forms/details are hidden from the tab contract.

Activity-originated Space views live under `/transactions/spaces/:groupId`;
Spaces-originated views live under `/groups/:groupId`. This preserves the
correct Back destination without duplicating domain screens.

See [mobile/README.md](../mobile/README.md).

## Deployment topology

- Render runs `server/`, mounts persistent storage at
  `/var/data/munmai/uploads`, and checks `/api/health`.
- MongoDB Atlas or another transaction-capable MongoDB deployment stores data.
- Vercel builds `client/` and serves the SPA.
- Expo/EAS builds mobile binaries; mobile calls the same Render API.
- SMTP sends verification and reset email. Reset links always open the web
  client derived from `CLIENT_URL`.

See [DEPLOYMENT.md](../DEPLOYMENT.md).
