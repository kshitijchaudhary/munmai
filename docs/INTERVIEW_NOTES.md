# Munmai Interview Notes

Interview-ready talking points for technical and product conversations.

---

## Project Summary

**30-second explanation:**

Munmai is a full-stack financial clarity app I built with the MERN stack. It tracks income, expenses, receipts, debts, shared group expenses, and reviewed CSV/PDF bank statement imports. Every import is review-before-commit - no automatic record creation. It has a standalone Receipt Inbox with protected file access, duplicate detection across imports, an import history audit trail with safe revert, and trust and legal transparency pages. It's deployed on Vercel, Render, and MongoDB Atlas.

**60-second explanation:**

Munmai solves a problem I experienced firsthand: personal money is scattered across bank apps, email receipts, messaging threads for shared costs, and manual spreadsheets for debt tracking. I built one app that brings all of it together.

The core idea is review-before-commit. When you upload a CSV or PDF bank statement, rows go into a review queue - not straight into your records. You classify, edit, and confirm. Duplicate fingerprints prevent importing the same row twice. Import history keeps an audit trail, and you can safely revert a batch if needed.

The Receipt Inbox stores files server-side with authenticated access, not public URLs. Groups handle shared expenses and settlements with netted balances. Tax Pack organizes deductible expenses. Dark mode, trust pages, and receipt coverage tracking round out the product.

---

## Problem Munmai Solves

Personal finance tools tend to fragment your financial picture:

- **Income and expense confusion.** Bank apps show transactions but don't help you categorize, review, or connect them to budgets or receipts.
- **Receipts are scattered everywhere.** Email inboxes, camera rolls, file folders. When it's tax time, finding a receipt from six months ago is painful.
- **Bank statement imports need review.** A CSV row might be a duplicate, a transfer, a refund, or miscategorized. Blind auto-import pollutes records.
- **Shared money gets hard to track.** Roommates, trips, split bills - keeping track of who owes whom across multiple expenses and partial settlements is messy without a group balance engine.
- **Debt pressure is unclear.** You might have five debts but no clear view of total burden, monthly pressure, or what's due soon.

Munmai addresses each of these with purpose-built features, not generic data entry forms.

---

## Architecture Explanation

**Frontend:** React with Vite for fast builds. Tailwind CSS for utility-first styling with dark/light mode support via class-based toggling. Axios for API calls with JWT interceptors. Recharts for dashboard charts. Page-level routes with reusable shared components (sidebar, legal footer, theme toggle, protected routes).

**Backend:** Node.js + Express.js with a route -> controller -> service -> model layered architecture. MongoDB with Mongoose for schema validation and query building. JWT authentication middleware attaches the authenticated user object to every protected request.

**Data ownership:** Every personal record - income, expenses, receipts, liabilities, imports - is queried with `userId` filtering from the JWT payload. Group records gate access through active membership checks. Receipt files are streamed through authenticated API routes, never exposed as public static URLs.

**Import system:** CSV uploads create batches and rows in a pending-review state. Users classify, edit, and commit. PDF uploads go through a preview step where parsed rows can be reviewed before selective import. Duplicate fingerprints prevent re-import. Import history stores completed batches with archive and revert workflows.

---

## Strong Technical Decisions

**Review-before-commit imports.** I chose this over auto-import because bank data is unreliable. A row might be a refund, a duplicate, or belong to a different account. Requiring user review before any financial record is created prevents data corruption.

**Duplicate detection using fingerprints.** Each import row generates a fingerprint from date, amount, and description. When a new import arrives, the system checks against existing fingerprints. Duplicates are explicitly skipped and flagged, not silently dropped or counted as errors.

**Import history and audit trail.** Every import batch is preserved in history with full row visibility, even after archiving. Users can expand any past batch to see exactly what was imported, skipped, or errored.

**Safe revert workflow.** Reverting an import removes the created financial records but keeps the import history intact. The batch status changes to "reverted" and the audit trail remains. No data is permanently lost.

**Secure receipt access instead of public URLs.** Receipt files are stored server-side and streamed through authenticated API routes with user-scoped access checks. This prevents direct file enumeration and protects potentially sensitive receipt content.

**Separating Receipt Inbox from Expenses.** Receipts in the inbox are standalone documents with their own metadata, search, and lifecycle. Expense receipts are references. This separation keeps the receipt workflow clean without forcing every receipt to be immediately linked to an expense.

The standalone Receipt Inbox is intentionally separate from expense receipts for now; automatic receipt-to-expense linking is deferred.

**Deferring OCR/AI until the document lifecycle is stable.** I chose to build the full document lifecycle first - upload, store, view, edit, archive - before adding extraction intelligence. An AI-parsed receipt with a broken lifecycle is less useful than a manually-tagged receipt with a working lifecycle.

