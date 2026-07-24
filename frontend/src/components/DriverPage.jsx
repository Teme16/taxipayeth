import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function DriverPage({ driverId = "65c2b9f1e4b0a123456789ab" }) {
  const [payments, setPayments] = useState([]);
  const [totalToday, setTotalToday] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Audio helper function using Web Speech API
  const announceFare = (amount, seats) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech to prevent overlapping sounds
      window.speechSynthesis.cancel();
      const message = `Payment received. ${amount} Birr for ${seats} seat${seats > 1 ? 's' : ''}`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    // Connect to backend WebSockets server
    const socket = io('http://localhost:5001', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_driver_room', driverId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for live passenger payments broadcasted by server
    socket.on('payment_received', (payload) => {
      const newPayment = {
        transactionId: payload.transactionId || 'TXN-' + Math.floor(100000 + Math.random() * 900000),
        amount: payload.amount || 10.0,
        seats: payload.seats || 1,
        time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setPayments((prev) => [newPayment, ...prev]);
      setTotalToday((prev) => prev + newPayment.amount);
      announceFare(newPayment.amount, newPayment.seats);
    });

    return () => socket.disconnect();
  }, [driverId]);

  // Test simulation helper for offline/sandbox testing
  const simulateTestPayment = () => {
    const randomSeats = Math.floor(Math.random() * 3) + 1;
    const testAmount = randomSeats * 10.0;
    const testPayment = {
      transactionId: 'TEST-' + Math.floor(100000 + Math.random() * 900000),
      amount: testAmount,
      seats: randomSeats,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setPayments((prev) => [testPayment, ...prev]);
    setTotalToday((prev) => prev + testAmount);
    announceFare(testAmount, randomSeats);
  };

  return (
    <div className="max-w-md mx-auto w-full text-white animate-fadeIn">
      <div className="bg-charcoal-card rounded-3xl p-6 shadow-2xl border border-neutral-700/80">
        
        {/* Header & Status */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-2xl font-black">Driver Dashboard</h2>
            <p className="text-gray-400 text-xs mt-0.5">Vehicle: <span className="font-mono text-white">AA-3-A12345</span></p>
          </div>
          
          <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-[11px] font-bold text-gray-300">
              {isConnected ? 'Socket Live' : 'Sandbox Mode'}
            </span>
          </div>
        </div>

        {/* Big Total Earnings Banner */}
        <div className="bg-neutral-900/90 p-5 rounded-2xl mb-6 text-center border border-neutral-800 shadow-inner">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">
            Today's Total Collected
          </span>
          <h3 className="text-4xl font-black text-green-400 tracking-tight">
            ETB {totalToday.toFixed(2)}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            {payments.length} successful transaction{payments.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Sandbox Test Trigger */}
        <button
          onClick={simulateTestPayment}
          className="w-full mb-6 bg-neutral-800 hover:bg-neutral-700 text-taxi-blue-primary border border-taxi-blue-primary/40 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🔊 Simulate Incoming Fare (Test Audio)</span>
        </button>

        {/* Live Payment Stream Log */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Recent Transactions Feed
            </h4>
            {payments.length > 0 && (
              <button
                onClick={() => { setPayments([]); setTotalToday(0); }}
                className="text-[10px] text-gray-500 hover:text-red-400 transition"
              >
                Clear Log
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {payments.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs border-2 border-dashed border-neutral-800 rounded-2xl">
                Waiting for incoming passenger scans...
              </div>
            ) : (
              payments.map((pay, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-900 p-4 rounded-2xl flex justify-between items-center border-l-4 border-green-500 shadow-md animate-fadeIn"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center font-bold text-lg">
                      ↓
                    </div>
                    <div>
                      <p className="text-xs font-mono text-gray-300 font-bold">
                        {pay.transactionId}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {pay.time} • {pay.seats} Seat{pay.seats > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-black text-white">
                    +ETB {pay.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
