import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import PassengerPage from './components/PassengerPage';
import DriverPage from './components/DriverPage';
import AdminDashboard from './components/AdminDashboard';
import SplashScreen from './components/SplashScreen';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import PaymentSuccess from './components/PaymentSuccess';

function App() {
  const { user, loading, isAuthenticated, isAdmin, logout, updateUser } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Check URL for Chapa redirect
  const params = new URLSearchParams(window.location.search);
  const initialTxRef = params.get('tx_ref');
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(!!initialTxRef);

  const handleProfileUpdate = (updatedUser) => {
    updateUser(updatedUser);
  };

  useEffect(() => {
    const handleOpenProfile = () => setShowProfileModal(true);
    window.addEventListener('openProfile', handleOpenProfile);
    return () => window.removeEventListener('openProfile', handleOpenProfile);
  }, []);

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} duration={2200} />;
  }

  // Show loading spinner while AuthContext validates the session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-6 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-xs font-bold">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">
      {/* Logged in User Bar */}
      {user && (
        <div className="w-full max-w-4xl mb-6 flex justify-between items-center glass-header px-4 py-3 rounded-2xl">
          <div className="flex items-center gap-3">

            {/* Clickable Dynamic Profile Avatar */}
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="relative group cursor-pointer focus:outline-none"
              title="Profile Picture"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'User Profile'}
                  className={`h-8 w-8 rounded-full object-cover border transition transform group-hover:scale-105 ${user.role === 'admin' || user.isAdmin ? 'border-amber-500' : 'border-taxi-blue-primary'
                    }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs uppercase transition transform group-hover:scale-105 ${user.role === 'admin' || user.isAdmin ? 'bg-amber-500' : 'bg-taxi-blue-primary'
                    }`}
                >
                  {user.name ? user.name[0] : 'U'}
                </div>
              )}
            </button>

            {/* Make User Name Clickable to open Profile Details */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="text-left cursor-pointer hover:opacity-80 transition focus:outline-none"
              title="Click to edit profile details"
            >
              <p className="text-xs font-bold text-white leading-tight hover:underline">{user.name}</p>
              <p className="text-[10px] text-blue-400 capitalize">
                {user.role === 'admin' || user.isAdmin ? '👑 System Administrator' : `${user.role}`}
              </p>
            </button>
          </div>

          <button
            onClick={logout}
            type="button"
            className="text-xs glass-button-danger px-4 py-2 rounded-lg transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Profile Picture Lightbox Modal */}
      {showImageModal && user && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-lg w-full glass-card rounded-3xl p-6 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white hover:text-red-300 glass-button p-2 rounded-full transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-sm font-bold text-gray-300 mb-4">{user.name}'s Profile Picture</h3>

            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User Profile Large'}
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-full object-cover border-4 border-neutral-700 shadow-xl"
              />
            ) : (
              <div
                className={`w-64 h-64 sm:w-80 sm:h-80 rounded-full flex items-center justify-center font-black text-white text-6xl uppercase border-4 border-neutral-700 shadow-xl ${user.role === 'admin' || user.isAdmin ? 'bg-amber-500' : 'bg-taxi-blue-primary'
                  }`}
              >
                {user.name ? user.name[0] : 'U'}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4">Click anywhere outside to close</p>
          </div>
        </div>
      )}

      {/* Render Profile Details Modal when user clicks their name */}
      {showProfileModal && user && (
        <ProfilePage
          user={user}
          balance={user.balance}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={(updated) => {
            handleProfileUpdate(updated);
          }}
        />
      )}

      <main className="w-full">
        {showPaymentSuccess ? (
          <PaymentSuccess
            onComplete={() => {
              setShowPaymentSuccess(false);
              // Force AuthContext to refetch user data to update balance
              window.location.reload();
            }}
          />
        ) : !isAuthenticated ? (
          <AuthPage />
        ) : isAdmin ? (
          <AdminDashboard />
        ) : user.role === 'passenger' ? (
          <PassengerPage
            user={user}
            onUserUpdate={(updated) => handleProfileUpdate(updated)}
          />
        ) : (
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