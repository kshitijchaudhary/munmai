# Munmai Web

The web client is a React/Vite application for detailed financial review:
personal transactions, receipts, statement imports, monthly reporting, budgets,
liabilities, Spaces, shared expenses, settlements, profile, and trust pages.

## Setup

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

Set the API base URL, including `/api`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Commands

```powershell
npm test
npm run lint
npm run build
npm run preview
npm run csv:qa
```

Password-reset requests can be initiated on `/forgot-password`; emailed links
open `/reset-password/:token`. The API constructs those links from its
`CLIENT_URL`.

See the [root setup guide](../README.md), [architecture](../docs/ARCHITECTURE.md),
and [deployment guide](../DEPLOYMENT.md).

## Planning browser interactions

The checked-in `test/planningInteraction.test.js` runs through the existing Node
runner. It needs a running local web build and an installed Playwright runtime;
no project dependency was added. Configure `PLANNING_UI_URL` (for example
`http://127.0.0.1:4173`) and `PLANNING_PLAYWRIGHT_PATH` (the path to an existing
`playwright-core` package), then run `npm test`. Without both variables the
three browser cases report as skipped. Browser API responses are isolated
fixtures, using the actual pure backend calculation and recurrence functions;
these tests never write live account data. Optional `PLANNING_SCREENSHOT_DIR`
exports responsive screenshots. Real API/database integration remains covered
by the backend suites and requires the documented test environments.
