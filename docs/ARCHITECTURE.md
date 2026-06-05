# Munmai Technical Architecture

Munmai is a production MERN financial clarity application. It is split into a
React/Vite client, a Node/Express API, and MongoDB collections managed through
Mongoose. The application covers personal transactions, receipts, monthly
budget control, debt tracking, reviewed imports, shared groups, settlements,
opening balances, tax-oriented reporting, and account management.

## System Context

```text
Browser
  |
  | React Router pages, AuthProvider, Axios API helpers
  v
Vercel frontend
  |
  | HTTPS JSON / multipart requests
  v
Render Express API
  |
  | Mongoose queries and aggregations
  v
MongoDB Atlas

Render persistent disk
  |
  v
Receipt uploads under UPLOAD_DIR
```

## Repository Layout

```text
client/
  src/
    api/          Axios client and API-specific helpers
    components/   Shared form, modal, navigation, group, import, and account UI
    context/      Auth and theme providers
    hooks/        Theme access hook
    pages/        Route-level React screens
    utils/        Token, CSV, telemetry, and PDF export helpers
  fixtures/       CSV QA fixtures
  scripts/        Frontend CSV QA script

server/
  controllers/    HTTP request/response orchestration
  middleware/     JWT auth, error telemetry, uploads
  models/         Mongoose schemas and indexes
  routes/         Express route modules
  services/       Business logic for complex domains
  services/import/ PDF and CSV import helpers
  scripts/        Mongo JSON backup utility
  uploads/        Local development receipt upload directory

docs/
  screenshots/    Product screenshots
  *.md            Product, demo, interview, deployment, and architecture docs
```

## Runtime Stack

Frontend:
- React 19 with functional components and hooks.
- Vite for local development and production builds.
- React Router 7 for client-side routing.
- Tailwind CSS utilities plus app-level dark-mode overrides.
- Axios for API calls.
- Recharts for dashboard visualizations.
- jsPDF and jspdf-autotable for monthly summary PDF export.

Backend:
- Node.js with native ES modules.
- Express 5 API.
- MongoDB through Mongoose 9.
- JWT authentication with `jsonwebtoken`.
- Password hashing with `bcrypt`.
- SMTP email delivery through `nodemailer`.
- Multipart upload handling through `multer`.
- PDF text extraction through `pdf-parse`.

Deployment:
- Frontend: Vercel from `client/`.
- Backend: Render from `server/`.
- Database: MongoDB Atlas.
- Receipt files: Render persistent disk mounted at `UPLOAD_DIR`.

## Backend Boot Flow

`server/server.js` is the API entry point.

Startup sequence:
1. Load environment variables with `dotenv`.
2. Require `MONGO_URI` and `JWT_SECRET`.
3. Create the upload directory through `ensureUploadDir()`.
4. Configure Express security/runtime basics:
   - disable `x-powered-by`
   - trust proxy
   - attach `X-Request-Id`
   - optional HTTPS redirect when `FORCE_HTTPS=true`
   - CORS allowlist from localhost, `CLIENT_URL`, and `CLIENT_ORIGINS`
   - JSON and URL-encoded body limits from `REQUEST_BODY_LIMIT`
5. Register `/api/health`, root text response, route modules, and error handler.
6. Connect to MongoDB and start listening on `PORT`.

Current route mounts:

```text
/api/auth              authRoutes
/api/income            incomeRoutes
/api/expenses          expenseRoutes
/api/receipts          receiptRoutes
/api/receipt-inbox     receiptInboxRoutes
/api/users             userRoutes
/api                   groupMembershipRoutes
/api/dashboard         dashboardRoutes
/api/transactions      transactionRoutes
/api/telemetry         telemetryRoutes
/api/groups            groupRoutes
/api/shared-expenses   sharedExpenseRoutes
/api/opening-balances  openingBalanceRoutes
/api/opening-balance   personalOpeningBalanceRoutes
/api/budget            budgetRoutes
/api/liabilities       liabilityRoutes
/api/imports           importRoutes
```

## Backend Layering

The backend uses a pragmatic route/controller/service/model structure.

```text
routes -> controllers -> services -> models -> MongoDB
```

Routes:
- Own URL structure and route-level middleware.
- Most protected route modules call `router.use(protect)`.

