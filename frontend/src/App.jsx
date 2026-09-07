import React, { useState, useEffect } from 'react';
import PassengerPage from './components/PassengerPage';
import DriverPage from './components/DriverPage';
import AdminDashboard from './components/AdminDashboard'; // 👈 Import Admin Dashboard
import SplashScreen from './components/SplashScreen';
import AuthPage from './components/AuthPage';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check local storage for persistent session
    const storedUser = localStorage.getItem('taxi_pay_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user data', e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('taxi_pay_token');
    localStorage.removeItem('taxi_pay_user');
    setUser(null);
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} duration={2200} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">
      {/* Logged in User Bar */}
      {user && (
        <div className="w-full max-w-4xl mb-6 flex justify-between items-center bg-neutral-900/80 px-4 py-2.5 rounded-2xl border border-neutral-800 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs uppercase ${
              user.role === 'admin' || user.isAdmin ? 'bg-amber-500' : 'bg-taxi-blue-primary'
            }`}>
              {user.name ? user.name[0] : 'U'}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">{user.name}</p>
              <p className="text-[10px] text-gray-400 capitalize">
                {user.role === 'admin' || user.isAdmin ? '👑 System Administrator' : `${user.role} Portal`}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            type="button"
            className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      )}

      <main className="w-full">
        {!user ? (
          <AuthPage onLoginSuccess={(userData) => setUser(userData)} />
        ) : user.role === 'admin' || user.isAdmin ? (
          /* Admin View */
          <AdminDashboard />
        ) : user.role === 'passenger' ? (
          /* Passenger View */
          <PassengerPage user={user} onUserUpdate={(updated) => {
            localStorage.setItem('taxi_pay_user', JSON.stringify(updated));
            setUser(updated);
          }} />
        ) : (
          /* Driver View */
          <DriverPage
            driverName={user.name || user.driverData?.driverName}
            driverId={user.driverData?.driverId || user.driverId || user._id || user.id}
            targaNo={user.driverData?.targaNo || user.targaNo || 'AA-3-A00000'}
          />
        )}
      </main>
    </div>
  );
}

export default App;