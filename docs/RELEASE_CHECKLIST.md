# Release Checklist

## Repository

- Work is on a focused branch created from current `mvp-core`.
- No secrets, local `.env` files, generated logs, uploads, or build output are tracked.
- `git diff --check` passes.
- The final status, staged files, and diff stat have been reviewed.

## Backend

- Required environment variables are configured.
- `/api/health` responds over HTTPS.
- Focused tests and `npm test --prefix server` pass.
- Conditional MongoDB integration skips are understood or run against disposable databases.
- MongoDB supports transactions for shared expenses and settlements.
- Upload storage is persistent and not publicly mounted.
- SMTP verification and neutral password recovery work.
- `CLIENT_URL` and `SERVER_URL` are public HTTPS URLs.
- `ALLOW_LOCALHOST_EMAIL_LINKS=false`.

## Web

- `VITE_API_URL` points to the deployed API `/api`.
- Web tests, lint review, and production build pass.
- SPA refresh works on public, protected, Space, and reset-password routes.
- Registration, verification, login, session expiry, reset, and logout work.
- Personal transactions, receipts, imports, reports, and shared workflows have smoke coverage.

## Mobile

- Mobile tests, TypeScript, Expo dependency check, and web export pass.
- The five-tab order remains Today, Activity, Capture, Insights, Spaces.
- Signed-out routes and protected navigation work after refresh/Back.
- Activity shows all four event types and persisted splits.
- Focused forms hide the tab bar without obscuring safe-area actions.
- Supporting-document failure retries upload without duplicating a transaction.
- Spaces balances, shared expenses, and settlements refresh correctly.
- Tester build uses deployed HTTPS API and web reset destination.

## Delivery

- Render, Vercel, MongoDB, SMTP, and persistent storage have been verified.
- Preview APK limitations are communicated to testers.
- Production AAB and store release are treated as a separate approval step.
- Pull request checks and review are complete.
- Merge uses the repository's squash-merge workflow.