Controllers:
- Validate HTTP-specific input.
- Normalize request payloads.
- Return status codes and JSON/blob/file responses.
- Delegate complex business rules to services where those services exist.

Services:
- Own domain logic for budgets, dashboard shared balances, group memberships,
  group summaries, shared expenses, settlements, liabilities, imports, and
  personal opening balances.
- Throw errors with `statusCode` for the centralized error middleware or local
  controller error handling.

Models:
- Define collection shape, validation, relationships, and indexes.
- Most personal records store either `userId` or `user`.
- Group records use `group`, `groupId`, membership status, and legacy `members`
  arrays.

## API Surface

Auth:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/resend-verification
POST   /api/auth/forgot-password
POST   /api/auth/reset-password/:token
GET    /api/auth/verify-email
GET    /api/auth/export-data
DELETE /api/auth/account
```

User profile:

```text
GET   /api/users/me
PUT   /api/users/me
PATCH /api/users/profile
```

Personal money:

```text
GET    /api/income
POST   /api/income
PUT    /api/income/:id
DELETE /api/income/:id

GET    /api/expenses
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id

GET    /api/receipts/:expenseId
POST   /api/transactions/import
```

Receipt Inbox:

```text
POST   /api/receipt-inbox
GET    /api/receipt-inbox
GET    /api/receipt-inbox/:receiptId
PUT    /api/receipt-inbox/:receiptId
DELETE /api/receipt-inbox/:receiptId
GET    /api/receipt-inbox/:receiptId/file
```

Dashboard, budget, opening balance, and tax pack:

```text
GET /api/dashboard/summary
GET /api/dashboard/tax-pack/summary
GET /api/dashboard/tax-pack/export

GET /api/budget
PUT /api/budget

GET /api/opening-balance
PUT /api/opening-balance
```

Debt Reality:

```text
GET    /api/liabilities
POST   /api/liabilities
GET    /api/liabilities/summary
GET    /api/liabilities/:id/payments
POST   /api/liabilities/:id/payments
PUT    /api/liabilities/:id
DELETE /api/liabilities/:id
```

Imports:

```text
POST   /api/imports/csv
POST   /api/imports/bank/pdf/preview
POST   /api/imports/bank/pdf/confirm
GET    /api/imports
GET    /api/imports/:batchId/rows
PUT    /api/imports/rows/:rowId
POST   /api/imports/:batchId/commit
DELETE /api/imports/:batchId

GET   /api/imports/history/summary
GET   /api/imports/history
GET   /api/imports/history/:batchId
GET   /api/imports/history/:batchId/rows
PATCH /api/imports/history/:batchId/archive
POST  /api/imports/history/:batchId/revert
```

Groups, memberships, expenses, balances, and settlements:

```text
GET    /api/groups
POST   /api/groups
GET    /api/groups/my-invites
POST   /api/groups/invitations/:invitationId/accept
POST   /api/groups/invitations/:invitationId/decline
GET    /api/groups/:groupId/summary
GET    /api/groups/:groupId/balances
GET    /api/groups/:groupId/expenses
GET    /api/groups/:groupId/settlements
POST   /api/groups/:groupId/settlements
PUT    /api/groups/:groupId
DELETE /api/groups/:groupId
GET    /api/groups/:id
POST   /api/groups/:id/members
GET    /api/groups/:id/invitations
POST   /api/groups/:id/invitations

POST /api/shared-expenses

POST /api/groups/join
POST /api/groups/:groupId/invitations
GET  /api/groups/:groupId/memberships
POST /api/groups/:groupId/memberships/:membershipId/approve
POST /api/groups/:groupId/memberships/:membershipId/reject
GET  /api/group-invitations
POST /api/group-invitations/:invitationId/accept
POST /api/group-invitations/:invitationId/decline

