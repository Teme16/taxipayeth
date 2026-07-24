# 🚕 Taxi Pay — Digital Transit Payment Ecosystem

> A full-stack MERN application designed to digitalize and streamline fare collection for urban minibus transit systems using QR codes, digital wallets (Telebirr), and real-time audio/visual driver notifications.

---

## 🌟 Key Features

* **Role-Based Access Control (RBAC):** Dedicated authentication and tailored workspaces for **Passengers** and **Minibus Drivers**.
* **Zero-Friction QR Passenger Portal:** Passengers scan vehicle-specific QR codes, select seat counts, and execute instant fare checkout via Telebirr integration.
* **Live Driver Audio & Visual Dashboard:** Real-time WebSocket connection pushes incoming payments instantly to drivers with automated **Text-To-Speech audio confirmations** to prevent distracted driving.
* **Digital Transaction Audit:** Secure backend logging of vehicle tariffs, ride history, and financial metrics.
* **Modern Adaptive UI:** Built with React and Tailwind CSS v4, featuring dynamic theme utilities, animated splash screens, and responsive layouts.

---

## 🛠️ Tech Stack

### Frontend
* **Framework:** React.js (Vite)
* **Styling:** Tailwind CSS v4
* **Real-time WebSockets:** Socket.io-client
* **Icons & Animation:** Lucide React

### Backend
* **Runtime:** Node.js & Express.js
* **Database:** MongoDB & Mongoose
* **Real-time Engine:** Socket.io
* **Authentication:** JSON Web Tokens (JWT) & Bcrypt.js

---

## 📁 Repository Structure

```text
Taxi-Pay/
├── backend/
│   ├── models/           # MongoDB schemas (User, Payment, Vehicle)
│   ├── routes/           # Express API endpoints (Auth, Tariffs, Drivers, Payments)
│   └── server.js         # Express app & Socket.io server initialization
├── frontend/
│   ├── src/
│   │   ├── components/   # React components (PassengerPage, DriverPage, SplashScreen, AuthPage)
│   │   ├── App.jsx       # Dynamic routing & session context
│   │   └── main.jsx      # Vite entry point
│   └── index.html
└── README.md
