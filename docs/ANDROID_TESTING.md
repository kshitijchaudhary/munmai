# Android Internal Testing

Munmai is prepared to use Expo Application Services (EAS) for Android builds.
`mobile/eas.json` defines an internal APK profile and a production Android App
Bundle profile, but repository configuration alone does not prove that the EAS
project or remote environments exist.

## APK versus AAB

- `preview` produces an internal-distribution Android APK for direct tester
  installation. Testers download and sideload it; it is not uploaded to Google
  Play.
- `production` produces an Android App Bundle (AAB) intended for Google Play
  delivery. It is not directly installable as an APK.

An internal APK is a pre-release artifact, not a production/store approval.
The repository is not currently ready for an unattended cloud build:

- `mobile/app.json` has no Expo `owner`;
- `mobile/app.json` has no `extra.eas.projectId`;
- remote `preview` and `production` environments cannot be verified locally;
- the Android package is still `com.anonymous.munmai`.

## One-time EAS setup

Install project dependencies first. The EAS CLI can be invoked without adding a
repository dependency:

```powershell
cd D:\work\fintrack\mobile
npm ci
npx eas-cli login
npx eas-cli build:configure
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment production --visibility plaintext
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production
```

`build:configure` may prompt to create or link an Expo project and may add its
project ID to app configuration. Review generated changes before committing
them. Approve or replace the Android package identifier before sharing an APK,
not only before a public store release.

## Pre-build environment checklist

Before creating a tester build:

1. Deploy the API to a public HTTPS URL.
2. Inspect the remotely configured preview environment:

   ```powershell
   npx eas-cli env:list --environment preview
   ```

3. Confirm `EXPO_PUBLIC_API_URL`:
   - exists;
   - points to the deployed API;
   - uses HTTPS;
   - includes the expected `/api` path;
   - is not `localhost`, `127.0.0.1`, `10.0.2.2`, or a private/LAN address.
4. Confirm `CLIENT_URL` on the deployed backend points to the deployed HTTPS web
   client so verification and password-reset links work outside the developer
   network.
5. Keep `ALLOW_LOCALHOST_EMAIL_LINKS=false` in that API environment.
6. Verify MongoDB, SMTP, CORS, persistent upload storage, and API health.

`mobile/eas.json` explicitly maps each build profile to its same-named EAS
environment. Expo public variables are embedded at build time, so rebuilding is
required after changing the API URL. The profile mapping does not validate the
URL; the explicit environment inspection above is the pre-build protection
against embedding a local or incorrect API address.

No signing credentials or application secrets belong in `eas.json`. EAS handles
Android signing credentials through the linked project. `EXPO_PUBLIC_API_URL`
is intentionally plaintext because Expo public variables are visible in the
compiled client.

## Build

After project linkage, identifier review, and environment verification, build
the internal APK:

```powershell
cd D:\work\fintrack\mobile
npx eas-cli build --platform android --profile preview
```

Production AAB:

```powershell
npx eas-cli build --platform android --profile production
```

EAS prints a build page/download URL. A tester downloads the APK on the Android
device and permits installation from that browser/file source when prompted.

## Pre-release checklist

- The pre-build environment checklist above has been completed.
- `npm test` passes in `mobile/`.
- `npx tsc --noEmit` passes.
- `npx expo install --check` reports no unreviewed dependency mismatch.
- `npx expo export --platform web` passes.
- API `/api/health` responds.
- Registration verification and password-reset email work.
- Sign-in, restoration, session expiry, and logout work.
- Today, Activity, Capture, Insights, and Spaces load.
- Income/expense creation, supporting-document upload/retry, shared expense,
  exact splits, and settlement recording work.
- Android Back and focused-form tab-bar behavior work.

## Tester limitations

- OCR, offline queues, native password-reset completion, push notifications,
  subscriptions, and mobile statement import are not included.
- Receipt/proof storage depends on the deployed API's persistent disk.
- A preview APK may use internal signing managed through the Expo project.
- Public release still requires package-name, signing, store-listing, privacy,
  policy, and production environment review.
