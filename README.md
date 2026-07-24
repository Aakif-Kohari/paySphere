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
| 👥 **Employee Management** | Dashboard view with status, role, and salary at a glance. |
| 💬 **Activity Tracking** | Log leave, overtime, bonuses, and deductions per employee. |
| ⚡ **Instant Payroll** | Automated calculation of Net Salary based on monthly activity. |
| 📄 **Professional Payslips** | Download detailed PDF breakdowns for each payout. |
| 📱 **Responsive Design** | Fully optimized for Mobile, Tablet, and Desktop. |

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Vite, Tailwind CSS v4, MUI (Material UI) |
| **Backend** | Node.js, Express.js, MongoDB |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## 📁 Project Structure

```text
paysphere/
├── backend/
│   ├── src/
│   │   ├── config/             # Database connection
│   │   ├── controllers/        # Business logic
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # API endpoint definitions
│   │   └── index.js            # Server entry point
├── frontend/
│   ├── src/
│   │   ├── assets/             # Images and local files
│   │   ├── components/         # Reusable UI Components
│   │   │   ├── common/         # Button, Input, Modal, etc.
│   │   │   └── layout/         # Sidebar, Navbar, etc.
│   │   ├── pages/              # Main route views
│   │   ├── features/           # Feature-based modules (Auth, Dashboard)
│   │   ├── hooks/              # Global reusable React hooks
│   │   ├── services/           # API services (axios config)
│   │   ├── utils/              # Helper functions and constants
│   │   ├── App.jsx             # Route definitions
│   │   └── main.jsx            # React root & Context providers
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
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
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
```

### 3. Run Development
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

---

<p align="center">
  <strong>PaySphere</strong> — Payroll in seconds, not hours. ⚡
</p>
