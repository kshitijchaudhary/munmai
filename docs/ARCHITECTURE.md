# Munmai Architecture

Munmai is a MERN financial tracking app split into a React/Vite frontend and a Node/Express/MongoDB backend.

## High-Level Structure

- `client/`: React pages, reusable UI components, API helper modules, auth context, and routing.
- `server/`: Express app, route modules, thin controllers, service-layer business logic, and Mongoose models.
- `docs/`: portfolio documentation, demo flow, interview notes, and screenshots.

## Request Flow

1. The frontend calls API helpers built on the shared Axios client.
2. JWT tokens are attached from local authenticated user state.
3. Express routes apply auth middleware for protected resources.
4. Controllers handle HTTP input/output and delegate business logic to services.
5. Services validate ownership and perform model operations.
6. Mongoose models persist records in MongoDB Atlas.

## Core Modules

### Auth

Auth handles registration, login, email verification, forgot password, reset password, and protected route access through JWT.

### Personal Money

Income and expenses are user-owned records. Dashboard, Monthly Summary, Receipts, Tax Pack, Monthly Control, and Opening Balance build on those records.

### Monthly Control

Monthly Control stores a user-specific monthly spending limit and compares it against current-month expenses. It returns status values such as `no_budget`, `safe`, `warning`, and `over`.

### Debt Reality

Debt Reality stores liabilities separately from payment records. Recording a payment creates a payment history entry, reduces current balance, and marks the liability paid only when the balance reaches zero.

### Import Review Queue

CSV imports are stored as import batches and import rows. Rows can be classified as income, expense, debt payment, transfer, ignore, or unclassified. Nothing affects financial records until the user commits reviewed rows.

### Groups and Shared Money

Groups use membership records to control access. Shared expenses create split records. Settlements reduce balances. The balance engine aggregates debts and settlements into netted group balances.

### Opening Balance

Opening Balance stores a user-specific starting money position. It is added to all-time personal balance and intentionally does not count as monthly income.

## Data Ownership

Most personal modules are scoped by authenticated user ID. Group modules validate active membership before returning group money data. Owner-only group actions are kept separate from regular member collaboration actions.

## Deployment

- Vercel hosts the React frontend.
- Render hosts the Express backend.
- MongoDB Atlas stores app data.
- `/api/health` supports service health checks.
