import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish, duration = 2500 }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fading out slightly before unmounting
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    // Completely unmount and load the main app
    const finishTimer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-taxi-blue-primary to-taxi-blue-gradient-end text-white transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated Brand Logo Icon */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute h-24 w-24 rounded-full border-4 border-white/20 animate-ping" />
        <div className="h-20 w-20 rounded-2xl bg-white text-taxi-blue-primary flex items-center justify-center text-4xl font-black shadow-2xl tracking-tighter">
          t
        </div>
      </div>

      {/* App Branding */}
      <h1 className="text-3xl font-black tracking-tight drop-shadow-md">
        Taxi Pay
      </h1>
      <p className="text-blue-100 text-xs mt-1 font-medium tracking-wide uppercase">
        Minibus Transit Ecosystem
      </p>

      {/* Subtle Loading Bar */}
      <div className="w-36 h-1.5 bg-white/20 rounded-full mt-8 overflow-hidden">
        <div className="h-full bg-white rounded-full animate-[pulse_1s_infinite]" />
      </div>
    </div>
  );
}