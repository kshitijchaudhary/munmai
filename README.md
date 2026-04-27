# 🚀 Munmai — Personal & Shared Finance OS

Munmai is a modern finance tracking system designed for **individual and group money management** — combining transactions, receipts, tax insights, and shared expense tracking in one clean interface.

👉 Live App: https://munmai.com

---

## ✨ Current Version

**v1.1.0 — Product Usability Release**

Munmai is now a **fully usable MVP** with core financial workflows working end-to-end.

---

## 🧠 Core Features

### 💰 Personal Finance
- Track **income and expenses**
- Monthly summaries (In / Out / Net)
- Transaction search, filters, and CSV import

### 🧾 Receipts Management
- Upload and store receipts
- Track missing receipts
- Open/view receipts securely

### 📊 Tax Pack
- Deductible expense tracking
- Receipt coverage insights
- CSV export for tax filing

### 👥 Group & Shared Expenses
- Create groups
- Invite users via email
- Track shared expenses
- Automatic balance calculations
- Settlement tracking

### 🧭 Smart UX
- Onboarding checklist
- Empty states with guided actions
- Clean dashboard overview
- Mobile responsive UI

---

## 🏗️ Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Axios

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- JWT Authentication

### Infrastructure
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

---

## 🧪 What You Can Do (End-to-End)

- Register → Verify email → Login
- Add income/expenses
- Upload receipts
- Create a group
- Invite another user
- Accept invitation
- Add shared expense
- Record settlement
- View balances
- Export Tax Pack

---

## ⚠️ Current Limitations (v1.1)

- Receipts stored on local disk (Render persistent disk required)
- Invites only work for **registered users**
- No real-time notifications yet
- No liabilities / advanced financial insights yet

---

## 🚧 Roadmap (Next Versions)

### v1.2 (Next Focus)
- Invite UX improvements (search users)
- Notifications system
- Better group activity visibility

### v2.0 (Major Upgrade)
- Opening balances
- Liabilities tracking
- Advanced analytics
- Financial insights layer (AI-ready)

---

## ⚙️ Local Development

### Clone repo
```bash
git clone https://github.com/kshitijchaudhary/munmai.git
cd munmai
```

### Install dependencies
```bash
npm install
cd client && npm install
cd ../server && npm install
```

### Run app
```bash
# root
npm run dev
```

---

## 🔐 Environment Variables

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

## 🚀 Deployment

See full guide: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

---

## 👤 Author

**Kshitij Chaudhary**  
Full Stack Developer (Canada)

---

## 💡 Vision

Munmai is evolving into a **Financial Command Center** — combining:
- personal finance
- shared money tracking
- tax readiness
- insights & automation

---

## ⭐ Status

🟢 Actively developed  
🟢 Production deployed  
🟢 Portfolio-ready project