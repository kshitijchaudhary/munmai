# Munmai v2.0.0 Smoke Test Results

## Test Environment

- Branch: release/v2-phase-2-stable
- Frontend: Local Vite app at http://localhost:5173
- Backend: Local Express API at http://localhost:5000/api
- Database: MongoDB Atlas development/demo database
- Tested by: Kshitij Chaudhary

---

## Auth

- [x] Register works
- [x] Login works
- [x] Logout works
- [x] Expired token redirects to login correctly
- [x] Protected pages require login

Notes:
Verified expired token detection, session-expired redirect, and protected route gating. No issues found.
---

## Dashboard

- [x] Dashboard loads
- [x] In / Out / Net totals display
- [x] Monthly snapshot displays
- [x] Shared money preview displays
- [x] Debt Reality preview displays
- [x] Dark/light mode works

Notes:
All functional tests passed. UX refinements are planned as non-blocking follow-ups.
---

## Income / Expense Tracking

- [x] Create income
- [x] Edit income
- [x] Delete income
- [x] Create expense
- [x] Edit expense
- [x] Delete expense
- [x] Categories display correctly
- [x] Receipt coverage summary works

Notes:
All tests passed. No issues found.
---

## Receipt Inbox

- [x] Upload JPG receipt
- [x] Upload PNG receipt
- [x] Upload PDF receipt
- [x] Unsupported file type returns friendly error
- [x] Missing file returns friendly error
- [x] Receipt list loads
- [x] Receipt search works
- [x] Receipt filters work
- [x] Include archived toggle works
- [x] View file works through protected route
- [x] Edit receipt metadata works
- [x] Archive receipt works
- [x] Internal file paths are not exposed in API response

Notes:
All functional tests passed. UI/UX polish is planned as a non-blocking follow-up.
---

## Import Statements

- [x] CSV review queue works
- [x] PDF preview works
- [x] Parsed PDF rows display
- [x] Confirm selected rows works
- [x] Duplicate detection works
- [x] Duplicate skipped count displays
- [x] Import history displays batches
- [x] Archive import batch works
- [x] Include archived batches works
- [x] Safe revert works
- [x] Reverted batch status displays

Notes:
All tests passed.
---

## Reports / Tax Pack

- [x] Monthly Summary loads
- [x] Monthly income total looks correct
- [x] Monthly expense total looks correct
- [x] Net flow looks correct
- [x] Category breakdown displays
- [x] Import source counts display
- [x] Tax Pack data source card displays
- [x] Tax Pack does not overclaim full tax filing

Notes:
All tests passed.
---

## Groups / Shared Expenses

- [x] Create group
- [x] Join group using code
- [x] Add shared expense
- [x] Balances calculate
- [x] Settlement can be recorded
- [x] Settlement reduces outstanding balance

Notes:
All tests passed.
---

## Opening Balance / Debt Reality

- [x] Opening Balance loads
- [x] Opening Balance can be set/updated
- [x] Debt Reality loads
- [x] Liability can be created
- [x] Liability payment can be recorded
- [x] Debt pressure summary updates

Notes:
All tests passed.
---

## Trust & Legal

- [x] Privacy Policy page works
- [x] Terms of Use page works
- [x] What Munmai Stores page works
- [x] Logged-in legal pages return to Settings
- [x] Logged-out legal pages return to Login
- [x] No old Finvexa/Munmai references

Notes:
All tests passed.
---

## Deployment Verification

- [x] Live frontend loads
- [x] Live backend health endpoint works
- [x] Login works in production
- [x] Dashboard works in production
- [x] Receipt upload works in production
- [x] Protected receipt file access works in production
- [x] Import Statements works in production
- [x] CORS works in production

Notes:
All tests passed in production. Receipt uploads and protected receipt file access work, but long-term production use should move uploaded files to durable object storage instead of relying only on server filesystem storage.
---

## Final Result

Status:

- [ ] Passed
- [x] Passed with minor issues
- [ ] Failed

Summary:
Local and production smoke tests passed for all v2.0.0 feature areas including auth, dashboard, income/expense tracking, Receipt Inbox, Import Statements (CSV and PDF), duplicate detection, import history, safe revert, Monthly Summary, Tax Pack, groups, settlements, Debt Reality, Opening Balance, Trust & Legal pages, and deployment verification.

No blocking functional issues were found. Known non-blocking follow-ups include UI/UX consistency refinements, navigation clarity improvements, sidebar and menu organization, and demo polish for portfolio presentation.
