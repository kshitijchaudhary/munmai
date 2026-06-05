# Munmai Demo Flow

Demo flows for portfolio walkthroughs, recruiter demos, and interview screenshares.

---

## 3-Minute Demo Flow

Quick overview covering the most important workflows.

### 1. Login (15 sec)

- Open `https://munmai.com`.
- Log in with the demo account.
- "JWT auth protects every request. All data is scoped to the authenticated user."

### 2. Dashboard (20 sec)

- Show the all-time personal balance with In/Out/Net summaries.
- Point out Monthly Control, Debt Reality preview, and shared money cards.
- "The Dashboard is a financial overview — every page feeds into it, but you don't manage details here."

### 3. Receipt Inbox (25 sec)

- Open Money → Receipts.
- Show the upload form with date shortcuts, category presets, and tags.
- Point out the receipt list with vendor/amount/status on one line.
- Click the "Reviewed" and "Archived" filter shortcuts.
- Show receipt coverage summary: "X% of expenses have receipts."

### 4. Import Statements (30 sec)

- Open Money → Import Statements.
- Go to Upload & Preview tab.
- Upload a CSV file — show how rows enter a review queue.
- Click into a batch, classify one row, skip another.
- "Rows are review-only until I commit them. No automatic changes to records."
- Switch to History tab: show import history with batch rows.
- Point out archive and revert buttons.

### 5. PDF Statement Preview (20 sec)

- Upload a text-based PDF.
- Show the parsed preview with confidence levels.
- Toggle row selection, edit a category.
- "Same review-before-commit design. Duplicate fingerprints prevent importing the same row twice."

### 6. Monthly Summary & Tax Pack (20 sec)

- Open Monthly Summary.
- Change month, show income vs expenses, category breakdown, and import-source counts.
- Open Tax Pack: show the data source card and tax-oriented expense review.
- "Tax Pack is a foundation — it surfaces deductible expenses for eventual export."

### 7. Groups & Debt Reality (20 sec)

- Open Groups: show a group summary with balances and settlements.
- Open Debt Reality: show total debt, due dates, and recorded payments.
- "Groups track shared costs. Debts track personal liabilities separately from expenses."

### 8. Trust & Legal (10 sec)

- Open Settings → scroll to Trust & Legal.
- Show links to Privacy Policy, Terms of Use, and What Munmai Stores.
- "Transparency pages explain exactly what data Munmai stores and how it's used."

---

## 7-Minute Extended Demo Flow

Deeper walkthrough with more detail for technical interviewers.

### 1. Login & Auth Context (30 sec)

- Log in, open DevTools → Application → Local Storage.
- Show the stored user object with JWT token.
- "Token is attached to every request via an Axios interceptor. Expired tokens are detected client-side and redirect to login with a session-expired message."

### 2. Dashboard Deep Dive (40 sec)

- Walk through every card: personal balance, income, expenses, net flow, shared money, Monthly Control, Debt Reality preview.
- "The Dashboard aggregates data from 6+ models. Opening Balance is excluded from monthly income calculations."
- Toggle dark mode. "Dark mode was built with Tailwind's dark: variant system."

### 3. Receipt Inbox Walkthrough (60 sec)

- Upload a receipt file (JPG/PNG/PDF).
- Fill in vendor, amount, and use the "Today" date shortcut.
- Select a category from the preset list, add tags.
- "Files are stored server-side and accessed through protected API routes — not public static uploads."
- Click "View file" to open the receipt in a new tab via a blob URL.
- Edit a receipt: change category, status, notes.
- Archive a receipt and toggle "Include archived" in filters.
- Show receipt coverage summary card.

### 4. CSV Import Review Queue (60 sec)

- Upload a bank CSV statement.
- Open the created review batch, show rows in the review panel.
- Edit a row: change date, amount, description, classification (income/expense/debt payment/transfer/ignore).
- Link a debt payment row to a liability from Debt Reality.
- Skip a row, then undo skip.
- Commit rows and show the import summary with income, expenses, debt payments, transfers, and ignored counts.
- "The import summary shows what was actually imported. The original rows stay visible in read-only mode."

### 5. PDF Statement Preview & Confirm (45 sec)

