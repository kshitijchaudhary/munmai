# Munmai

A full-stack financial clarity system for tracking income, expenses, receipts, debt pressure, shared money, and reviewed CSV/PDF statement imports.

Munmai is a production-deployed MERN application built to help people understand where their money is going, what they owe, what others owe them, and how imported financial data should be reviewed before it changes their records. It includes a standalone Receipt Inbox for document storage, duplicate detection across imports, import history with safe revert, and receipt coverage tracking.

## Live Links

- Live app: [https://munmai.com](https://munmai.com)
- Backend: [https://munmai-api.onrender.com](https://munmai-api.onrender.com)
- API health: [https://munmai-api.onrender.com/api/health](https://munmai-api.onrender.com/api/health)
- GitHub repo: [https://github.com/kshitijchaudhary/munmai](https://github.com/kshitijchaudhary/munmai)

## Quick Demo Flow

1. Open the Dashboard to view personal balance, In/Out/Net summaries, Monthly Control, Debt Reality preview, and shared money.
2. Add income and expenses from the Transactions page, or upload receipts to the Receipt Inbox.
3. Use Import Statements to preview CSV statements in a review queue or preview text-based PDF bank statements and confirm selected rows.
4. Review import history with batch-level rows, duplicate detection, and safe revert if needed.
5. Track debt balances and record payments through Debt Reality.
6. Create a group, add shared expenses, record settlements, and view netted balances.
7. Review Monthly Summary for income, expenses, net flow, category breakdown, budget pace, debt pressure, and import-source counts.
8. Explore Tax Pack foundation for deductible expenses and tax-oriented data preview.

## Demo Access

A demo account can be provided upon request.


## Feature Overview

- Dashboard: all-time personal balance, In/Out/Net summaries, monthly snapshot, spending breakdown, shared money, Monthly Control, and Debt Reality preview.
- Income and expense tracking: create, view, filter, edit, and manage personal money movement.
- Receipt Inbox prototype: upload receipt images/PDFs, manage metadata (vendor, amount, purchase date, category, tags, notes), search, filter, edit, and archive.
- Receipt coverage summary: see how many expenses have linked receipts vs. those missing receipts.
- Secure receipt file access: receipt files are accessed through protected API routes, not public static uploads.
- CSV/PDF Import Statements: upload CSV bank statements into a review queue, preview text-based PDF bank statements, review parsed rows, confirm selected rows for import.
- Duplicate detection: import fingerprints prevent the same row from being imported twice.
- Import History: browse previous import batches, expand batch rows, archive batches, and safely revert confirmed imports.
- Monthly Control: set a monthly spending limit and track safe, warning, or over-budget status.
- Debt Reality: track personal debts, credit cards, loans, bills, due dates, and recorded payments.
- Shared Groups: create groups, invite users, join by code, approve join requests, add shared expenses, and view members.
- Settlements: record payments between group members and reduce outstanding balances.
- Monthly Summary: review selected-month income, expenses, net flow, category breakdown, import-source counts, budget pace, and debt pressure.
- Opening Balance: set starting money position without counting it as monthly income.
- Tax Pack foundation: track deductible expenses and export tax-oriented CSV data.
- Dark/light mode: toggle between dark and light themes across the app.
- Trust & Legal: dedicated Privacy Policy, Terms of Use, and What Munmai Stores pages accessible from the footer and authenticated Settings.

## Why I Built Munmai

Managing personal money is often confusing because income, expenses, debts, receipts, shared costs, and imported bank rows live in separate places. Shared expenses are especially easy to lose track of when friends or roommates manually settle up over time.

Munmai was built for students, workers, and everyday users who need a clear view of spending, debt pressure, and shared money without turning every financial task into a spreadsheet. CSV imports are intentionally review-first because bank rows should not automatically affect financial records without user confirmation.

## How Munmai Works

1. Add income and expenses manually from the Transactions page.
2. Upload receipts to the Receipt Inbox with optional metadata and review receipt coverage against expenses.
3. Upload a CSV or text-based PDF bank statement into Import Statements.
4. For CSV files: create a review queue, classify each row, skip or save, and commit only reviewed data.
5. For PDF files: preview parsed rows, select income/expense rows, and confirm import.
6. Duplicate fingerprints prevent re-importing the same row from a previous import.
7. Browse Import History to view past batches, expand rows, archive old batches, or safely revert confirmed imports.
8. Track monthly budget pace with Monthly Control.
9. Track debts and record debt payments through Debt Reality.
10. Manage shared group expenses, settlements, and balances with group members.
11. Review monthly trends in Monthly Summary and tax-oriented expense data in Tax Pack.

## Screenshots

![Dashboard](docs/screenshots/dashboard.png)

![Import Statements – CSV Review Queue](docs/screenshots/import-csv.png)

![Receipt Inbox](docs/screenshots/receipt-inbox.png)

![Import Statements – PDF Preview](docs/screenshots/import-statements.png)

![Import History](docs/screenshots/import-history.png)

![Debt Reality](docs/screenshots/debt-reality.png)

![Monthly Summary](docs/screenshots/monthly-summary.png)

![Group Summary](docs/screenshots/group-summary.png)

![Opening Balance](docs/screenshots/opening-balance.png)

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Recharts

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose

### Auth

- JWT authentication
- Protected API routes
- User-owned data access patterns

### Deployment

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Architecture

Munmai uses a client/server MERN structure:

- `client/`: React + Vite frontend with page-level routes, reusable components, and API helper modules.
- `server/`: Express API with route, controller, service, and Mongoose model layers.
- Protected routes use JWT auth middleware and attach the authenticated user to each request.
- Personal data such as income, expenses, receipts, budget settings, liabilities, imports, and opening balance is scoped to the authenticated user.
- Group data uses memberships to control access to shared expenses, settlements, balances, invitations, and join-code flows.
- Import statements use a review-before-commit design: CSV files create review queues with individual rows, and PDF files are previewed with parsed rows that users select before confirming. Duplicate fingerprints prevent the same row from being imported twice.
- Import History stores completed imports as batches with expandable rows, archive support, and safe revert workflows.
- Receipt Inbox stores receipt files server-side with protected file access through authenticated API routes (not public static uploads). Receipt metadata is user-scoped and supports search, filter, edit, and archive.
- Debt Reality stores liabilities separately from liability payment records so balances can be reduced over time.
- Group money calculations aggregate expense splits and settlements to produce netted balances.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a fuller system overview.

## API Module Summary

- Auth: registration, login, email verification, forgot password, reset password.
- Dashboard: personal finance summary and shared money summary.
- Income: authenticated income records.
- Expenses: authenticated expense records and receipt metadata.
- Receipt Inbox: receipt upload, metadata (vendor, amount, purchase date, category, tags, notes), search, filter, edit, archive, and protected file access.
- Groups: group creation, membership, invitations, join codes, shared expenses, summaries, and balances.
- Settlements: group settlement recording and history.
- Budget: Monthly Control budget setting and current-month spending pace.
- Liabilities / Debt Reality: debts, payment records, summaries, and debt pressure.
- Imports: CSV upload (review queue), PDF preview (parsed row review), confirm import, duplicate detection via import fingerprints, import batches, import rows, archive, and safe revert.
- Reports / Monthly Summary: read-only monthly reporting with import-source counts, built from existing income, expense, budget, and debt data.
- Opening Balance: personal starting balance used in all-time personal balance.

## Release History

- v1.2.1 Group Collaboration Polish: improved invite UX, group membership display, join code flow, and group management controls.
- v1.3.0 Monthly Control Budget MVP: added monthly spending limit tracking and budget status.
- v1.3.1 Group Join Code Hotfix: restored join-code group access after UI polish.
- v1.3.2 Budget Clarity Polish: added progress bar, daily safe spend, clearer labels, and better budget insight copy.
- v1.4.0 Debt Reality MVP: added personal liabilities, debt summaries, and payment recording.
- v1.5.0 Import Review Queue MVP: added CSV upload, row review, classification, skip row, and reviewed commit flow.
- v1.5.1 Sidebar Completion and Demo Polish: added Monthly Summary, Opening Balance, and Settings pages.
- v1.5.2 Portfolio Documentation Polish: refreshed project documentation for portfolio and interview review.
- v1.6.0 Bank Statement Preview + Dark Mode: added PDF upload, parsed-row preview, text-based statement extraction, and dark/light mode toggle.
- v1.7.0 PDF Review/Confirm Import + Duplicate Detection: added per-row type/category editing, row selection, confirm import flow, and import fingerprints for duplicate prevention.
- v1.8.0 Import History + Reporting Integration: added import history with batch rows, archive, revert workflow, and import-source counts in Monthly Summary.
- v1.8.1 Phase 2 Stabilization + Demo Cleanup: polished import history UX, receipt-import coverage summary, trust/legal pages, and Settings links.
- v1.9.0 Receipt Inbox Prototype: added standalone receipt upload, metadata management, search, filter, edit, archive, receipt coverage summary, and quick date/category/filter shortcuts.

## Local Setup

### 1. Clone

```bash
git clone https://github.com/kshitijchaudhary/munmai.git
cd munmai
```

### 2. Install dependencies

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 3. Configure environment variables

Create `server/.env` and `client/.env` using safe local values. Do not commit real secrets.

### 4. Run backend and frontend together

```bash
npm run dev
```

### 5. Run separately if needed

```bash
npm run dev --prefix server
npm run dev --prefix client
```

## Environment Variables

### Backend: `server/.env`

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
JWT_SECRET=replace_with_strong_secret
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
CLIENT_ORIGINS=http://localhost:5173,https://munmai.com
FORCE_HTTPS=false
REQUEST_BODY_LIMIT=1mb
UPLOAD_DIR=./uploads

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=example@example.com
SMTP_PASS=replace_with_smtp_password
SMTP_FROM="Munmai <no-reply@example.com>"
```

### Frontend: `client/.env`

```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment Notes

- Frontend is deployed on Vercel.
- Backend is deployed on Render.
- MongoDB runs on MongoDB Atlas.
- Receipt uploads and statement files currently use server-side storage. Production deployments should use persistent object storage (e.g., S3, Cloudflare R2) or a durable file strategy to survive restarts and deploys.
- Receipt files are accessed through protected API routes, not public static uploads. The backend streams files with user-scoped access checks.
- The backend exposes `/api/health` for health checks.

## Portfolio / Interview Value

Munmai demonstrates:

- Full-stack MERN development with real product workflows.
- JWT authentication and protected API design.
- CRUD systems with user-specific data ownership.
- Financial data modeling for transactions, groups, debts, imports, settlements, and receipt documents.
- Secure file upload and protected file access patterns (not public static uploads).
- Review-before-commit import design for both CSV queues and PDF preview/confirm flows.
- Duplicate prevention using import fingerprints.
- Audit/history workflow with batch-level rows, archive support, and safe rollback/revert.
- Trust and legal transparency pages (Privacy Policy, Terms of Use, What Munmai Stores).
- Incremental product releases with scoped MVPs and polish passes.
- Production deployment across Vercel, Render, and MongoDB Atlas.
- Practical UX decisions for financial clarity, not just data entry.

## Deferred / Future Roadmap

These features are planned for future releases but are not yet implemented:

- OCR receipt extraction for automated receipt data capture.
- AI-powered receipt parsing and categorization.
- Receipt-to-expense linking for automatic expense coverage.
- Utility tools such as PDF compression and JPG-to-PDF conversion.
- Subscriptions and billing support.
- Country-aware tax packs with configurable deduction categories.
- Direct bank sync via open banking APIs.
- Mobile app for on-the-go receipt capture and quick expense entry.

## Additional Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Demo Flow](docs/DEMO_FLOW.md)
- [Interview Notes](docs/INTERVIEW_NOTES.md)

## Author

Kshitij Chaudhary  
Full Stack Developer, Canada

## Status

- Production deployed.
- Actively developed.
- Portfolio-ready.