POST /api/opening-balances
GET  /api/opening-balances?groupId=:groupId
```

Telemetry:

```text
POST /api/telemetry/event
POST /api/telemetry/error
```

## Data Model

User:
- `name`, `email`, `username`, `password`.
- Verification and password reset token fields.
- Unique email and username constraints.

Income:
- Personal income record scoped by `userId`.
- Amount, source, category, date, notes.
- Import metadata fields and unique partial import hash index.

Expense:
- Personal expense record scoped by `userId`.
- Amount, recipient, category, date, notes.
- Receipt URL.
- Tax fields: `expenseType`, `taxCategory`, `deductible`,
  `deductiblePercent`.
- Import metadata fields and unique partial import hash index.

Receipt:
- Standalone user-owned Receipt Inbox document record.
- Stores original filename, internal stored filename/path, MIME type, size,
  extension, vendor, amount, purchase date, category, notes, tags, status,
  optional linked expense, upload timestamp, and archive timestamp.
- Normal JSON API responses hide internal `filePath` and `storedFilename`.
- Files are served only through protected Receipt Inbox routes.

BudgetSetting:
- One monthly spending limit per user.

PersonalOpeningBalance:
- One starting money position per user.

Liability:
- User-owned debt record.
- Creditor, type, original amount, current balance, due date, minimum payment,
  planned monthly payment, frequency, status, notes.

LiabilityPayment:
- User-owned payment history record linked to a liability.

Group:
- Group name, creator, join code, and legacy `members` array.

GroupMembership:
- Group membership state keyed by group and user/email.
- Role: owner or member.
- Source: invite or join request.
- Status: pending, active, declined.
- Unique indexes prevent duplicate pending/active memberships.

SharedExpense:
- Group expense paid by a member and created by a member.

ExpenseSplit:
- Per-user split amount for a shared expense.

Settlement:
- Group payment from one member to another.

OpeningBalance:
- Group-level opening debt between two users.

ImportBatch:
- User-owned import job/history record.
- Source: CSV or PDF.
- Status, row counts, summary, archive timestamp, revert timestamp, date range,
  and commit timestamp.

ImportRow:
- User-owned reviewed row linked to an import batch.
- Raw fields, parsed fields, classification, category, linked liability,
  status, duplicate fingerprint, imported record metadata.

ImportedRecordFingerprint:
- User/import hash ledger used to detect duplicate PDF imports and legacy
  imported income/expense duplicates.
- Active imported fingerprints block duplicate re-imports. Fingerprints marked
  reverted by the explicit import revert workflow do not block intentional
  re-import of the same rows.

TelemetryEvent:
- Client events, client errors, and server errors with route, request ID,
  metadata, and optional user ID.

## Core Workflows

### Authentication And Account Lifecycle

Registration validates name, email, username, password confirmation, email
configuration, and duplicate users. Passwords are hashed with bcrypt.

Email verification:
- Raw tokens are sent by SMTP.
- Hashed tokens are stored on `User`.
- `/api/auth/verify-email` redirects to the frontend login page with success or
  failure query state.

Login:
- Verifies email and password.
- Requires verified email.
- Returns a JWT with 7 day expiration and a compact user payload.

Forgot/reset password:
- Uses a hashed secure token with 1 hour expiry.
- Sends reset links to `CLIENT_URL`.

Account export/delete:
- Exports current user, incomes, and expenses.
- Delete removes income, expenses, receipt files, and the user record.

### Personal Transactions

Income and expenses are manually created, edited, listed, and deleted through
their own route modules. Controllers validate numeric amount, required names,
category, and valid dates.

Expenses can include receipt uploads. Upload validation allows JPEG, PNG, and
PDF files. Files are stored under `UPLOAD_DIR`; the database stores a
`/uploads/<filename>` style receipt URL. Receipts are served through
`GET /api/receipts/:expenseId`, which checks expense ownership before sending
the file.

Standalone Receipt Inbox records use a separate lifecycle from expense receipt
uploads. `POST /api/receipt-inbox` stores JPG, PNG, or PDF receipt files in a
Receipt Inbox upload folder and saves optional metadata such as vendor, amount,
purchase date, category, notes, and tags. Receipt Inbox list/read/update/archive
queries are scoped to the authenticated user. `GET /api/receipt-inbox/:receiptId/file`
streams the owned file through a protected route; there is no public static
uploads route for Receipt Inbox files.

### Dashboard And Monthly Summary

The dashboard API aggregates all-time personal income, expenses, category
breakdown, and shared money summary. The frontend dashboard combines that API
with direct income, expense, group, budget, debt, and opening-balance calls to
render the main financial overview.

Monthly Summary is currently computed client-side from:
- `/api/income`
- `/api/expenses`
- `/api/budget`
- `/api/liabilities/summary`

It calculates selected-month income, expense, net flow, category breakdown,
import source breakdown, budget status, and debt pressure indicators.

### Monthly Control

`BudgetSetting` stores one monthly spending limit per user. The budget service:
- calculates current month date range,
- aggregates current-month expenses,
- identifies top spending category,
- calculates remaining budget, percent used, daily safe spend, and status.

Status values:
- `no_budget`
- `safe`
- `warning`
- `over`

### Debt Reality

Debt records live in `Liability`; payment history lives in `LiabilityPayment`.
Recording a payment:
1. Validates liability ownership.
2. Creates a payment record.
3. Reduces `currentBalance`.
4. Marks the liability `paid` when balance reaches zero.

Summary calculations return active debt, paid debt, due-soon counts and amount,
monthly debt pressure, and highest balance liability.

### Import Review Queue

CSV import is review-first:
1. Frontend uploads a CSV file to `/api/imports/csv`.
2. Backend parses headers and rows in memory.
3. Backend creates an `ImportBatch` and `ImportRow` records with suggestions.
4. User reviews rows, sets classification/category/debt link, skips rows, or
   fixes fields.
5. Commit creates Income, Expense, LiabilityPayment, or ignored/transfer markers.
6. Batch counts and status are synchronized after updates and commits.

CSV classifications:
- `income`
- `expense`
- `debt_payment`
- `transfer`
- `ignore`
- `unclassified`

PDF import has a separate path:
1. Frontend uploads a PDF bank statement to preview.
2. Backend validates PDF signature and extracts readable text.
3. Parser detects candidate transaction rows using date, money, optional balance,
   and keyword heuristics.
4. Frontend lets the user select and adjust parsed rows.
5. Confirm creates an `ImportBatch`, history rows, income/expense records, and
   imported fingerprints immediately.
6. Duplicate hashes are skipped and stored in history.

### Groups And Shared Money

Groups maintain both:
- legacy `Group.members`, and
- canonical `GroupMembership` records.

The service layer preserves backward compatibility by falling back to legacy
membership checks where needed.

Group creation:
- Validates name and member IDs.
- Adds the creator.
- Generates a unique join code.
- Creates an active owner membership.

Invitations and join requests:
- Members can invite by email.
- Users can request to join with a join code.
- Owners approve or reject join requests.
- Accepting an invitation adds the user to `Group.members` and activates a
  membership record.

Shared expenses:
- Active group members can create shared expenses.
- `paidBy` and all participants must be active members.
- Splits are equal by participant count.

Settlements:
- Active members can record payments between two active members.
- Settlements are used to reduce net balances.

Balance engine:
- Shared expense splits create debts from participant to payer.
- Settlements create reverse entries from recipient to payer.
- Reverse balances are netted into a minimal owed list.
- User references are hydrated for frontend display.

Group summaries combine expense total/count, settlement total/count, netted
balances, and current user's owed/owing totals.

### Tax Pack

Tax Pack uses non-personal expenses for a selected tax year. It tracks:
- business/mixed expense totals,
- deductible amount,
- receipt coverage,
- review readiness,
- deductible amount by tax category,
- import source counts.

CSV export returns deductible expenses with receipt links resolved against
`SERVER_URL` when available.

### Telemetry And Error Reporting

Frontend:
- `PageTracker` posts page view events.
- `ErrorBoundary` posts client render errors.
- Auth pages and account tools post selected product events/errors.

Backend:
- `errorHandler` records server errors as `TelemetryEvent` records.
- Every request gets an `X-Request-Id`, which is included in server error
  responses and telemetry metadata.

Telemetry write failures are logged but do not fail user requests.

## Frontend Architecture

`client/src/main.jsx` renders `App` under React `StrictMode`.

`App.jsx` composes:
- `ThemeProvider`
- `AuthProvider`
- `ErrorBoundary`
- `BrowserRouter`
- `PageTracker`
- route definitions

Authentication state:
- Stored in `localStorage` under `user`.
- Validated by decoding JWT expiry on startup and before protected navigation.
- `AuthProvider` exposes `{ user, login, logout, loading }`.

API client:
- `api/axios.js` creates a shared Axios instance.
- `api/baseUrl.js` resolves `VITE_API_URL`, local fallback, or same-origin API.
- Request interceptor attaches `Authorization: Bearer <token>`.
- Expired JWTs are removed from localStorage and redirect to
  `/login?session=expired`.
- 401 token failures also clear auth state and redirect.

Theme:
- Stored in `localStorage` under `munmai-theme`.
- Applies `.dark` class and `data-theme` to `document.documentElement`.

Frontend route map:

```text
/login                    Login
/register                 Register
/forgot-password          ForgotPassword
/reset-password/:token    ResetPassword
/privacy                  PrivacyPolicy
/terms                    TermsPage
/what-we-store            WhatWeStore
/dashboard                Dashboard
/money/transactions       MoneyTransactions
/money/receipts           MoneyReceipts
/money/tax-pack           MoneyTaxPack
/imports                  ImportReview
/monthly-summary          MonthlySummary
/opening-balance          OpeningBalance
/debt-reality             Liabilities
/groups                   Groups
/group-invitations        GroupInvitations
/groups/:groupId/summary  GroupSummary
/groups/:groupId          GroupSummary
/profile                  Profile
/settings                 Settings
/                         redirect to /dashboard
```

Major page responsibilities:
- `Dashboard`: all-time and month-filtered overview, charts, Monthly Control,
  Debt Reality preview, shared money, onboarding checklist.
- `MoneyTransactions`: income/expense table, add/edit/delete flow, inline CSV
  import helper, receipt viewing.
- `MoneyReceipts`: standalone Receipt Inbox upload/search/filter/edit/archive
  workflow plus receipt coverage summary for tracked expenses.
- `MoneyTaxPack`: tax year summary and CSV export.
- `ImportReview`: CSV batch review queue, PDF preview/confirm flow, import
  history, debt linking for payment rows.
- `MonthlySummary`: selected-month reporting from personal records.
- `OpeningBalance`: personal starting balance CRUD.
- `Liabilities`: debt CRUD, payment recording, active/paid filtering, summaries.
- `Groups`: group list, create group, join by code, group management.
- `GroupInvitations`: current user's pending invitations.
- `GroupSummary`: group overview, expenses, balances, settlements, members,
  invitations, join request approvals, owner group management.
- `Profile`: profile read/update.
- `Settings`: account profile display, theme preference, legal/data links.

Shared UI components:
- `Sidebar`: primary navigation and logout.
- `Modal`: shared modal shell.
- `AddTransaction`: income/expense create/edit form with receipt support.
- `ImportTransactions`: older inline CSV import flow for direct transaction import.
- `SharedExpenseForm`, `SettlementForm`, `OpeningBalanceForm`: group money forms.
- `GroupForm`, `GroupInvitationForm`, `JoinGroupModal`, `GroupManageModal`:
  group creation and membership UI.
- `AccountTools`: export account data and delete account.
- `ErrorBoundary`, `PageTracker`: observability.
- `ThemeToggle`, legal layout/footer helpers.

## Security And Data Ownership

Authentication:
- JWT is required for protected API routes.
- Backend `protect` middleware verifies tokens and loads the user excluding
  password.
- Frontend proactively expires stale JWTs.

Personal data isolation:
- Income and expenses query by `userId`.
- Budget, liabilities, imports, and personal opening balance query by `user`.
- Expense receipt download checks expense ownership before sending a file.
- Receipt Inbox download checks standalone receipt ownership before sending a
  file and hides internal file paths from normal JSON responses.

Group data isolation:
- Group reads require membership.
- Summary, balances, expense history, and settlement history use active
  membership checks.
- Owner-only operations include group update/delete and join request decisions.

Transport and browser boundaries:
- CORS is restricted to configured origins.
- HTTPS redirect can be forced behind Render proxy.
- Password and verification tokens are not exposed in auth payloads.

File upload controls:
- Expense receipt uploads restrict mime type and file extension.
- Receipt Inbox uploads restrict mime type and file extension, store files with
  random internal filenames, and serve files only through authenticated routes.
- CSV and PDF import uploads use memory storage and size limits.
- Receipt file paths are resolved through `path.basename()` to avoid trusting
  user-controlled paths.

## Validation And Error Handling

Validation is mostly explicit and local to controllers/services:
- Required fields, ObjectId checks, enums, dates, money ranges, decimal precision.
- Mongoose schema validation and indexes enforce additional constraints.
- Multer validates upload type and size.

Async error handling:
- Many controllers use local `asyncHandler`.
- Service errors use `error.statusCode`.
- Central `errorHandler` logs server errors and returns JSON with request ID.

## Deployment Configuration

Root scripts:

```text
npm run dev     concurrently starts server and client
npm run build   builds client
npm start       starts server
```

Backend scripts:

```text
npm run dev       nodemon server.js
npm start         node server.js
npm run backup:json
```

Frontend scripts:

```text
npm run dev
npm run build
npm run lint
npm run preview
npm run csv:qa
```

Render:
- Uses `render.yaml`.
- Root directory: `server`.
- Build command: `npm ci`.
- Start command: `npm start`.
- Health path: `/api/health`.
- Persistent disk mounted at `/var/data/munmai`.

Vercel:
- Uses `client/vercel.json`.
- Framework: Vite.
- Output directory: `dist`.
- SPA rewrites all paths to `/index.html`.

Required production environment:
- Backend: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `CLIENT_ORIGINS`,
  `SERVER_URL`, SMTP settings, upload/body limits.
- Frontend: `VITE_API_URL`.

## Operational Tooling

Health:
- `/api/health` returns status, request ID, and timestamp.

Backups:
- `server/scripts/backupMongo.mjs` exports users, incomes, expenses, and
  telemetry events to a JSON file under `server/backups`.

Frontend CSV QA:
- `client/scripts/qaCsvImports.mjs` validates local CSV parsing and review-row
  classification against fixtures.

Lint/build:
- Client has ESLint config and Vite build.
- No dedicated backend test suite is currently present in `package.json`.

## Known Cleanup Items

These are architecture-relevant cleanup items tracked for future hardening.
They do not block the current v2.0.0 stable portfolio release:

- `server/server.js` registers `/api/health` twice.
- `server/server.js` mounts `/api/auth` twice.
- `server/routes/balanceRoutes.js` and `server/routes/settlementRoutes.js`
  exist but are not mounted directly. Equivalent group balance and settlement
  endpoints are exposed through `groupRoutes`.
- `client/src/pages/GroupDetail.jsx` appears to be legacy or unused by
  `App.jsx`; it calls older endpoints such as `/balance/:groupId` and
  `/settlements` that are not mounted in the current server entry point.
- `client/src/components/ProtectedRoute.jsx` is empty; protected routing is
  implemented inline in `App.jsx`.
- Account export/delete currently covers user, income, expenses, and receipt
  files, but newer domain collections such as liabilities, budgets, imports,
  groups, memberships, settlements, and opening balances are not included.
- `server/scripts/backupMongo.mjs` backs up only users, incomes, expenses, and
  telemetry events, and its filename still uses `finvexa`.
- `docs/AI_CONTEXT.md` is older than the current product architecture and still
  describes an earlier shared-expense phase.
- `server/utils/taxPack.js` contains reusable Tax Pack helpers, while
  `dashboardController.js` currently implements Tax Pack calculations locally.

## Scaling Considerations

Database:
- Existing compound indexes cover common user, group, import, and status lookup
  patterns.
- High-volume reporting may eventually need server-side monthly summary and
  dashboard endpoints instead of client-side aggregation from all records.

Uploads:
- Render persistent disk is enough for current receipt storage.
- Object storage should replace local disk when horizontal scaling, CDN access,
  or cross-instance file durability becomes necessary.

Imports:
- CSV parsing runs in memory and is limited to 1000 rows.
- PDF confirm is limited to 100 rows.
- Long-running or high-volume imports should move to queued/background jobs.

Observability:
- Request IDs and telemetry records exist.
- Production log aggregation, alerting, and dashboards are not yet represented
  in the repository.

Security:
- JWTs are stored in localStorage, which is simple but exposed to XSS risk.
- Consider secure HTTP-only cookie auth if the threat model expands.
- Consider rate limiting for auth, password reset, telemetry, and import
  endpoints.
