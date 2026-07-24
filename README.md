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
🚀 Getting Started
Prerequisites
Node.js (v18+ recommended)

MongoDB (Local instance or MongoDB Atlas connection string)

Git

1. Clone the Repository
Bash
git clone [https://github.com/YOUR_USERNAME/taxi-pay.git](https://github.com/YOUR_USERNAME/taxi-pay.git)
cd taxi-pay
2. Backend Setup
Navigate to the backend directory:

Bash
cd backend
Install dependencies:

Bash
npm install
Create a .env file in the backend root:

Code snippet
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/taxipay
JWT_SECRET=your_jwt_secret_key
Start the backend server:

Bash
npm start
The backend cluster will run on http://localhost:5001.

3. Frontend Setup
Open a new terminal and navigate to the frontend directory:

Bash
cd frontend
Install dependencies:

Bash
npm install
Start the Vite development server:

Bash
npm run dev
The frontend application will be live at http://localhost:5173.

💡 How to Test the Real-Time Flow
Driver View: Open a browser tab at http://localhost:5173, register as a Minibus Driver with a vehicle plate (e.g., AA-3-A12345), and enter the dashboard.

Passenger View: Open a second tab (or incognito window), register as a Passenger, scan the vehicle QR, select seat counts, and click Pay with Telebirr.

Live Alert: Watch the transaction instantly register on the driver tab with an automated voice announcement!

📝 License
Distributed under the MIT License. See LICENSE for more information.


---

### How to push this README to GitHub:
Run these commands in your VS Code terminal:

```bash
git add README.md
git commit -m "Docs: Add comprehensive README for Taxi Pay project"
git push origin main
