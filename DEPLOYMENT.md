# Finvexa Deployment Guide

This app is split into:

- `server/` -> Express API deployed to Render
- `client/` -> Vite/React frontend deployed to Vercel

## Recommended production architecture

- Host the API on Render as a Node web service.
- Attach a persistent disk on Render for receipt uploads.
- Host the frontend on Vercel with `client` as the project root.
- Use a real SMTP sender mailbox on a domain you control.
- Store MongoDB in MongoDB Atlas or another managed MongoDB provider.

## Why the deployment order matters

The backend needs the public frontend URL for:

- email verification redirects
- CORS allow lists

The frontend needs the public API URL for:

- API requests
- receipt download links
- telemetry posts

Use this order:

1. Deploy the Render API.
2. Copy the public Render URL.
3. Deploy the Vercel frontend with `VITE_API_URL` pointing to the Render API.
4. Copy the public Vercel URL or custom domain.
5. Update Render `CLIENT_URL`, `CLIENT_ORIGINS`, `SERVER_URL`, and SMTP settings.
6. Redeploy the Render service.

## Render setup

This repo includes [render.yaml](./render.yaml) for the API service.

### Render service settings

- Service type: `Web Service`
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Plan: `starter` recommended

### Why `starter` is recommended

- Receipt uploads need a persistent disk.
- Free Render web services do not support outbound SMTP on ports `25`, `465`, or `587`.
- A paid plan is the safer baseline for a launchable finance app.

### Render environment variables

Set these in Render:

- `NODE_ENV=production`
- `FORCE_HTTPS=true`
- `REQUEST_BODY_LIMIT=2mb`
- `UPLOAD_LIMIT_MB=5`
- `UPLOAD_DIR=/var/data/finvexa/uploads`
- `ALLOW_LOCALHOST_EMAIL_LINKS=false`
- `MONGO_URI=<your-mongodb-connection-string>`
- `JWT_SECRET=<generated-or-random-secret>`
- `SERVER_URL=https://your-render-service.onrender.com`
- `CLIENT_URL=https://your-vercel-site.vercel.app`
- `CLIENT_ORIGINS=https://your-vercel-site.vercel.app`
- `SMTP_HOST=<smtp-host>`
- `SMTP_PORT=<smtp-port>`
- `SMTP_SECURE=true|false`
- `SMTP_USER=<smtp-username>`
- `SMTP_PASS=<smtp-password>`
- `SMTP_FROM=Finvexa <no-reply@yourdomain.com>`

If you use a custom frontend domain, set `CLIENT_URL` and `CLIENT_ORIGINS` to that domain instead.

### Persistent uploads

Receipt files are stored on disk. In production, the server now reads `UPLOAD_DIR`, so Render should mount a disk at `/var/data/finvexa` and the app will write receipts to `/var/data/finvexa/uploads`.

Without a persistent disk, uploaded receipts can disappear after restarts or deploys.

## Vercel setup

The frontend config lives in [client/vercel.json](./client/vercel.json).

### Vercel project settings

- Framework preset: `Vite`
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

### Vercel environment variables

Set this in Vercel:

- `VITE_API_URL=https://your-render-service.onrender.com/api`

### SPA routing

The Vercel config rewrites all non-file routes to `index.html`, which is required for browser refreshes on routes like `/login`, `/register`, `/privacy`, and `/dashboard`.

## First production smoke test

After both deployments are live:

1. Open the frontend on Vercel.
2. Register a new account.
3. Confirm the verification email contains public URLs, not `localhost`.
4. Verify the email and confirm the redirect lands on the frontend login page.
5. Log in and add a transaction.
6. Upload a receipt and open it from the dashboard.
7. Import a CSV and review/import the queued rows.
8. Export the Tax Pack and account export.
9. Delete the account from the in-app tools.

## Common launch blockers

- `SMTP_FROM` uses a sender domain that does not exist or is not authorized.
- `CLIENT_URL` or `SERVER_URL` still points to localhost.
- `VITE_API_URL` is missing on Vercel.
- Render is on the free plan, so SMTP delivery fails.
- The app is writing uploads to ephemeral storage instead of the mounted disk.
- `CLIENT_ORIGINS` does not include the actual Vercel production domain.

## Optional but recommended next steps

- Move receipts from local disk to object storage later if you want easier scaling.
- Add a custom domain to both Vercel and Render before launch.
- Point `SMTP_FROM` at a domain with SPF and DKIM configured.
- Run backups against MongoDB on a schedule outside the app server.
