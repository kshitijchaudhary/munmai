# Munmai v2.0.0 - Phase 2 Stable Checklist

## Goal

Stabilize Munmai as a production-minded portfolio release.

This release is focused on testing, documentation, deployment verification, demo readiness, and small fixes only.

No major new features should be added in v2.0.0.

---

## 1. Full App Smoke Test

- [ ] Login works
- [ ] Register works
- [ ] Logout works
- [ ] Expired token redirects correctly
- [ ] Dashboard loads
- [ ] Dashboard In / Out / Net totals look correct
- [ ] Dark/light mode works
- [ ] Settings page works
- [ ] Trust & Legal links work

---

## 2. Income / Expense Tracking

- [ ] Create income
- [ ] Edit income
- [ ] Delete income
- [ ] Create expense
- [ ] Edit expense
- [ ] Delete expense
- [ ] Expense categories display correctly
- [ ] Receipt coverage summary still works

---

## 3. Receipt Inbox

- [ ] Upload JPG receipt
- [ ] Upload PNG receipt
- [ ] Upload PDF receipt
- [ ] Reject unsupported file type
- [ ] Reject missing file
- [ ] View receipt file securely
- [ ] Edit receipt metadata
- [ ] Archive receipt
- [ ] Search receipts
- [ ] Filter receipts
- [ ] Include archived receipts filter works
- [ ] API responses do not expose internal file paths

---

## 4. Import Statements

- [ ] CSV review queue works
- [ ] PDF import preview works
- [ ] Parsed rows display correctly
- [ ] Confirm selected rows works
- [ ] Duplicate detection works
- [ ] Duplicate skipped count displays correctly
- [ ] Import history displays batches
- [ ] Archived import batches are hidden by default
- [ ] Include archived works
- [ ] Safe revert works
- [ ] Reverted batch status displays correctly

---

## 5. Reports / Tax Pack Foundation

- [ ] Monthly Summary loads
- [ ] Monthly income total looks correct
- [ ] Monthly expense total looks correct
- [ ] Import source counts display correctly
- [ ] Tax Pack data source card displays correctly
- [ ] Receipt-related summaries do not break reports

---

## 6. Groups / Shared Expenses

- [ ] Create group
- [ ] Join group using code
- [ ] Add shared expense
- [ ] Balances calculate correctly
- [ ] Settlements display correctly

---

## 7. Opening Balance / Debt Reality

- [ ] Opening Balance works
- [ ] Opening Balance does not count as monthly income
- [ ] Debt Reality works
- [ ] Record debt payment works
- [ ] Debt pressure summary looks correct

---

## 8. Deployment Verification

- [ ] Frontend deployed URL works
- [ ] Backend deployed URL works
- [ ] Auth works in production
- [ ] CORS works in production
- [ ] Environment variables are correct
- [ ] Receipt uploads work in production
- [ ] Protected receipt file access works in production
- [ ] Import statements work in production
- [ ] No secrets are exposed in frontend
- [ ] No public uploads route exposes receipt files

---

## 9. Documentation

- [ ] README updated with latest feature list
- [ ] Setup instructions updated
- [ ] Environment variable guide updated
- [ ] API overview updated
- [ ] Screenshots added
- [ ] Architecture summary added
- [ ] Demo flow added
- [ ] Known limitations added
- [ ] Roadmap updated

---

## 10. Demo Polish

- [ ] Create clean demo account
- [ ] Add realistic income records
- [ ] Add realistic expense records
- [ ] Add realistic receipt inbox records
- [ ] Add realistic import history
- [ ] Add realistic group/shared expense example
- [ ] Remove confusing old test data
- [ ] Prepare 3-minute demo script
- [ ] Prepare interview explanation

---

## 11. Deferred After v2.0.0

These are intentionally not part of v2.0.0:

- OCR receipt extraction
- AI receipt parsing
- AI category suggestions
- Subscription billing
- Utility Tools section
- PDF compression
- JPG to PDF conversion
- Bank sync
- Mobile app
- Full tax filing engine
- Country-aware tax automation
