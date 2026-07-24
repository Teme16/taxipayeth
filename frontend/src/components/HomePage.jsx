import React from 'react';

export default function HomePage({ onSelectRole }) {
  return (
    <div className="max-w-xl mx-auto w-full text-white animate-fadeIn">
      {/* Hero Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-xs font-semibold mb-4 backdrop-blur-md border border-white/10">
          <span className="text-yellow-400">⚡</span>
          <span>Next-Gen Minibus Transit Sandbox</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-md">
          Welcome to <span className="text-taxi-blue-primary bg-white px-2 py-0.5 rounded-xl ml-1">Taxi Pay</span>
        </h1>
        <p className="text-blue-100 text-sm mt-3 max-w-md mx-auto leading-relaxed">
          Fast, cashless fare collection for passengers and real-time audio alerts for drivers. Select a role below to explore the live portal.
        </p>
      </div>

      {/* Portal Access Cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {/* Passenger Card */}
        <button
          onClick={() => onSelectRole('passenger')}
          className="group relative bg-charcoal-card hover:bg-neutral-800 p-6 rounded-3xl border border-neutral-700/80 shadow-xl text-left transition-all duration-300 hover:-translate-y-1 hover:border-taxi-blue-primary cursor-pointer"
        >
          <div className="h-12 w-12 rounded-2xl bg-taxi-blue-primary/20 text-taxi-blue-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-2xl">
            📱
          </div>
          <h3 className="text-xl font-bold mb-1 flex items-center justify-between">
            Passenger Portal
            <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-taxi-blue-primary">→</span>
          </h3>
          <p className="text-gray-400 text-xs leading-relaxed">
            Simulate scanning a vehicle QR code, picking seat counts, and executing a Telebirr wallet transaction.
          </p>
        </button>

        {/* Driver Card */}
        <button
          onClick={() => onSelectRole('driver')}
          className="group relative bg-charcoal-card hover:bg-neutral-800 p-6 rounded-3xl border border-neutral-700/80 shadow-xl text-left transition-all duration-300 hover:-translate-y-1 hover:border-green-500 cursor-pointer"
        >
          <div className="h-12 w-12 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-2xl">
            📊
          </div>
          <h3 className="text-xl font-bold mb-1 flex items-center justify-between">
            Driver Dashboard
            <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-green-400">→</span>
          </h3>
          <p className="text-gray-400 text-xs leading-relaxed">
            Monitor real-time WebSockets feed, instant fare pop-ups, and listen to incoming voice confirmations.
          </p>
        </button>
      </div>

      {/* Feature Badges */}
      <div className="flex justify-center items-center gap-6 text-xs text-blue-200/80 border-t border-white/10 pt-6">
        <span className="flex items-center gap-1.5">
          <span className="text-green-400">🛡️</span> Secure Telebirr Gateway
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-yellow-400">⚡</span> Instant Socket.io Push
        </span>
      </div>
    </div>
  );
}