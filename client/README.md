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
