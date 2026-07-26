# Munmai

Munmai is a full-stack personal and shared-finance application. The web client
supports deeper review, imports, reporting, debt, budgets, receipts, and group
administration. The Expo mobile client focuses on daily capture, a unified
Activity feed, financial context, and shared Spaces.

- Web: React/Vite application deployed to Vercel
- API: Express/MongoDB service deployed to Render
- Mobile: Expo/React Native application in active stabilization

The merged codebase is the source of truth. OCR, open banking, subscriptions,
offline queues, and predictive financial advice are not current capabilities.

## Core capabilities

- Create and update personal income and expenses.
- Attach protected JPEG, PNG, or PDF receipts to expenses and proof documents
  to income.
- Review a unified mobile Activity feed containing income, personal expenses,
  shared expenses, and settlements.
- Create Spaces, manage membership workflows, split shared expenses, inspect
  persisted participant splits, calculate balances, and record settlements.
- Register, verify email, sign in with JWT authentication, restore native
  sessions from SecureStore, sign out, and request password recovery.
- Review dashboard and monthly summaries, budget pace, liabilities, receipt
  coverage, and tax-oriented exports on the web.
- Preview and review CSV or text-based PDF statement imports before committing
  them, with duplicate detection, history, archive, and revert support.

## Repository structure

```text
client/       React 19 + Vite web application
server/       Express 5 API, Mongoose models, services, and tests
mobile/       Expo SDK 57 + React Native application
docs/         Maintained architecture and operations documentation
.github/      CI workflow
render.yaml   Render API deployment blueprint
```

Generated output, local environment files, uploads, native build output, and
dependencies are intentionally ignored.

## Technology

| Layer | Current stack |
| --- | --- |
| Web | React 19, React Router 7, Vite 8 beta, Tailwind CSS 4, Axios, Recharts |
| Mobile | Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Axios |
| API | Node.js 20 in CI, Express 5, Mongoose 9 |
| Data | MongoDB; replica-set transactions for shared expenses and settlements |
| Auth | JWT, bcrypt, email verification, rate-limited password reset |
| Files | Multer uploads stored outside public static serving and streamed after authorization |
| Deployment | Vercel, Render persistent disk, MongoDB Atlas, Expo/EAS |

Exact package versions are recorded in each package's `package.json` and lockfile.

## Local setup

### Prerequisites

- Node.js 20 or a compatible current Node.js release
- npm
- MongoDB
- SMTP credentials for registration verification and password recovery
- Android Studio, Xcode, or a compatible Expo Go/development build for native work

Install all packages from PowerShell:

```powershell
cd D:\work\fintrack
npm ci
npm ci --prefix server
npm ci --prefix client
npm ci --prefix mobile
```

Copy the environment examples and replace placeholders locally:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
Copy-Item mobile\.env.example mobile\.env.local
```

Never commit real credentials.

### Start the backend

Set `MONGO_URI`, `JWT_SECRET`, app URLs, upload settings, and SMTP variables in
`server/.env`, then run:

```powershell
npm run dev --prefix server
```

The default API health endpoint is `http://localhost:5000/api/health`.

### Start the web client

Set `VITE_API_URL=http://localhost:5000/api` in `client/.env`, then run:

```powershell
npm run dev --prefix client
```

The default Vite URL is `http://localhost:5173`.

### Start the mobile client

Set `EXPO_PUBLIC_API_URL` in `mobile/.env.local`, then run:

```powershell
cd mobile
npm start
```

Use `http://localhost:5000/api` for Expo web. A physical device must use a
LAN-reachable API address or the deployed HTTPS API; `localhost` on the phone is
the phone itself. See [mobile/README.md](mobile/README.md).

The normal startup order is MongoDB, API, then web and/or mobile.

## Environment configuration

The checked-in examples are authoritative:

