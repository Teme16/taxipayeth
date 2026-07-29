import React, { useState } from 'react';
import { X, Receipt, CheckCircle, Search, Calendar, Hash, User } from 'lucide-react';

export default function ReceiptModal({ history, user, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter((item) =>
    item.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.targaNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.driverName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">My Receipts</h3>
              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <User size={10} /> {user?.name || 'Passenger'} ({user?.phone || 'Guest'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search Txn ID, Plate, or Driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Receipt List */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No transactions found for this user account.
            </div>
          ) : (
            filteredHistory.map((receipt) => (
              <div
                key={receipt.transactionId}
                className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-4 space-y-2 hover:border-emerald-500/30 transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold flex items-center gap-1">
                    <CheckCircle size={10} /> PAID
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                    <Calendar size={10} /> {receipt.timestamp}
                  </span>
                </div>

                <div className="flex justify-between items-end pt-1">
                  <div>
                    <h4 className="font-bold text-sm text-white">{receipt.driverName}</h4>
                    <p className="text-[11px] text-gray-400 font-mono">Plate: {receipt.targaNo}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      Seat(s): <span className="text-white font-bold">{Array.isArray(receipt.seats) ? receipt.seats.join(', ') : receipt.seats}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-mono uppercase block">{receipt.paymentMethod || 'Telebirr'}</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">{receipt.amountPaid} ETB</span>
                  </div>
                </div>

                <div className="border-t border-neutral-800/60 pt-2 mt-2 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Hash size={10} /> {receipt.transactionId}
                  </span>
                  <span className="text-gray-400 font-sans">User: {receipt.passengerPhone}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}