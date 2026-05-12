# Munmai Interview Notes

## Why did you build Munmai?

I built Munmai because personal finance apps often split important context across separate tools: transactions, receipts, debts, shared expenses, and bank statement imports. I wanted one app that gives a clear view of personal money, shared money, debt pressure, and reviewed imports without pretending to automate everything blindly.

## What was the hardest part?

The hardest part was keeping financial workflows safe and understandable. CSV imports, group balances, and debt payments all affect financial records, so I designed them to be explicit, reviewable, and scoped to the authenticated user or group membership.

## How does CSV import work safely?

CSV uploads create import batches and import rows first. The app suggests classifications, but the user reviews and edits each row. Rows can be classified as income, expense, debt payment, transfer, or ignore. Munmai only creates actual financial records when the user commits reviewed rows.

## How does Debt Reality work?

Debt Reality stores liabilities such as friend debts, credit cards, loans, bills, and other debts. Payments are stored as separate records. When a payment is recorded, the liability balance is reduced and the debt is marked paid only when the balance reaches zero.

## How do shared balances work?

Shared expenses create split records for participants. Each participant owes the payer for their share, excluding the payer's own share. Settlements add reverse ledger entries. The balance engine aggregates and nets opposite-direction balances to show who owes whom.

## How is user data protected?

Protected API routes use JWT authentication. Personal records are queried by authenticated user ID. Group records require active group membership, and owner-only actions are restricted to group owners.

## What would you improve next?

- Add persistent cloud storage for receipts.
- Add richer monthly reports and export options.
- Add notification workflows for group invites and pending join requests.
- Improve import mapping for more bank CSV formats.
- Add automated test coverage around import commit and group balance edge cases.

## What does this project demonstrate?

- Full-stack MERN architecture.
- Authentication and authorization.
- CRUD and workflow-heavy product development.
- Financial data modeling.
- CSV import safety.
- Production deployment.
- Iterative release planning and practical UX polish.
