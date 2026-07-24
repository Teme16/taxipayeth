import React, { useState } from 'react';
import axios from 'axios';
import { CreditCard, Users, CheckCircle } from 'lucide-react';

export default function PassengerPay({ driverId = "65c2b9f1e4b0a123456789ab" }) {
  const [seats, setSeats] = useState(1);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  
  const BASE_FARE = 10.00; // Fixed tariff rate per seat in ETB

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!phone) return alert("Please enter your mobile phone number");
    
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5001/api/payments/process-fare', {
        driverId,
        passengerPhone: phone,
        seatCount: seats,
        baseFare: BASE_FARE
      });
      
      if (response.data.success) {
        setReceipt(response.data.receipt);
      }
    } catch (error) {
      console.error("Payment failure:", error);
      alert("Transaction failed. Make sure your backend server is running on port 5001!");
    } finally {
      setLoading(false);
    }
  };

  if (receipt) {
    return (
      <div className="max-w-md mx-auto bg-charcoalCard text-white rounded-3xl p-6 shadow-2xl border border-gray-700 text-center">
        <div className="flex justify-center mb-4 text-green-400">
          <CheckCircle size={64} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Payment Successful</h2>
        <p className="text-gray-400 text-sm mb-6">Receipt for Vehicle {receipt.targaNo}</p>
        
        <div className="bg-neutral-900 rounded-xl p-4 text-left space-y-3 font-mono text-sm">
          <div className="flex justify-between"><span>Txn ID:</span> <span className="text-gray-300">{receipt.transactionId}</span></div>
          <div className="flex justify-between"><span>Amount Paid:</span> <span className="text-green-400 font-bold">ETB {receipt.amountPaid.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Seats Booked:</span> <span className="text-gray-300">{receipt.seatsBooked}</span></div>
          <div className="flex justify-between"><span>Paid Via:</span> <span className="text-blue-400 font-bold">Telebirr</span></div>
        </div>
        
        <button onClick={() => setReceipt(null)} className="mt-6 w-full bg-taxiBluePrimary hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition">
          Done / Reset
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-charcoalCard text-white rounded-3xl p-6 shadow-2xl border border-gray-700">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Welcome to Taxi Pay</h2>
        <p className="text-gray-400 text-sm">Scan Successful • Select Seats & Pay</p>
      </div>

      <form onSubmit={handlePayment} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Seats Booked</label>
          <div className="relative">
            <Users className="absolute left-3 top-3.5 text-gray-500" size={18} />
            <select 
              value={seats} 
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-transparent focus:border-taxiBluePrimary rounded-xl py-3 pl-10 pr-4 text-white appearance-none outline-none"
            >
              {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num} Seat{num > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Telebirr Mobile Number</label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-3.5 text-gray-500" size={18} />
            <input 
              type="tel" 
              placeholder="0912345678" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-neutral-900 border border-transparent focus:border-taxiBluePrimary rounded-xl py-3 pl-10 pr-4 text-white outline-none"
            />
          </div>
        </div>

        <div className="bg-neutral-900 p-4 rounded-xl flex justify-between items-center">
          <span className="text-sm text-gray-400">Total Calculation:</span>
          <span className="text-xl font-black text-white">ETB {(seats * BASE_FARE).toFixed(2)}</span>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-taxiBluePrimary hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition"
        >
          {loading ? "Processing..." : "Confirm & Pay with Telebirr"}
        </button>
      </form>
    </div>
  );
}
