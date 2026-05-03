# Changelog

All notable Munmai release changes are documented here.

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
