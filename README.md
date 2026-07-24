<div align="center">

  <!-- Project Logo / Hero Banner -->
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#1E293B"/>
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5C5 13.67 5.67 13 6.5 13C7.33 13 8 13.67 8 14.5C8 15.33 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5C16 13.67 16.67 13 17.5 13C18.33 13 19 13.67 19 14.5C19 15.33 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="#3B82F6"/>
    <circle cx="12" cy="11" r="2" fill="#10B981"/>
  </svg>

  # 🚕 Taxi Pay
  ### *Next-Gen Digital Transit Payment Ecosystem*

  [![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Cluster-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

  <p align="center">
    A full-stack MERN platform modernizing urban minibus fare collection using dynamic QR code scanning, digital wallets (Telebirr), and hands-free real-time audio announcements for drivers.
  </p>

  ---
</div>

## ⚡ Core Value Proposition

In fast-paced urban transit environments, cash handling creates operational bottlenecks and safety risks. **Taxi Pay** solves this by bridging passengers and drivers with real-time WebSocket communication and browser-native Speech Synthesis.

```text
 📱 Passenger Scans QR           ⚡ Express & Socket.io Hub           🔊 Driver Dashboard
 ┌──────────────────────┐        ┌─────────────────────────┐        ┌──────────────────────┐
 │  • Select Seats      │ ─────► │  • Validates JWT        │ ─────► │  • Real-time Visual  │
 │  • Pay via Telebirr  │        │  • Broadcasts Transaction│        │  • Voice TTS Audio   │
 └──────────────────────┘        └─────────────────────────┘        └──────────────────────┘
