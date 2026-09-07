import React from 'react';
import { Armchair } from 'lucide-react';

export default function SeatPicker({ selectedSeats, setSelectedSeats, seatStates = {} }) {
  // Total 15 seats structured by minibus rows
  const seatLayout = [
    { rowLabel: 'Front Row (Driver Side)', seats: [1, 2] },
    { rowLabel: 'Row 2', seats: [3, 4, 5] },
    { rowLabel: 'Row 3', seats: [6, 7, 8] },
    { rowLabel: 'Row 4', seats: [9, 10, 11] },
    { rowLabel: 'Back Row', seats: [12, 13, 14, 15] },
  ];

  const toggleSeat = (seatNum) => {
    // Prevent selecting already paid seats
    if (seatStates[seatNum] === 'paid') return;

    if (selectedSeats.includes(seatNum)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNum));
    } else {
      setSelectedSeats([...selectedSeats, seatNum]);
    }
  };

  const getSeatColor = (seatNum) => {
    const status = seatStates[seatNum];
    if (status === 'paid') return 'bg-red-500/20 border-red-500 text-red-400 cursor-not-allowed'; // Red for taken/paid
    if (status === 'pending') return 'bg-amber-500/20 border-amber-500 text-amber-400'; // Yellow
    if (selectedSeats.includes(seatNum)) return 'bg-taxi-blue-primary text-white border-blue-400 scale-105'; // Selected
    return 'bg-neutral-800 border-neutral-700 text-gray-400 hover:border-gray-500 hover:text-white cursor-pointer'; // Default Unpaid state
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Select Minibus Seats</h4>
        <span className="text-xs font-mono font-bold text-taxi-blue-primary">
          {selectedSeats.length} Selected
        </span>
      </div>

      {/* Minibus Cabin Layout */}
      <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 space-y-3">
        {/* Driver Indicator */}
        <div className="flex justify-between items-center px-2 pb-2 border-b border-neutral-800/80 text-[10px] font-bold text-gray-500 uppercase">
          <span className="bg-neutral-800 px-2 py-0.5 rounded text-gray-400">🚨 Driver Zone</span>
          <span>Door Side 👉</span>
        </div>

        {seatLayout.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-2">
            {row.seats.map((seatNum) => (
              <button
                key={seatNum}
                onClick={() => toggleSeat(seatNum)}
                className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition-all relative ${getSeatColor(seatNum)}`}
              >
                <Armchair size={14} className="mb-0.5 opacity-80" />
                {seatNum}
              </button>
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}