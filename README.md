<p align="center">
  <img src="https://img.shields.io/badge/PaySphere-Payroll%20in%20Seconds-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjNjM2NmYxIi8+PHRleHQgeD0iNTAiIHk9IjY4IiBmb250LXNpemU9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSIgZm9udC13ZWlnaHQ9ImJvbGQiPlA8L3RleHQ+PC9zdmc+" alt="PaySphere" />
</p>

<h1 align="center">PaySphere 💰</h1>

<p align="center">
  <strong>Payroll in seconds, not hours.</strong><br/>
  A lightweight payroll management system built for small businesses in India.
</p>

<p align="center">
  <a href="https://www.figma.com/proto/v7oAom74sFxLaaf0JO8UvI/Untitled?node-id=501-1971&viewport=16164%2C15242%2C0.12&t=n1yfHauC6Rlr6HhY-1&scaling=scale-down&content-scaling=fixed&starting-point-node-id=501%3A1971&page-id=11%3A29"><b>Figma Design</b></a> •
  <a href="https://paysphere-dev-patel.vercel.app/"><b>Live Project</b></a> •
  <a href="https://documenter.getpostman.com/view/50839751/2sBXqKofJr"><b>Postman Documentation</b></a> •
  <a href="https://paysphere-p0nt.onrender.com"><b>Backend API</b></a> •
  <a href="https://youtu.be/N3SizOsiNGw"><b>YouTube Demo</b></a>
</p>

---

## ❗ Problem Statement

Small businesses employing fewer than 10 workers spend hours every month manually calculating salaries factoring in paid leave, unpaid absences, overtime hours, and festival bonuses. 

Most payroll software is built for **large enterprises**, making them:
- Too complex for tiny teams.
- Expensive and over-engineered.
- Not optimized for the fast-paced "Digital Ledger" style of Bharat.

👉 Result: **Wasted time, calculation errors, and frustration.**

---

## 💡 Solution

PaySphere simplifies payroll into a **3-step workflow**:
1. 👥 **Add Employees**: Quickly onboard your team with base salary and overtime rates.
2. 💬 **Log Updates**: Add leaves, overtime, and bonuses through a clean, intuitive interface.
3. ⚡ **Run Payroll**: Generate professional payslips and finalize payouts in one click.

---

## 🎯 Features

| Feature | Description |
| :--- | :--- |
| 🔐 **Google Authentication** | Secure Login & Signup with Google One-Tap integration. |
| 🛡️ **Role-Based Access Control (RBAC)** | Granular permissions with **Admin**, **Manager**, and **Viewer** roles for team collaboration. |
| 👥 **Employee Management** | Dashboard view with status, role, and salary at a glance. |
| 📥 **Bulk Employee Import (CSV)** | Onboard entire teams in seconds by uploading a CSV file with row-level validation & duplicate detection. |
| 💬 **Activity Tracking** | Log leave, overtime, bonuses, and deductions per employee. |
| ⚡ **Instant Payroll** | Automated calculation of Net Salary based on monthly activity. |
| 📄 **Professional Payslips** | Download detailed PDF breakdowns for each payout. |
| 📧 **Bulk Payslip Emailing** | One-click or auto-scheduled (via cron) email dispatch of payslips to all employees. |
| 📊 **Advanced Reporting & Analytics** | Interactive dashboard with payroll trends, department/role breakdowns, and overtime analysis. |
| 📑 **XLSX Payroll Summaries** | Export formatted Excel spreadsheets with totals and per-employee breakdowns. |
| 📦 **ZIP Payslip Export** | Download a single ZIP archive containing all employee payslip PDFs for a given month. |
| 📋 **Audit Logging** | Event bus tracking for all mutations (payroll runs, employee CRUD, imports, emails, reports) with IP & user agent. |
| 📱 **Responsive Design** | Fully optimized for Mobile, Tablet, and Desktop. |

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js (v19), Vite, Tailwind CSS v4, MUI (Material UI), Redux Toolkit, Recharts, React Router |
| **Backend** | Node.js, Express.js (v5), MongoDB, Mongoose, **Redis** (Caching layer), **BullMQ** (Background Jobs) |
| **Deployment** | Vercel (Frontend), Render (Backend) |
| **Tools & Libraries** | **ExcelJS** (XLSX exports), **Archiver** (ZIP archives), **Nodemailer** (SMTP emails), PDFKit, Multer, csv-parse, node-cron, Winston, Helmet, Jest (Testing) |

---

## 📁 Project Structure

