# Changelog

All notable Munmai release changes are documented here.

## v1.8.1 — Phase 2 Stabilization + Demo Cleanup

### Added
- Added safe import revert workflow for confirmed CSV/PDF import batches.
- Added reverted import audit tracking with `revertedAt`, `revertedBy`, and revert summary details.
- Added support for reverted import rows and reverted import fingerprints.
- Added Import Complete state after PDF import confirmation.
- Added post-import actions for viewing transactions, viewing import history, and importing another statement.
- Added PDF preview clear/start-over actions.
- Added unified CSV/PDF statement upload flow.
- Added tabbed Import Statements workflow: Upload & Preview, Review Queue, and History.

### Improved
- Improved Import Statements page layout for demo readiness.
- Simplified PDF preview and import completion flow.
- Hid technical PDF preview details behind a cleaner product flow.
- Improved duplicate-only import messaging.
- Improved Import History row display with friendlier duplicate messages.
- Removed technical hashes, fingerprints, and Mongo IDs from normal Import History UI.
- Made Import another statement the primary action after completed imports.
- Improved compact Import History batch display.
- Improved row number fallback for legacy import rows.
- Preserved audit history while allowing users to undo accidental confirmed imports.

### Safety Notes
- Reverting an import removes only the income/expense records created by that import batch.
- ImportBatch, ImportRow, and ImportedRecordFingerprint audit records are preserved.
- Reverted fingerprints no longer block intentional re-import.
- Active fingerprints still protect against duplicate imports.
- Archive remains a soft-hide action and does not remove financial records.
- Clear preview only resets the temporary PDF preview state before import.
- Existing CSV review and PDF preview/confirm behavior remains unchanged.

### Tested
- Unified CSV/PDF upload flow.
- PDF preview and clear/start-over behavior.
- PDF import completion state.
- Duplicate-only import completion state.
- Import another statement reset flow.
- Import History view rows.
- Import History archive batch.
- Safe import revert workflow.
- Income and expense deletion after revert.
- Re-import after revert.
- Duplicate protection after re-import.
- CSV review queue flow.
- Dashboard and Monthly Summary totals after revert.
- Dark/light mode readability.
- Client build.
- Backend syntax checks.
- GitHub Actions CI passes.


## v1.8.0 — Import History + Reporting Integration

### Added
- Added durable import fingerprint ledger for imported records.
- Added PDF import history using ImportBatch and ImportRow records.
- Added row-level import history for imported, duplicate-skipped, skipped, and error rows.
- Added Import History API endpoints.
- Added Import History UI on the Import Statements page.
- Added CSV/PDF import history filters.
- Added batch row detail viewing.
- Added archive/hide support for import batches.
- Added `includeArchived=true` support for archived import history.
- Added import-source summary to Monthly Summary.
- Added Data Source card to Tax Pack.

### Improved
- Renamed Import CSV to Import Statements.
- Improved import page copy for CSV and PDF statement workflows.
- Archived batches are hidden from default Recent Imports and Import History.
- Legacy CSV batches without `importSource` are treated as CSV in import history.
- Duplicate detection now survives deleted imported transactions through persistent fingerprints.
- Import history preserves audit records without hard-deleting rows or fingerprints.
- Monthly Summary now shows manual, CSV, and PDF transaction source counts.
- Tax Pack now shows source counts for tax-aware expenses.

### Safety Notes
- Import history batches are archived, not permanently deleted.
- Import rows and fingerprints remain after archive for audit and duplicate protection.
- Scanned/OCR PDF import is still not supported.
- Existing CSV import flow remains unchanged.
- Existing PDF preview and confirm import flow remains unchanged.
- Imported expenses are not automatically marked deductible.

### Tested
- PDF import history creation.
- Durable duplicate protection after deleting imported transactions.
- Import History All/CSV/PDF filters.
- Batch row history view.
- Archive cancel and confirm behavior.
- Archived batches hidden from default lists.
- `includeArchived=true` returns archived batches.
- Legacy CSV batch appears under CSV history.
- Monthly Summary import-source counts.
- Tax Pack Data Source card.
- Tax Pack CSV export remains unchanged.
- CSV import still works.
- PDF preview/confirm still works.
- Dark/light mode remains readable.
- GitHub Actions CI passes.


## v1.7.0 — PDF Review/Confirm Import + Duplicate Detection

