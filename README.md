<div align="center">

  <!-- SVG Custom Logo Header -->
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#0F172A"/>
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5C5 13.67 5.67 13 6.5 13C7.33 13 8 13.67 8 14.5C8 15.33 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5C16 13.67 16.67 13 17.5 13C18.33 13 19 13.67 19 14.5C19 15.33 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="#2563EB"/>
    <circle cx="12" cy="11" r="2" fill="#10B981"/>
  </svg>

  # 🚕 Taxi Pay
  ### *Real-Time Digital Fare Collection for Urban Transit*

  [![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Cluster-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

  <p align="center">
    A production-grade full-stack MERN platform designed to eliminate cash handling in urban minibus transit systems. Integrates instant vehicle QR scanning, Telebirr checkout, WebSocket event streaming, and automated hands-free Text-to-Speech audio alerts for drivers.
  </p>

  ---
</div>

## 📌 Architecture Overview

```text
 📱 PASSENGER PORTAL             ⚡ NODE.JS / EXPRESS CLUSTER         🔊 DRIVER DASHBOARD
 ┌──────────────────────┐        ┌────────────────────────────┐        ┌──────────────────────┐
 │  • Scans Vehicle QR  │        │  • JWT Auth Verification   │        │  • Instant Visual Log│
 │  • Dynamic Tariff    │ ─────► │  • Payment DB Persistence  │ ─────► │  • Real-Time Audio   │
 │  • Telebirr Checkout │        │  • Socket.io Room Broadcast│        │    TTS Announcement  │
 └──────────────────────┘        └────────────────────────────┘        └──────────────────────┘
✨ Key Platform Capabilities🔒 JWT-Enforced Role-Based Access Control (RBAC): Dynamic portal mounting and route protection for Passengers and Minibus Drivers.📲 Instant QR Fare Calculation: Auto-computes total route tariffs based on passenger seat selection and vehicle-specific rates.🔊 Hands-Free Driver Voice Alerts: Uses the browser-native Web Speech API to loudly synthesize incoming payment notifications (e.g., "Payment received: 30 Birr for 2 seats"), letting drivers stay focused on the road.⚡ Bi-Directional WebSocket Sync: Socket.io room isolation pushes transaction confirmations to drivers instantaneously without polling.🎨 Adaptive Mobile-First UI: Responsive dark-mode interface built with React & Tailwind CSS v4 featuring modern card layouts and animated splash entry.🛠️ Tech Stack & EcosystemLayerTechnologiesFrontend AppReact 18, Tailwind CSS v4, Socket.io-Client, Lucide React, Web Speech APIBackend APINode.js, Express.js, Socket.io, JWT (jsonwebtoken), Bcrypt.jsDatabaseMongoDB & Mongoose ORMDev ToolingVite, Nodemon, Git📂 Project StructurePlaintextTaxi-Pay/
├── 📁 backend/
│   ├── 📁 models/          # MongoDB schemas (User, Payment, Tariff)
│   ├── 📁 routes/          # API Controllers (Auth, Tariffs, Drivers, Payments)
│   └── 📄 server.js        # Express application & Socket.io server engine
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── 📁 components/  # Core Components (PassengerPage, DriverPage, AuthPage, SplashScreen)
│   │   ├── 📄 App.jsx      # Session management & role-based routing
│   │   └── 📄 main.jsx     # Client entry point
│   └── 📄 index.html
└── 📄 README.md
🚀 Local Development Setup1. Clone the RepositoryBashgit clone [https://github.com/YOUR_USERNAME/taxi-pay.git](https://github.com/YOUR_USERNAME/taxi-pay.git)
cd taxi-pay
2. Configure & Start BackendBashcd backend
npm install
Create a .env file in the backend/ directory:Code snippetPORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/taxipay
JWT_SECRET=taxipay_super_secret_jwt_key
Run the backend server:Bashnpm start
# 🚀 Server active at http://localhost:5001
3. Configure & Start FrontendOpen a new terminal session in the project root:Bashcd frontend
npm install
npm run dev
# 💻 Client active at http://localhost:5173
🧪 Real-Time Simulation GuideDriver Workspace: Open http://localhost:5173 in Browser Window A, register or log in as a Minibus Driver with a vehicle plate (e.g., AA-3-A12345), and enter the dashboard.Passenger Workspace: Open http://localhost:5173 in a Private / Incognito Window, register as a Passenger, scan the vehicle QR code, select seat count, and tap Pay with Telebirr.Live Sync: Observe the live payment transaction appear in Window A while your machine's audio output announces the received fare out loud!📝 LicenseThis project is licensed under the MIT License — see the LICENSE file for details.
---

### Push it to GitHub in terminal:

```bash
git add README.md
git commit -m "Docs: Update README with custom SVG logo and real-time MERN architecture"
git push origin main
