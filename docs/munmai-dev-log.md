## Feature: Group Money UX Stability Pass

### Branch
feat/group-money-ux-stability

### Goal
Improve group detail UX with Summary, Expenses, Balances, Settlements, and Members tabs.

### Files changed
- client/src/App.jsx
- client/src/api/groups.js
- client/src/pages/GroupSummary.jsx

### Endpoints used
- GET /api/groups/:groupId/summary
- GET /api/groups/:groupId/expenses
- GET /api/groups/:groupId/settlements
- GET /api/groups/:groupId/memberships
- POST /api/shared-expenses
- POST /api/groups/:groupId/settlements
- POST /api/groups/:groupId/invitations

### Test status
Local build passed. Manual browser smoke test required before merge.