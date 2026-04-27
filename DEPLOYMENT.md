# Munmai Deployment Checklist

Munmai is deployed as two services:

- `server/`: Express API on Render
- `client/`: Vite/React app on Vercel

MongoDB should run on MongoDB Atlas or another managed MongoDB provider.

## Required Deployment Order

1. Create the MongoDB Atlas database and copy the connection string.
2. Deploy the Render API.
3. Copy the Render API URL.
4. Deploy the Vercel frontend with `VITE_API_URL` set to the Render API `/api` URL.
5. Copy the Vercel frontend URL.
6. Update Render with the final frontend URL and redeploy the API.

## Backend: Render

This repo includes [render.yaml](./render.yaml).

Render settings:

- Root directory: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Runtime: Node

Required environment variables:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/munmai
JWT_SECRET=<long-random-secret>
CLIENT_URL=https://your-vercel-app.vercel.app
CLIENT_ORIGINS=https://your-vercel-app.vercel.app
SERVER_URL=https://your-render-service.onrender.com
FORCE_HTTPS=true
REQUEST_BODY_LIMIT=2mb
UPLOAD_LIMIT_MB=5
UPLOAD_DIR=/var/data/munmai/uploads
ALLOW_LOCALHOST_EMAIL_LINKS=false
SMTP_HOST=<smtp-host>
SMTP_PORT=<smtp-port>
SMTP_SECURE=true|false
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM=Munmai <no-reply@yourdomain.com>
```

Local development can keep:

```env
CLIENT_URL=http://localhost:5173
CLIENT_ORIGINS=http://localhost:5173
SERVER_URL=http://localhost:5000
FORCE_HTTPS=false
UPLOAD_DIR=./uploads
ALLOW_LOCALHOST_EMAIL_LINKS=true
```

## Frontend: Vercel

The frontend config lives in [client/vercel.json](./client/vercel.json).

Vercel settings:

- Root directory: `client`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Required environment variable:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

Do not leave `VITE_API_URL` unset in production. The frontend intentionally fails fast in production when the API URL is missing.

## CORS

The API allows:

- `http://localhost:5173`
- `CLIENT_URL`
- each comma-separated origin in `CLIENT_ORIGINS`

For production, set `CLIENT_URL` and `CLIENT_ORIGINS` to the Vercel URL or custom frontend domain. If you use multiple frontend domains, add them to `CLIENT_ORIGINS` separated by commas.

Example:

```env
CLIENT_URL=https://app.munmai.com
CLIENT_ORIGINS=https://app.munmai.com,https://munmai.vercel.app
```

## Uploads and Receipts

Receipts are stored on local disk through `UPLOAD_DIR`.

For Render, use a persistent disk and set:

```env
UPLOAD_DIR=/var/data/munmai/uploads
```

Without a persistent disk, uploaded receipts can disappear after deploys, restarts, or instance replacement. Object storage is a future scaling improvement, but not required for Phase 1 deployment.

## Local Commands

From the repo root:

```bash
npm run dev
npm run build
npm start
```

Backend only:

```bash
cd server
npm run dev
npm start
```

Frontend only:

```bash
cd client
npm run dev
npm run build
npm run preview
```

## Production Smoke Test

1. Open `https://your-render-service.onrender.com/api/health` and confirm `{ "status": "ok" }`.
2. Open the Vercel frontend.
3. Register a new user and confirm the verification email uses the Render API URL.
4. Verify email and confirm the redirect lands on the Vercel login page.
5. Log in.
6. Add an income and an expense.
7. Upload a receipt and open it from the receipts or transaction UI.
8. Create a group.
9. Invite an existing user by email.
10. Accept the invitation from the second account.
11. Add a shared expense.
12. Record a settlement.
13. Confirm dashboard shared money and group balances update.
14. Open the Tax Pack page and export CSV.

## Common Blockers

- `VITE_API_URL` missing on Vercel.
- `CLIENT_ORIGINS` missing the actual Vercel/custom frontend domain.
- `CLIENT_URL` or `SERVER_URL` still pointing to localhost in production.
- `ALLOW_LOCALHOST_EMAIL_LINKS=true` in production.
- SMTP credentials missing or `SMTP_FROM` not authorized by the sender domain.
- Render service has no persistent disk while receipts are stored locally.
- MongoDB Atlas network access does not allow Render connections.
