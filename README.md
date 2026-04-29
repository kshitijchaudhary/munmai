## 🚀 Munmai — Financial Tracking System

Production-ready full-stack application for personal and shared expense tracking.

### 🔗 Live
Frontend: https://munmai.com  
Backend: https://munmai-api.onrender.com

### ⚠️ Note
Backend root (/) returns a simple health message. Use API routes like /api/... for actual data.

## Current Version

**v1.2.0 - Account, Collaboration & UX Polish Release**

Munmai v1.2.0 strengthens account management, group collaboration, password recovery, and the core money-management user experience.

---

## v1.2 Highlights

- Required username during registration with duplicate username validation.
- Forgot password and reset password flow.
- Profile page for viewing and updating name and username.
- Improved invitation inbox with inviter details.
- Cleaner group invite, accept, and decline UX.
- Quick-settle flow for shared balances.
- Transaction modal flow with clearer income/expense selection.
- Dashboard hierarchy cleanup with focused quick actions.
- Group Summary action buttons and modal-based forms.

---

## Core Features

### Personal Finance
- Track income and expenses.
- View dashboard totals, monthly snapshots, spending breakdowns, and recent transactions.
- Manage transactions from a dedicated Money page.

### Receipts
- Attach receipts to expenses.
- Track missing receipts.
- Review receipt coverage.

### Tax Pack
- Track deductible expenses.
- Review tax-ready totals.
- Export tax CSV data.

### Groups & Shared Money
- Create groups.
- Invite registered Munmai users by email.
- Accept or decline group invitations.
- Add shared expenses.
- Record settlements.
- View netted group balances.

### Account
- Register with email, password, name, and username.
- Verify email.
- Reset forgotten passwords.
- View and update profile details.

---

## Tech Stack

### Frontend
- React + Vite
- Tailwind CSS
- Axios

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication

### Infrastructure
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

---

## End-to-End Flows

- Register -> verify email -> login.
- Add income and expenses.
- Attach receipts.
- Review tax pack data and export CSV.
- Create a group.
- Invite a user.
- Accept or decline invitations.
- Add shared expenses.
- Quick-settle outstanding balances.
- Update profile details.
- Reset password securely.

---

## Current Limitations

- Receipts use local disk storage, so Render persistent disk configuration is required for production receipt retention.
- Group invitations currently work for registered users only.
- No real-time notifications yet.
- No liabilities or opening balance module yet.

---

## Roadmap

### v1.x
- Better group activity history.
- Notification system.
- Additional reporting views.

### v2.0
- Opening balances.
- Liabilities tracking.
- Advanced analytics.
- AI-ready financial insights layer.

---

## Local Development

### Install dependencies

```bash
npm install
cd client && npm install
cd ../server && npm install
```

### Run locally

```bash
npm run dev
```

---

## Environment Variables

### Backend (`server/.env`)

```env
MONGO_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
UPLOAD_DIR=./uploads
```

### Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Author

Kshitij Chaudhary  
Full Stack Developer, Canada

---

## Status

- Actively developed.
- Production deployed.
- Portfolio-ready.
