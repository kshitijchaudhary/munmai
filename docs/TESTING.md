# Testing

Run commands from the repository root unless a section changes directory.

## Backend

Complete Node test suite:

```powershell
npm test --prefix server
```

Examples of focused suites:

```powershell
node --test server/test/passwordReset.test.js
node --test server/test/moneyAmountValidation.test.js
node --test server/test/activityFeed.test.js
```

Backend tests use Node's built-in test runner. Many controller/service tests use
mocks and require no live database.

### MongoDB integration modes

Some suites conditionally use:

```env
MONGO_TRANSACTION_TEST_URI=mongodb://.../disposable-replica-set-database
MONGO_STANDALONE_TEST_URI=mongodb://.../disposable-standalone-database
```

`MONGO_TRANSACTION_TEST_URI` is used for transactional shared-expense and
settlement enforcement, Activity authorization, and real password-reset
persistence. Those cases report as skipped when the variable is absent.

`MONGO_STANDALONE_TEST_URI` verifies that shared-expense creation fails safely
when MongoDB transactions are unavailable.

Use isolated disposable databases only. Do not point either variable at a
development or production database.

CI provisions both modes locally: a replica-set MongoDB for transactional
integration suites and a separate standalone MongoDB for the unsupported-
transaction regression. Backend CI supplies both variables and fails if any
test is reported as skipped. CI uses Docker for these disposable instances.
Developers running the same integration coverage locally need Docker or
equivalent disposable MongoDB instances at the two supplied URIs.

## Web

```powershell
npm test --prefix client
npm run lint --prefix client
npm run build --prefix client
```

The web test suite uses Node-native tests for pure workflow/validation logic.
The production Vite build validates route imports and bundling. Run changed-file
lint first when addressing existing repository-wide lint debt.

CSV parser QA is available separately:

```powershell
npm run csv:qa --prefix client
```

## Mobile

```powershell
npm test --prefix mobile
Set-Location mobile
npx tsc --noEmit
npx expo export --platform web
npx expo install --check
```

The mobile test script explicitly enumerates its Node-native suites. When adding
a test file, update `mobile/package.json` so the complete command includes it.

`npm run lint` invokes Expo's ESLint configuration and is a CI gate.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main` and
`mvp-core`.

- Backend: installs with `npm ci`, starts isolated replica-set and standalone
  MongoDB containers, checks JavaScript syntax, and runs the complete suite.
  The job fails when either required URI is absent or any test is skipped.
- Web: installs with `npm ci`, then runs lint, tests, and the production build.
- Mobile: installs with `npm ci`, then runs lint, tests, TypeScript validation,
  and an Expo web production export.

Developers can run the same package commands documented above. Running every
backend integration case locally additionally requires disposable replica-set
and standalone MongoDB instances supplied through the two documented URIs.

## Documentation validation

There is no dedicated Markdown link-checker script. Documentation changes
should verify:

- relative Markdown links resolve;
- referenced paths exist;
- documented npm scripts exist;
- documented environment variables appear in code or checked-in examples;
- code blocks contain copy-pasteable commands;
- `git diff --check` passes.

## Pre-review baseline

```powershell
git diff --check
git status --short
git diff --stat
git diff --cached --name-only
```

Review skipped tests and pre-existing warnings explicitly rather than reporting
an unconditional pass.
