# Munmai Mobile

Munmai Mobile is the Expo/React Native daily-use client for Munmai. It uses
Expo Router, TypeScript, React Native, and the existing Express API. It targets
iOS and Android and maintains an Expo web export; native runtime verification
is still required for each release and Expo Go must match Expo SDK 57.

## Current experience

The authenticated shell has exactly five tabs:

1. **Today** — adaptive financial pulse, one contextual priority, and a compact insight.
2. **Activity** — unified income, expense, shared-expense, and settlement feed with personal/shared filters and expandable persisted splits.
3. **Capture** — camera-first or manual income/expense entry.
4. **Insights** — current-month income, expense, and net context.
5. **Spaces** — shared groups, balances, members, expenses, and settlements.

Account is intentionally hidden from the tab bar and opens from the Today
avatar.

## Prerequisites

- Node.js and npm
- A running local API or deployed HTTPS API
- Android Studio for emulator/native Android builds
- macOS and Xcode for native iOS builds
- An Expo account for EAS builds

## Install and configure

```powershell
cd D:\work\fintrack\mobile
npm ci
Copy-Item .env.example .env.local
```

Set the API base URL, including `/api`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

Recommended development values:

| Runtime | Example API URL |
| --- | --- |
| Expo web | `http://localhost:5000/api` |
| Android emulator | `http://10.0.2.2:5000/api` |
| iOS simulator | `http://localhost:5000/api` |
| Physical phone | `http://192.168.1.20:5000/api` |
| Tester APK/production | `https://your-api.example.com/api` |

For a phone, the API host must be reachable on the same LAN and Windows
Firewall must allow the Node process/port. Restart Metro after changing
`EXPO_PUBLIC_API_URL`; Expo public variables are embedded into the bundle.

## Run locally

```powershell
npm start
npm run web
npm run android
```

On macOS:

```bash
npm run ios
```

Clear a stale Metro bundle with:

```powershell
npx expo start --clear
```

`npm run android` uses the generated native project workflow. For Expo Go, scan
the development QR code only with a client compatible with Expo SDK 57.

## Route architecture

Expo Router reads routes from `src/app`.

Public signed-out routes:

```text
/sign-in
/register
/forgot-password
```

Authenticated public URLs:

```text
/                         Today
/transactions             Activity
/add                      Capture
/analytics                Insights
/groups                   Spaces
/more                     Account (hidden tab)
/add/transaction          Personal transaction form
/transactions/:type/:id   Personal transaction detail
/groups/:groupId          Space detail
```

Focused forms such as `/add/transaction`,
`/groups/:groupId/add-expense`, and
`/groups/:groupId/settlements/new` hide the persistent tab bar. Normal Space
detail and settlement history keep it visible.

Activity owns the `/transactions` stack. Activity-originated Space navigation
uses `/transactions/spaces/:groupId`, which displays the Space Activity section
and returns to Activity. Spaces-owned navigation uses `/groups/:groupId` and
returns through the Spaces stack. Do not put Expo route-group names such as
`(app)` into public URLs.

Pressing the Spaces tab explicitly navigates to the `/groups` root rather than
targeting a previously open nested Space. Settlement Cancel dismisses to the
owning Space detail when that route exists and falls back to `/groups` for an
invalid/direct route; it does not reset the settlement form before navigation.

Legacy `/dashboard` and `/add-transaction` routes redirect safely according to
authentication state.

## Authentication and password recovery

- Registration and sign-in use the existing API.
- Native JWT sessions use Expo SecureStore; Expo web uses versioned browser
  storage.
- The router restores the session before exposing protected screens.
- API 401 handling clears the session and replaces protected navigation with
  Sign In; 403 remains an authorization error.
- Sign-out clears session state and replaces authenticated history.

“Forgot password?” opens the signed-out mobile request form. It validates the
email, blocks repeated submission, calls `POST /api/auth/forgot-password`, and
always shows the neutral confirmation returned by the API. The email link opens
the existing web `/reset-password/:token` page; there is no native reset-token
screen.

For local email testing, the API's `CLIENT_URL` may point to a reachable
localhost/LAN web client only when `ALLOW_LOCALHOST_EMAIL_LINKS=true`. A tester
APK requires the API to use the deployed HTTPS web client as `CLIENT_URL`.

## Capture and supporting documents

Capture supports:

- receipt-first camera capture followed by expense/income choice,
- manual income or expense entry,
- one optional JPEG, PNG, or PDF,
- camera, image library, and document picker,
- preview for images and filename display for PDFs,
- removal, replacement, and upload-only retry.

Expense multipart uploads use the `receipt` field. Income proof uploads use
`proof`. Both use a 5 MB client guardrail while the backend remains
authoritative.

Transaction creation and attachment upload are separate. If creation succeeds
but upload fails, the form retains the transaction ID and retry uploads only the
document; it does not create a duplicate transaction. Successful mutations
refresh Today, Activity, Insights, and relevant detail data. There is no offline
queue or permanent polling.

Transaction dates use a cross-platform picker, submit local `YYYY-MM-DD`, reject
future dates, use a rolling 12-month minimum, and require confirmation for dates
more than 90 days old.

## Validation

```powershell
npm test
npx tsc --noEmit
npx expo export --platform web
npx expo install --check
```

`npm run lint` is defined through Expo, but the repository does not currently
include a mobile ESLint configuration/package set. Do not treat it as an
available release gate until that tooling is added intentionally.

## Internal Android tester APK

The checked-in `eas.json` defines:

- `preview`: internal-distribution APK for testers
- `production`: Android App Bundle (AAB) for store delivery

This is not yet an unattended build-ready EAS project. `app.json` has no Expo
`owner` or `extra.eas.projectId`, the remote EAS project/environments cannot be
verified from the repository, and the current Android identifier
`com.anonymous.munmai` must be approved or replaced before distributing a
tester build.

Required one-time setup:

```powershell
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment production --visibility plaintext
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production
```

After project linkage, identifier review, and EAS environment verification,
build a tester APK:

```powershell
npx eas-cli build --platform android --profile preview
```

After the same checks, build a production AAB:

```powershell
npx eas-cli build --platform android --profile production
```

Before building, set `EXPO_PUBLIC_API_URL` in the corresponding EAS environment
to the deployed HTTPS API and confirm that API uses the deployed HTTPS web
client for `CLIENT_URL`. `build:configure` may prompt to create/link an Expo
project and may add project linkage to `app.json`; review those generated
changes before committing them.

An internal APK can be downloaded from the EAS build page and sideloaded after
the tester permits installation from that source. It is not a Play Store AAB
and does not imply production release readiness.

See [`../docs/ANDROID_TESTING.md`](../docs/ANDROID_TESTING.md) for the checklist.

## Troubleshooting

- **Stale UI/code:** run `npx expo start --clear`, then reload/reinstall the app.
- **Expo Go SDK mismatch:** use an SDK 57-compatible Expo Go or a development build.
- **Phone cannot reach API:** use the computer's LAN IP, bind the API normally,
  verify both devices share a network, and allow the port through the firewall.
- **Android emulator cannot use localhost:** use `10.0.2.2`.
- **Wrong backend:** inspect `EXPO_PUBLIC_API_URL`, including the `/api` suffix,
  then restart Metro.
- **Reset email uses a LAN URL:** update server `CLIENT_URL`; local testing needs
  a reachable web client, while tester builds need the deployed HTTPS client.
- **Space Back opens the wrong tab:** use Activity-owned routes when entering
  from Activity and Spaces-owned routes when entering from Spaces; clear a stale
  Metro bundle before diagnosing navigation.