### Added
- Added backend PDF confirm import endpoint.
- Added selected-row PDF import confirmation from the import page.
- Added PDF import metadata to income and expense records.
- Added SHA-256 duplicate hash generation for PDF imported transactions.
- Added duplicate detection across income and expense records.
- Added row-level import results for imported, duplicate-skipped, skipped, and error rows.
- Added frontend import result summary for confirmed PDF rows.
- Added empty-selection protection for PDF import confirmation.

### Improved
- PDF bank statement workflow now supports preview, review, selection, and confirmation.
- Imported PDF rows now appear in Transactions, Dashboard, and Monthly Summary.
- Duplicate rows are skipped instead of treated as failed imports.
- Unknown PDF row types are skipped unless classified before import.
- Validation errors are returned per row instead of crashing the full import.

### Safety Notes
- Scanned/OCR PDFs are still not supported.
- PDF import history is not fully persisted yet.
- Duplicate detection is based on user, date, type, amount, and normalized description.
- If a user deletes an imported transaction, the same PDF row may be importable again until import history/fingerprint tracking is added.
- Existing CSV import flow remains unchanged.

### Tested
- First PDF confirm import creates income and expense records.
- Re-importing the same PDF rows skips duplicates.
- Unknown row type is skipped.
- Invalid date returns row-level error.
- Imported PDF rows appear on Transactions page.
- Dashboard and Monthly Summary totals update.
- MongoDB records include PDF import metadata.
- Empty selected rows disables confirm button.
- Dark/light mode remains readable.
- GitHub Actions CI passes.

---

## v1.6.0 — Bank Statement Preview + Dark Mode

### Added
- Added GitHub Actions CI workflow.
- Added protected PDF bank statement preview endpoint.
- Added text-based PDF extraction using `pdf-parse`.
- Added conservative PDF transaction parser preview.
- Added frontend PDF preview UI on the import page.
- Added parsed transaction preview rows with confidence levels.
- Added parser summary for PDF statement previews.
- Added dark/light mode support.
- Added theme persistence using localStorage.
- Added theme toggle in Settings and Sidebar.

### Improved
- Improved Import page dark-mode styling.
- Improved Dashboard recent transaction dark-mode rows.
- Improved Transactions page dark-mode readability.
- Improved Debt Reality dark-mode paid/unpaid rows.
- Improved Settings appearance section.
- Improved overall premium dark fintech UI feel.
- Cleaned up theme structure for React Fast Refresh compatibility.

### Safety Notes
- PDF transactions are preview-only in this release.
- PDF transactions are not saved to income or expense records yet.
- OCR/scanned PDF import is not supported yet.
- Existing CSV import flow remains unchanged.

### Tested
- Valid text-based PDF preview.
- Parsed PDF preview rows.
- Invalid fake PDF rejection.
- Existing CSV import flow.
- Dark/light mode persistence.
- Dashboard.
- Transactions.
- Debt Reality.
- Opening Balance.
- Monthly Summary.
- Frontend production build.
- GitHub Actions CI.

---

## v1.5.2 - Portfolio Demo Polish

### Added
- Updated README with stronger portfolio positioning
- Added Munmai feature overview and workflow explanation
- Added screenshots section for demo review
- Added architecture/demo/interview documentation where applicable
- Added release history and local setup guidance

### Improved
- GitHub project presentation for recruiters and interviewers
- Clearer explanation of Munmai as a financial clarity system
- Documentation now explains CSV review, Debt Reality, Monthly Control, and Shared Money flows

### Notes
- No application logic changed.
- No backend routes changed.
- No new product features added.

## v1.5.1 - Sidebar Completion and Demo Polish

### Added
- Monthly Summary page with income vs expense comparison
- Net Flow card for monthly financial position
- Category breakdown with visual bars
- Monthly signals for budget and debt pressure
- Opening Balance page with clearer setup explanation
- Reset Opening Balance action
- Settings page with account, money context, and data links

### Improved
- Dashboard all-time net balance now includes opening balance
- Opening balance is clearly separated from monthly income
- Sidebar is cleaner and more professional
- Removed unprofessional group badges from sidebar
- Removed Coming Soon badges from completed sidebar items

### Notes
- No import logic changed.
- No group logic changed.
- No Debt Reality payment logic changed.
- No AI, rewards, bank sync, or credit optimization added.


## v1.5.0 - Import Review Queue MVP

### Added
- Import CSV page
- CSV upload and review queue
- Import batches and import rows
- Classification flow for income, expense, debt payment, transfer, and ignore
- Suggested classifications for common transaction types
- Debt payment import with linked Debt Reality item
- Skip Row and Undo Skip actions
- Import Complete summary
- Read-only imported batch review
- Cancel/remove support for pending or cancelled imports

