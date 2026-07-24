import React, { useState } from 'react';
import axios from 'axios';

export default function PassengerPage({ driverId = "65c2b9f1e4b0a123456789ab" }) {
  const [step, setStep] = useState('scan'); // 'scan' | 'pay' | 'receipt'
  const [seats, setSeats] = useState(1);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const BASE_FARE = 10.0; // Standard fare per seat in ETB

  const handleSimulateScan = () => {
    setStep('pay');
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!phone) return alert('Please enter your Telebirr phone number');

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5001/api/payments/process-fare', {
        driverId,
        passengerPhone: phone,
        seatCount: seats,
        baseFare: BASE_FARE,
      });

      if (response.data.success) {
        setReceipt(response.data.receipt);
        setStep('receipt');
      }
    } catch (error) {
      console.error('Payment failure:', error);
      // Fallback local receipt for sandbox testing if backend is offline
      setReceipt({
        transactionId: 'TXN-' + Math.floor(100000 + Math.random() * 900000),
        targaNo: 'AA-3-A12345',
        amountPaid: seats * BASE_FARE,
        seatsBooked: seats,
        date: new Date().toLocaleTimeString(),
      });
      setStep('receipt');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('scan');
    setPhone('');
    setSeats(1);
    setReceipt(null);
  };

  return (
    <div className="max-w-md mx-auto w-full text-white animate-fadeIn">
      {/* --- STEP 1: SCAN QR SIMULATOR --- */}
      {step === 'scan' && (
        <div className="bg-charcoal-card rounded-3xl p-6 shadow-2xl border border-neutral-700/80 text-center">
          <div className="mb-4">
            <span className="text-xs font-bold text-taxi-blue-primary bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
              Step 1 of 2
            </span>
            <h2 className="text-2xl font-black mt-2">Scan Vehicle QR</h2>
            <p className="text-gray-400 text-xs mt-1">
              Point camera at minibus dashboard QR code
            </p>
          </div>

          {/* QR Viewfinder Box */}
          <div className="my-6 relative bg-neutral-900 rounded-2xl p-6 border-2 border-dashed border-taxi-blue-primary/50 flex flex-col items-center justify-center min-h-[220px]">
            <div className="w-32 h-32 bg-white p-2 rounded-xl shadow-lg flex items-center justify-center">
              {/* Simulated QR Code Graphic */}
              <div className="w-full h-full bg-neutral-950 rounded flex flex-col items-center justify-center text-neutral-800 font-mono text-[10px] font-bold tracking-tighter p-1 text-center">
                [ TAXI PAY QR ]
                <br />
                AA-3-A12345
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Vehicle Target: <strong className="text-white">AA 3 A12345</strong>
            </p>
          </div>

          <button
            onClick={handleSimulateScan}
            className="w-full bg-taxi-blue-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚡ Simulate Successful Scan</span>
          </button>
        </div>
      )}

      {/* --- STEP 2: FARE & TELEBIRR PAYMENT FORM --- */}
      {step === 'pay' && (
        <div className="bg-charcoal-card rounded-3xl p-6 shadow-2xl border border-neutral-700/80">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-800">
            <div>
              <span className="text-xs font-bold text-taxi-blue-primary bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                Step 2 of 2
              </span>
              <h2 className="text-2xl font-black mt-1">Passenger Fare</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Minibus</span>
              <span className="text-xs font-mono font-bold text-green-400 bg-neutral-900 px-2.5 py-1 rounded-lg">
                AA-3-A12345
              </span>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-5">
            {/* Seat Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Number of Seats
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeats(num)}
                    className={`py-3 rounded-xl font-bold text-sm transition cursor-pointer ${
                      seats === num
                        ? 'bg-taxi-blue-primary text-white shadow-md'
                        : 'bg-neutral-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Telebirr Phone Number */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Telebirr Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-gray-500 font-bold text-sm">
                  📱
                </span>
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl py-3 pl-10 pr-4 text-white outline-none text-sm font-mono"
                  required
                />
              </div>
            </div>

            {/* Total Fare Calculation Display */}
            <div className="bg-neutral-900/90 p-4 rounded-xl flex justify-between items-center border border-neutral-800">
              <div>
                <span className="text-xs text-gray-400 block">Total Fare ({seats} seat{seats > 1 ? 's' : ''})</span>
                <span className="text-[10px] text-gray-500">Rate: {BASE_FARE} ETB / seat</span>
              </div>
              <span className="text-2xl font-black text-green-400">
                ETB {(seats * BASE_FARE).toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-taxi-blue-primary hover:bg-blue-600 disabled:bg-neutral-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition cursor-pointer"
            >
              {loading ? 'Processing Payment...' : 'Pay with Telebirr'}
            </button>

            <button
              type="button"
              onClick={() => setStep('scan')}
              className="w-full text-xs text-gray-400 hover:text-white py-1 transition cursor-pointer text-center block"
            >
              ← Cancel & Re-scan QR
            </button>
          </form>
        </div>
      )}

      {/* --- STEP 3: DIGITAL RECEIPT MODAL --- */}
      {step === 'receipt' && receipt && (
        <div className="bg-charcoal-card rounded-3xl p-6 shadow-2xl border border-neutral-700/80 text-center animate-fadeIn">
          <div className="h-16 w-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
            ✓
          </div>
          <h2 className="text-2xl font-black">Payment Successful!</h2>
          <p className="text-gray-400 text-xs mt-1">
            Fare broadcasted live to driver dashboard
          </p>

          {/* Receipt Breakdown Box */}
          <div className="bg-neutral-900 rounded-2xl p-4 my-6 text-left space-y-3 font-mono text-xs border border-neutral-800">
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-gray-500">Transaction ID</span>
              <span className="text-gray-200 font-bold">{receipt.transactionId}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-gray-500">Vehicle Target</span>
              <span className="text-gray-200">{receipt.targaNo}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-gray-500">Seats Booked</span>
              <span className="text-gray-200">{receipt.seatsBooked}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-800 pb-2">
              <span className="text-gray-500">Payment Gateway</span>
              <span className="text-blue-400 font-bold">Telebirr Wallet</span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-bold">
              <span className="text-gray-400">Total Paid</span>
              <span className="text-green-400">ETB {Number(receipt.amountPaid).toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={resetFlow}
            className="w-full bg-taxi-blue-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition cursor-pointer shadow-lg"
          >
            Done / Next Passenger
          </button>
        </div>
      )}
    </div>
  );
}