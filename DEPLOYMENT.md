# Munmai Deployment

Munmai's current deployment topology is:

- Express API on Render
- MongoDB Atlas (or another transaction-capable MongoDB deployment)
- React/Vite web SPA on Vercel
- protected uploads on a Render persistent disk
- Expo/EAS for Android test and production artifacts

No object storage, queue, serverless worker, or mobile-native password reset is
currently configured.

## Deployment order

1. Provision a transaction-capable MongoDB database.
2. Deploy the Render API with persistent storage and SMTP.
3. Deploy the Vercel web client against the Render API.
4. update Render's `CLIENT_URL`, `CLIENT_ORIGINS`, and `SERVER_URL` with final
   public HTTPS origins, then redeploy;
5. verify auth, email, files, transactions, Spaces, and settlements;
6. create the mobile preview build against the deployed API.

## Backend on Render

[`render.yaml`](render.yaml) defines:

- service root: `server`
- build: `npm ci`
- start: `npm start`
- health: `/api/health`
- persistent disk: `/var/data/munmai`
- upload directory: `/var/data/munmai/uploads`

Required/synchronized variables:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.example/munmai
JWT_SECRET=<long-random-secret>

CLIENT_URL=https://your-web-client.example
CLIENT_ORIGINS=https://your-web-client.example
SERVER_URL=https://your-api.example

FORCE_HTTPS=true
REQUEST_BODY_LIMIT=2mb
UPLOAD_LIMIT_MB=5
UPLOAD_DIR=/var/data/munmai/uploads

RECEIPT_UPLOAD_DAILY_LIMIT=3
RECEIPT_UPLOAD_WEEKLY_LIMIT=15
RECEIPT_UPLOAD_MAX_SIZE_MB=10

ALLOW_LOCALHOST_EMAIL_LINKS=false
SMTP_HOST=<smtp-host>
SMTP_PORT=<smtp-port>
SMTP_SECURE=true
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM=Munmai <no-reply@your-domain.example>
```

`render.yaml` generates `JWT_SECRET` and marks secrets/URLs for dashboard
configuration. It sets production HTTPS and upload defaults.

The API trusts one reverse proxy hop and uses the forwarded protocol when
`FORCE_HTTPS=true`. Do not expose the Node process directly behind additional
unreviewed proxy hops.

### MongoDB requirements

Shared-expense and settlement writes use MongoDB transactions. Production must
use a replica set, such as MongoDB Atlas. A standalone MongoDB instance causes
those writes to fail safely with a service error; it is not a supported
production topology.

### Protected file storage

`UPLOAD_DIR` must be on the persistent disk. The API does not statically expose
that directory. Receipt/proof routes authenticate and authorize each download.

If the disk is removed or `UPLOAD_DIR` points at ephemeral storage, uploaded
files can disappear across deployments. Object storage is a future scaling
option, not part of this deployment.

### Email and reset links

SMTP is required for verification and password recovery. `CLIENT_URL` is the
only reset-link destination:

```text
https://your-web-client.example/reset-password/:token
```

Production email configuration rejects local/private `CLIENT_URL` values and
public non-HTTPS URLs while `ALLOW_LOCALHOST_EMAIL_LINKS=false`. Never enable
the local-link override in production.

## Web on Vercel

[`client/vercel.json`](client/vercel.json) configures the Vite framework, `dist`
output, and SPA fallback.

Vercel project settings:

- root directory: `client`
- install: `npm ci`
- build: `npm run build`
- output: `dist`

Required variable:

```env
VITE_API_URL=https://your-api.example/api
```

After deployment, add the final Vercel/custom origin to Render
`CLIENT_ORIGINS`. Multiple origins are comma-separated without path suffixes.

## Mobile and EAS

[`mobile/eas.json`](mobile/eas.json) defines:

- `preview`: internal APK
- `production`: Android App Bundle

The profiles are configuration, not proof of cloud readiness. `mobile/app.json`
does not currently contain an Expo owner/project ID, the remote environments
must be created or verified, and `com.anonymous.munmai` requires review before
the first distributed APK.

The build must embed:

```env
EXPO_PUBLIC_API_URL=https://your-api.example/api
```

Configure this non-secret public value in both EAS environments:

```powershell
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://your-api.example/api --environment production --visibility plaintext
npx eas-cli env:list --environment preview
npx eas-cli env:list --environment production
```

The API serving that build must use the deployed HTTPS web client for
`CLIENT_URL`; password-reset completion remains web-based.

Build commands:

```powershell
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

For a production AAB:

```powershell
npx eas-cli build --platform android --profile production
```

See [`docs/ANDROID_TESTING.md`](docs/ANDROID_TESTING.md).

## Local development differences

Local server values may use:

```env
CLIENT_URL=http://localhost:5173
CLIENT_ORIGINS=http://localhost:5173
SERVER_URL=http://localhost:5000
FORCE_HTTPS=false
UPLOAD_DIR=./uploads
ALLOW_LOCALHOST_EMAIL_LINKS=true
```

A physical mobile device needs a LAN-reachable API URL. If reset email is tested
on that device, `CLIENT_URL` must also identify a web client reachable from the
device. These local values must not be reused for tester APKs.

## Production validation

1. Confirm `GET /api/health` returns status, request ID, and timestamp.
2. Load and refresh public/protected Vercel routes.
3. Register and verify a new account.
4. Request password recovery and confirm the email points to the HTTPS web client.
5. Confirm the old password fails and the new password succeeds after reset.
6. Create/update income and expenses at valid amount/date boundaries.
7. Upload and retrieve an expense receipt and income proof.
8. Review an import without committing unintended rows.
9. Create/join a Space, record a shared expense, inspect exact splits, and record a valid settlement.
10. Confirm unauthorized users cannot access personal files or Space data.
11. Build/install the preview APK and repeat the core mobile workflow.

## Backup

The server exposes a JSON backup script:

```powershell
npm run backup:json --prefix server
```

It uses `MONGO_URI`. Store generated backup output securely and never commit it.

## Common deployment failures

- API/client URL omits `/api` in `VITE_API_URL` or `EXPO_PUBLIC_API_URL`.
- `CLIENT_ORIGINS` does not include the deployed browser origin.
- `CLIENT_URL` still points to localhost/LAN, producing unusable reset links.
- `ALLOW_LOCALHOST_EMAIL_LINKS=true` in production.
- SMTP sender/credentials are invalid.
- Render persistent disk is absent or mounted at the wrong path.
- MongoDB Atlas network access excludes Render.
- MongoDB deployment does not support transactions.
- Mobile was built before the final public API URL was embedded.