```text
paysphere/
├── backend/
│   ├── src/
│   │   ├── config/             # Database connection & environment config
│   │   ├── controllers/        # Business logic (employees, payroll, reports, users)
│   │   │   └── __tests__/      # Controller unit tests (Jest + Supertest)
│   │   ├── jobs/               # Scheduled cron jobs (monthly payslip emails)
│   │   ├── middlewares/        # Auth, error handling, rate limiting, file upload
│   │   │   └── __tests__/      # Middleware tests
│   │   ├── models/             # Mongoose schemas (User, Employee, Payroll, AuditLog, CronLock)
│   │   ├── routes/             # API endpoint definitions
│   │   ├── seeds/              # Database seed scripts
│   │   ├── services/           # Cross-cutting services (audit logging, email dispatch)
│   │   │   └── __tests__/      # Service tests
│   │   ├── utils/              # Helpers: salary calculator, CSV export, logger, validators, email
│   │   │   └── __tests__/      # Utility unit tests
│   │   ├── workers/            # Background worker threads (PDF generation)
│   │   ├── app.js              # Express app setup & middleware chain
│   │   └── index.js            # Server entry point & cron job bootstrap
├── frontend/
│   ├── src/
│   │   ├── assets/             # Images and local files
│   │   ├── components/         # Reusable UI Components
│   │   │   ├── common/         # Button, Input, Modal, Skeleton, EmptyState, etc.
│   │   │   └── reports/        # Charts & tables: PayrollTrend, SalaryDistribution, etc.
│   │   ├── features/           # Feature-based slices (Auth, UI, User) + Redux hooks & services
│   │   ├── hooks/              # Global reusable React hooks (e.g., useLocalStorage)
│   │   ├── pages/              # Main route views (Landing, Dashboard, Reports, Settings, etc.)
│   │   ├── services/           # API services (axios config + request helpers)
│   │   ├── store/              # Redux store configuration
│   │   ├── utils/              # Helper functions and constants
│   │   ├── App.jsx             # Route definitions & global providers
│   │   ├── main.jsx            # React root & app bootstrap
│   │   └── index.css           # Global styles + Tailwind directives
```


---

## 📸 Screenshots

### **Dashboard Overview**
![PaySphere Dashboard](./frontend/src/assets/dashboard-mockup.png)

---

## 🚀 Installation & Setup

### 1. Backend Configuration
Copy the `.env.example` file to create a `.env` file in `backend/`:
```bash
cp .env.example .env
```
Update the variables with your own values:
```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Database
MONGO_URI=your_mongodb_uri

# Authentication
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret

# Caching & Background Jobs
REDIS_URI=your_redis_connection_uri

# Email (SMTP)
# Backend sends payslips & notifications directly via SMTP. If SMTP is
# not configured, it falls back to the Vercel proxy at FRONTEND_URL/api/send-email,
# then to console logging.
EMAIL_HOST=your_smtp_host            # e.g. smtp.gmail.com
EMAIL_PORT=587                       # or 465 for SSL
EMAIL_SECURE=false                   # true for port 465
EMAIL_USER=your_smtp_username        # e.g. your_email@gmail.com
EMAIL_PASS=your_smtp_password        # or app password
EMAIL_FROM="PaySphere <no-reply@paysphere.com>"
EMAIL_PROXY_SECRET=your_email_proxy_secret_key

# Aliases (used by SMTP transport — populate both pairs for compatibility)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass

# Logging
LOG_LEVEL=info
```

### 2. Frontend Configuration
Copy the `.env.example` file to create a `.env` file in `frontend/`:
```bash
cp .env.example .env
```
Update the variables with your own values:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_id

# Email Proxy SMTP (used by Vercel Serverless Function at /api/send-email)
EMAIL_PROXY_SECRET=your_email_proxy_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_SECURE=false
EMAIL_FROM="PaySphere" <no-reply@paysphere.com>
```

### 3. Run Development
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

### 4. Run with Docker (Recommended)

The entire stack (MongoDB + backend + frontend) can be started with a single command using [Docker Compose](https://docs.docker.com/compose/). Hot-reloading is enabled for both the backend (nodemon) and the frontend (Vite HMR).

Prerequisites: [Docker](https://www.docker.com/products/docker-desktop/) with Docker Compose v2.

```bash
# From the repo root
docker compose up --build
```

This starts:
- **MongoDB** at `localhost:27017`
- **Backend API** at `http://localhost:5000`
- **Frontend** at `http://localhost:5173`

All services work out of the box with sensible defaults. To override secrets and Google/SMTP settings, copy the root `.env.example` to `.env` and edit it:

```bash
cp .env.example .env
```

Then restart the stack for changes to take effect:

```bash
docker compose up -d
docker compose restart backend
```

Useful commands:

```bash
# Build/start all services in the background
docker compose up --build -d

# Stream logs from all services (or one: docker compose logs backend)
docker compose logs -f

# Stop the stack (keeps the MongoDB volume)
docker compose down

# Stop and delete the MongoDB data volume
docker compose down -v
```

> **Note:** Redis is optional. Without a `REDIS_URL`, caching falls back to an in-memory store and background payslip email jobs remain available in a degraded mode.

### 5. Testing
```bash
# Run backend test suite (Jest + Supertest)
cd backend && npm test
```

---

<p align="center">
  <strong>PaySphere</strong> — Payroll in seconds, not hours. ⚡
</p>