### Improved
- CSV rows are reviewed before affecting income, expenses, or debt balances
- Date-only CSV values now preserve the correct calendar date
- Debt payment rows require linked debts before import
- Imported rows cannot be committed twice

### Notes
- No bank sync added.
- No AI categorization added.
- No rewards, credit optimization, or tax split added.


## v1.4.0 - Debt Reality MVP

### Added
- Debt Reality page for tracking personal debts, bills, loans, credit cards, and borrowed money
- Debt summary cards: Total Debt, Monthly Debt Pressure, Due Soon, and Active Debts
- Type-aware debt forms for friend debt, credit cards, loans, bills, and other debt types
- Record Payment flow that reduces debt balance over time
- Payment history backend support
- Debt filters: All, Active, Paid
- Dashboard Debt Reality card

### Improved
- User-facing naming uses “Debt Reality” instead of “Liabilities”
- Debt cards now show type-specific labels
- Paid debts use calmer completed-state UI
- Monthly debt pressure now reflects active debts only

### Notes
- No group logic changed.
- No Monthly Control logic changed.
- CSV import, credit optimization, rewards, and AI suggestions are planned for future phases.

## v1.3.2 - Budget Clarity Polish

### Added
- Monthly Control progress bar
- Daily safe spend calculation
- Days remaining in month calculation
- Clearer budget status messages

### Improved
- Monthly Control card labels
- Safe, warning, and over-budget feedback
- Budget readability for real-life spending control scenarios

### Notes
- No group logic changed.
- No AI, credit card, rewards, or category-budget logic added in this release.

## v1.3.1 - Group Join Code Hotfix

### Fixed
- Restored Join Group button on Groups page
- Restored join code visibility in Members tab
- Restored join request flow after v1.3 UI changes
- Confirmed owner approve/reject flow works

### Notes
- No budget logic changed.
- Monthly Control from v1.3.0 remains unchanged.

## v1.3.0 - Monthly Control Budget MVP

### Added
- Monthly Control budget card on Dashboard
- Per-user monthly spending limit
- Budget status tracking: no budget, safe, warning, over
- Current-month spending calculation from existing expenses
- Remaining budget and percent-used indicators
- Top spending category insight
- Set/Edit Budget modal

### Improved
- Dashboard now helps users understand spending pace, not only totals
- Budget wording clarified from "Budget" to "Spending Limit"
- Monthly spending visibility supports real-life student/worker budgeting cases

### Notes
- This is a simple budget control MVP.
- Category budgets, AI suggestions, notifications, rewards, and credit-card optimization are planned for later phases.

## v1.2.0 - Account, Collaboration & UX Polish Release

### Added

- Required username field during registration.
- Forgot password request flow.
- Reset password flow with expiring, single-use reset links.
- Profile page with basic view and update support.
- Invitation inbox sender details, including inviter name when available.
- Quick-settle action from Group Summary balances.
- Modal-based transaction creation flow.
- Modal-based group actions for shared expenses, settlements, and invites.
- v1.2.0 smoke test checklist.

### Improved

- Registration validation now requires valid, unique usernames.
- Group invitation UX now has clearer helper text, empty states, and accept/decline feedback.
- Settlement UX now makes owed balances easier to understand and settle.
- Transaction type selection now uses larger Income and Expense cards.
- Dashboard hierarchy is cleaner, with focused overview cards and quick actions.
- Group Summary hierarchy is cleaner, with compact summary cards and Balance Breakdown as the primary section.
- Mobile usability for primary dashboard, money, groups, and invitation flows.

### Fixed

- Invitation inbox now displays inviter details instead of generic fallback text when backend data is available.
- Group member selection excludes pending invitees from shared expense and settlement forms.
- Completed onboarding checklist no longer remains visible after all checklist items are complete.

## v1.1.0 - Product Usability Release

### Added

- Dashboard overview for personal and shared money.
- Dedicated Money pages for transactions, receipts, and tax pack.
- Group summary page with shared balances and settlement support.
- Smart empty states across core app pages.
- Sidebar navigation.

### Improved

- Dashboard moved toward an overview-only experience.
- Shared expense and settlement frontend flows became usable from Group Summary.
- Receipt and tax workflows were separated into dedicated pages.

### Fixed

- Dashboard personal summary totals.
- Active group member sourcing for shared expense and settlement forms.