---

## Challenges and Solutions

**Handling duplicate imports.** The same bank charge can appear across two statements. Solution: fingerprint-based duplicate detection that explicitly marks duplicates as skipped, not errors.

**Preventing accidental import damage.** Committing an import creates real financial records. Solution: review-before-commit with classification, skip, and undo-skip. Users see a summary before anything changes. Revert is always available.

**Securing uploaded receipt files.** Exposing file URLs directly would let anyone enumerate uploads. Solution: authenticated API route streams files as blobs. The frontend opens them via `window.open` with a short-lived object URL.

**Keeping user data scoped correctly.** Every MongoDB query on personal collections includes the authenticated user's ID from the JWT payload. Group queries check membership. There is no endpoint that returns data across users.

**Making financial features understandable in the UI.** Finance UIs can feel overwhelming. Solution: each feature gets its own page with clear summaries at the top. Import summaries show exactly what happened. Group balances show netted amounts. Debt cards show progress toward zero.

---

## Interview Q&A

### What is Munmai?

Munmai is a full-stack MERN app for tracking personal and shared finances, including income, expenses, receipts, debts, CSV/PDF imports, group settlements, and tax-oriented reporting. Every import goes through a review-before-commit workflow with duplicate detection and safe revert.

### Why did you build it?

I built it because personal finance tools split important context across different apps - transactions in one place, receipts in another, shared expenses in messaging threads, debts in spreadsheets. I wanted one system where everything connects, and where imports don't blindly alter records.

### What was the hardest part?

Keeping import workflows safe and understandable. A single mistaken import could create dozens of bad financial records. I designed the entire system around review-before-commit, duplicate fingerprints, import history, and revert - and I had to make all of that feel simple in the UI.

### How did you handle authentication?

JWT-based authentication. The backend generates a signed token on login. An Axios interceptor on the frontend attaches it to every request. Expired tokens are detected client-side and redirect to login with a session-expired message. Protected routes use middleware that decodes and attaches the user to the request object.

### How did you protect user-specific data?

Every personal model query filters by the authenticated user's ID from the JWT. Group resources check active membership. Receipt files are streamed through authenticated routes - never served from a public directory. There is no endpoint that can return data belonging to another user.

### How do imports work?

You upload a CSV or text-based PDF bank statement. CSV rows go into a review queue where you classify each row as income, expense, debt payment, transfer, or ignore. PDF rows are previewed with parsed data and confidence levels - you select which rows to import. When you commit, the system creates actual financial records and stores the import in history. Duplicate fingerprints prevent re-importing the same data.

### How does duplicate detection work?

Each import row generates a fingerprint from its date, amount, and description. Before creating new records, the system checks these fingerprints against all previously imported rows. Matches are skipped with a "duplicate skipped" status rather than generating errors or silently doubling up.

### How does receipt upload work?

Receipts are uploaded via a multipart form with optional metadata - vendor, amount, purchase date, category, tags, notes. The file is stored server-side. When you view a receipt, the backend streams it through an authenticated route. The frontend creates a blob URL and opens it in a new tab. You can edit metadata, archive receipts, and see receipt coverage against tracked expenses.

### Why did you not add AI/OCR yet?

I chose to build the full document lifecycle first - upload, store, view, edit, search, filter, archive - before adding extraction intelligence. A working manual flow with a reliable lifecycle is more valuable than an AI-parsed receipt that you can't properly manage after extraction. OCR and AI are on the roadmap once the foundation is stable.

### What would you improve next?

OCR receipt extraction to auto-fill metadata. Receipt-to-expense linking to close the coverage gap. Persistent cloud object storage for uploaded files. Country-aware tax packs. Bank sync. And mobile support for on-the-go receipt capture.

### How is this different from a basic CRUD app?

Munmai isn't just create/read/update/delete. It has multi-step workflows - CSV import review queue, PDF preview with row selection, commit with fingerprint checking. It has audit trails - import history with expandable rows, archive, and revert. It has access control - user-scoped data and group membership gating. It has a document lifecycle - upload, protect, stream, edit, archive. And it makes financial concepts like net balance, debt pressure, and settlement netting understandable in UI.

---

## Deferred Features

- OCR receipt extraction for automated metadata population.
- AI-powered receipt parsing and categorization.
- Receipt-to-expense linking for automatic coverage tracking.
- Subscription and billing support.
- Utility tools: PDF compression, JPG-to-PDF conversion.
- Direct bank sync via open banking APIs.
- Full tax filing engine with jurisdiction-specific rules.
- Mobile app for on-the-go receipt capture and quick expense entry.