- [`server/.env.example`](server/.env.example)
- [`client/.env.example`](client/.env.example)
- [`mobile/.env.example`](mobile/.env.example)

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection used by the API |
| `JWT_SECRET` | Signs seven-day access tokens |
| `PORT`, `NODE_ENV` | API listener and runtime mode |
| `CLIENT_URL` | Canonical web origin and password-reset destination |
| `CLIENT_ORIGINS` | Additional comma-separated browser origins allowed by CORS |
| `SERVER_URL` | Public API origin used in verification and document links |
| `ALLOW_LOCALHOST_EMAIL_LINKS` | Explicitly permits localhost/private email links for local development |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email delivery |
| `FORCE_HTTPS` | Redirects forwarded HTTP requests when enabled |
| `REQUEST_BODY_LIMIT` | Express JSON/form body limit |
| `UPLOAD_DIR`, `UPLOAD_LIMIT_MB` | Protected transaction attachment storage and size limit |
| `RECEIPT_UPLOAD_DAILY_LIMIT`, `RECEIPT_UPLOAD_WEEKLY_LIMIT`, `RECEIPT_UPLOAD_MAX_SIZE_MB` | Receipt Inbox limits |
| `VITE_API_URL` | Web API base URL, including `/api` |
| `EXPO_PUBLIC_API_URL` | Expo API base URL, including `/api` |
| `MONGO_TRANSACTION_TEST_URI` | Optional replica-set MongoDB URI for transactional integration tests |
| `MONGO_STANDALONE_TEST_URI` | Optional standalone MongoDB URI for unsupported-transaction regression tests |

Password-reset email links always target `CLIENT_URL`. Local/LAN links require
`ALLOW_LOCALHOST_EMAIL_LINKS=true`; production must use the deployed HTTPS web
client and keep that flag false.

## Testing

```powershell
# Backend
npm test --prefix server

# Web
npm test --prefix client
npm run lint --prefix client
npm run build --prefix client

# Mobile
npm test --prefix mobile
Set-Location mobile
npx tsc --noEmit
npx expo export --platform web
npx expo install --check
```

Integration tests that need MongoDB transactions skip when
`MONGO_TRANSACTION_TEST_URI` is absent. Use a disposable replica-set database;
tests delete their own fixture data. The standalone regression suite uses
`MONGO_STANDALONE_TEST_URI`. Full guidance is in
[`docs/TESTING.md`](docs/TESTING.md).

CI currently performs backend JavaScript syntax checks and a production web
build for pushes and pull requests targeting `main` or `mvp-core`.

## Deployment overview

- `render.yaml` deploys `server/` with a persistent upload disk.
- `client/vercel.json` deploys the Vite SPA and rewrites routes to `index.html`.
- Mobile development uses Expo; `mobile/eas.json` defines an internal APK
  preview and a production Android App Bundle profile.
- A tester APK must use a deployed HTTPS API through `EXPO_PUBLIC_API_URL`.
- The API used by that APK must set `CLIENT_URL` to the deployed HTTPS web
  client so password-reset links can be completed in a browser.

See [DEPLOYMENT.md](DEPLOYMENT.md) and
[`docs/ANDROID_TESTING.md`](docs/ANDROID_TESTING.md).

## Development workflow

1. Start from an up-to-date, clean `mvp-core`.
2. Create a focused feature, fix, or documentation branch; do not work directly
   on `mvp-core`.
3. Run focused tests while implementing.
4. Run the applicable complete suites, type checks, lint/build/export checks,
   and `git diff --check`.
5. Review the final diff and working tree before opening a pull request.
6. Use review and squash merge so `mvp-core` remains readable.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Product principles](docs/PRODUCT_PRINCIPLES.md)
- [Authentication and password recovery](docs/AUTHENTICATION.md)
- [Financial integrity](docs/FINANCIAL_INTEGRITY.md)
- [Testing](docs/TESTING.md)
- [Deployment](DEPLOYMENT.md)
- [Android internal testing](docs/ANDROID_TESTING.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Mobile guide](mobile/README.md)
- [Changelog](CHANGELOG.md)

## Screenshots

Current web and mobile screenshots are available in [`docs/screenshots/`](docs/screenshots/).
