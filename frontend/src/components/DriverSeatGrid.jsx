import React from 'react';
import { Armchair, Check, AlertTriangle, X } from 'lucide-react';

export default function DriverSeatGrid({ seatStates, onToggleSeatStatus }) {
  const seatNumbers = Array.from({ length: 15 }, (_, i) => i + 1);

  const getSeatColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-emerald-500/10'; // GREEN = PAID
      case 'pending':
        return 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'; // YELLOW = PENDING
      default:
        return 'bg-red-500/10 border-red-500/40 text-red-400/80 hover:border-red-400'; // RED = UNPAID
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'paid') return <Check size={12} />;
    if (status === 'pending') return <AlertTriangle size={12} />;
    return <X size={12} />;
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-black text-white">Live Minibus Occupancy</h3>
          <p className="text-xs text-gray-400">Click any seat to manually toggle cash/paid status</p>
        </div>
        <div className="flex gap-2 text-xs font-mono">
          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-bold">
            {Object.values(seatStates).filter(s => s === 'paid').length} / 15 Paid
          </span>
        </div>
      </div>

      {/* Driver Visual Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
        {seatNumbers.map((seatNum) => {
          const status = seatStates[seatNum] || 'unpaid';
          return (
            <button
              key={seatNum}
              onClick={() => onToggleSeatStatus(seatNum)}
              className={`h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-black text-xs transition-all shadow-md cursor-pointer ${getSeatColor(status)}`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Armchair size={14} />
                <span>#{seatNum}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider flex items-center gap-0.5 font-sans font-bold">
                {getStatusIcon(status)} {status}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}