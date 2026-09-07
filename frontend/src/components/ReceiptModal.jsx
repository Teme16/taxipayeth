import React, { useState } from 'react';
import { X, Receipt, CheckCircle, Search, Calendar, Hash, User, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function ReceiptModal({ history, user, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      (item.transactionId && item.transactionId.toLowerCase().includes(term)) ||
      (item.targaNo && item.targaNo.toLowerCase().includes(term)) ||
      (item.driverName && item.driverName.toLowerCase().includes(term)) ||
      (item.type && item.type.toLowerCase().includes(term))
    );
  });

  // Helper to determine if transaction represents money outgoing/loss
  const isOutgoingTxn = (type) => {
    const outgoingTypes = ['payment', 'withdraw', 'withdrawal', 'payout', 'send'];
    return outgoingTypes.includes(type?.toLowerCase());
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 glass-panel border border-white/20 rounded-xl text-white">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">My Transactions</h3>
              <p className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                <User size={10} /> {user?.name || 'Passenger'} ({user?.phone || 'Guest'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 glass-panel hover:bg-neutral-700 rounded-xl text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search Txn ID, Type, Plate, or Driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-panel border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {/* Receipt List */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No transactions found for this user account.
            </div>
          ) : (
            filteredHistory.map((receipt) => {
              // Determine transaction direction based on receipt.type or defaults
              const isOutgoing = isOutgoingTxn(receipt.type || 'payment');
              const txnType = receipt.type ? receipt.type.toUpperCase() : (isOutgoing ? 'PAYMENT' : 'DEPOSIT');

              return (
                <div
                  key={receipt.transactionId}
                  className={`glass-panel border rounded-2xl p-4 space-y-2 transition ${isOutgoing
                      ? 'border-white/10/80 hover:border-red-500/30'
                      : 'border-white/10/80 hover:border-emerald-500/30'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    {/* Status & Type Badge */}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 uppercase ${isOutgoing
                          ? 'glass-button-danger text-red-400 border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                    >
                      {isOutgoing ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                      {txnType}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                      <Calendar size={10} /> {receipt.timestamp}
                    </span>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {receipt.driverName || (isOutgoing ? 'Withdrawal' : 'Deposit Top-up')}
                      </h4>
                      {receipt.targaNo && (
                        <p className="text-[11px] text-gray-400 font-mono">Plate: {receipt.targaNo}</p>
                      )}
                      {receipt.seats && (
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          Seat(s):{' '}
                          <span className="text-white font-bold">
                            {Array.isArray(receipt.seats) ? receipt.seats.join(', ') : receipt.seats}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Amount & Color Indicator */}
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-mono uppercase block">
                        {receipt.paymentMethod || 'Telebirr'}
                      </span>
                      <span
                        className={`text-lg font-black font-mono ${isOutgoing ? 'text-red-400' : 'text-emerald-400'
                          }`}
                      >
                        {isOutgoing ? `-` : `+`}
                        {receipt.amountPaid || receipt.amount} ETB
                      </span>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div className="border-t border-white/10/60 pt-2 mt-2 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Hash size={10} /> {receipt.transactionId}
                    </span>
                    <span className="text-gray-400 font-sans">
                      User: {receipt.passengerPhone || user?.phone}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}