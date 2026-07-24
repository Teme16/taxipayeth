import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Bell, ArrowDownCircle } from 'lucide-react';

export default function DriverDashboard({ driverId = "65c2b9f1e4b0a123456789ab" }) {
  const [payments, setPayments] = useState([]);
  const [totalToday, setTotalToday] = useState(0);

  useEffect(() => {
    // Establish connection to backend server
    const socket = io('http://localhost:5001');

    socket.emit('join_driver_room', driverId);

    socket.on('payment_received', (payload) => {
      setPayments((prev) => [payload, ...prev]);
      setTotalToday((prev) => prev + payload.amount);

      // Audio trigger: text-to-speech confirmation
      if ('speechSynthesis' in window) {
        const announcement = new SpeechSynthesisUtterance(`Payment Received. ${payload.amount} Birr`);
        announcement.rate = 1.0;
        window.speechSynthesis.speak(announcement);
      }
    });

    return () => socket.disconnect();
  }, [driverId]);

  return (
    <div className="max-w-md mx-auto bg-charcoalCard text-white rounded-3xl p-6 shadow-2xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Driver Dashboard</h2>
          <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span> Live Operational Feed
          </p>
        </div>
        <div className="bg-neutral-900 p-3 rounded-full text-taxiBluePrimary">
          <Bell size={20} />
        </div>
      </div>

      <div className="bg-neutral-900 p-5 rounded-2xl mb-6 text-center border border-neutral-800">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Today's Total Earnings</span>
        <h3 className="text-3xl font-black text-green-400 mt-1">ETB {totalToday.toFixed(2)}</h3>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Today's Payments</h4>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-neutral-800 rounded-xl">
              Waiting for incoming scans...
            </div>
          ) : (
            payments.map((pay, idx) => (
              <div key={idx} className="bg-neutral-900 p-4 rounded-xl flex justify-between items-center border-l-4 border-green-500 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-green-400"><ArrowDownCircle size={24} /></div>
                  <div>
                    <p className="text-xs font-mono text-gray-400">ID: ...{pay.transactionId.slice(-6)}</p>
                    <p className="text-xs text-gray-500">{pay.time} • {pay.seats} Seat{pay.seats > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="text-lg font-black text-white">+ETB {pay.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
