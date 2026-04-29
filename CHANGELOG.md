# Changelog

All notable Munmai release changes are documented here.

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