- Upload a text-based PDF bank statement.
- Show the parser summary: rows detected, income count, expense count, confidence levels.
- Toggle "Show technical preview details" to show extracted text sample and confidence breakdown.
- Select/deselect rows for import.
- Change a row's type from unknown to expense, update category.
- Click "Import Selected PDF Rows" and show the confirm result with row-by-row status.
- "Duplicate fingerprints prevent the same row from being imported twice. If a row already exists from a previous import, it shows as skipped, not an error."

### 6. Import History & Safe Revert (40 sec)

- Switch to Import History tab.
- Show the filter by source (All/CSV/PDF).
- Expand a batch to show all imported rows with status badges.
- Archive a batch: "Hidden from default history, but audit trail is preserved."
- Revert a batch: confirm the revert and show the batch status changes to reverted.
- "Revert removes the created financial records but keeps the import history. Safe, auditable, non-destructive."

### 7. Monthly Summary & Tax Pack (30 sec)

- Show income, expenses, net flow, and import-source counts for different months.
- "Import-source counts show how much came from CSV imports vs PDF imports vs manual entry."
- Open Tax Pack: show deductible expense categories and the data source breakdown.
- "Tax Pack organizes by category, not by import source, so it's ready for eventual tax-year export."

### 8. Groups, Shared Expenses & Settlements (50 sec)

- Open a group with multiple members.
- Add a shared expense, show how it splits among members.
- Show the balances section: who owes whom.
- Record a settlement payment.
- "Balances update automatically when expenses or settlements are recorded."
- Show the invite flow with join codes and email invitations.

### 9. Debt Reality & Opening Balance (30 sec)

- Show total debt, monthly pressure, due-soon count.
- Record a debt payment: "Payments reduce the liability balance over time. The full payment history is preserved."
- Open Opening Balance: "This is a starting position. It sets the baseline for all-time balance without inflating monthly income."

### 10. Settings & Trust Pages (25 sec)

- Open Settings: show Profile Details, App Preferences, Appearance toggle, and Data links.
- Scroll to Trust & Legal: click through Privacy Policy, Terms of Use, and What Munmai Stores.
- "Every page has a contextual back link. Logged-in users see 'Back to Settings.' Logged-out users see 'Back to Login.'"

---

## Interview Explanation Notes

### What problem Munmai solves

Personal money is scattered — income and expenses in bank apps, debts in separate portals, receipts in email inboxes, group expenses in messaging threads, and imported bank rows that may contain errors or duplicates. Munmai brings these together in a single review-first system.

### Why review-before-commit matters

Bank statements are messy. A CSV row might be a transfer, a refund, or a duplicate of an entry you already added manually. Automatically importing every row would pollute your records. Munmai's review queue makes you classify every row before it touches your financial data. PDF imports add a preview layer on top of that.

### Why duplicate detection matters

Without fingerprints, the same bank charge could appear across two statements and be imported twice. Munmai generates import fingerprints and marks duplicates as skipped rather than errors. This keeps totals accurate without blaming the user.

### Why secure receipt access matters

Receipts often contain personal information — vendor names, partial card numbers, addresses. Munmai stores files server-side and streams them through authenticated API routes. Files are never exposed as public static URLs.

### Why import history and revert matter

Users change their minds. An import might include a mistaken row. Rather than asking users to manually undo every record, Munmai supports batch-level revert that removes the created financial records but keeps the audit history intact. Combined with archive, this gives users control without data loss.

### What was intentionally deferred

I chose to build real, working features over AI demos:

- No OCR or AI receipt extraction yet — the Receipt Inbox is manual metadata for now.
- No automatic expense matching — receipts stay standalone until linking is implemented.
- No bank sync — imports require user-provided CSV or PDF files.
- No full tax filing engine — Tax Pack is a data organization foundation, not a filing service.
- No subscriptions or billing — the app is free during development.

---

## Deferred Features

These are planned but not yet implemented:

- OCR receipt extraction for automated receipt data capture.
- AI-powered receipt parsing and categorization.
- Receipt-to-expense linking for automatic expense coverage tracking.
- Utility tools: PDF compression, JPG-to-PDF conversion.
- Subscriptions and billing support.
- Direct bank sync via open banking APIs.
- Country-aware tax packs with configurable deduction categories.
- Full tax filing engine with jurisdiction-specific rules.
- Mobile app for on-the-go receipt capture and quick expense entry.
