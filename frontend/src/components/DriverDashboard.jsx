import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Bell, ArrowDownCircle, UserCheck, Edit3, X, Check } from 'lucide-react';

export default function DriverDashboard({
  driverId = null,
  onUserUpdate // 👈 Passed down from App.jsx / Parent Layout to update the Top Bar
}) {
  const [resolvedDriverId, setResolvedDriverId] = useState(driverId);
  const [payments, setPayments] = useState([]);
  const [totalToday, setTotalToday] = useState(0);

  // Route States
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [currentRoute, setCurrentRoute] = useState(null);

  // Profile Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    emergencyContact: '',
    birthDate: '',
    licenseNumber: '',
    address: '',
    targaNo: ''
  });

  const [profilePicFile, setProfilePicFile] = useState(null);
  const [digitalIdFile, setDigitalIdFile] = useState(null);

  const token = localStorage.getItem('taxipay_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Fetch initial profile data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('taxi_pay_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const userDriverId = parsedUser.driverData?.driverId || parsedUser.driverId || parsedUser._id || parsedUser.id;
        if (userDriverId) {
          setResolvedDriverId(userDriverId);
        }
      } catch (err) {
        console.error('Failed to parse stored user data:', err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchDriverProfile = async () => {
      try {
        const res = await axios.get(`https://taxipayeth.onrender.com/api/drivers/${resolvedDriverId}`, authHeader);
        if (res.data.success && res.data.driver) {
          const d = res.data.driver;
          setFormData({
            fullName: d.fullName || '',
            mobileNumber: d.mobileNumber || '',
            emergencyContact: d.emergencyContact || '',
            birthDate: d.birthDate ? d.birthDate.split('T')[0] : '',
            licenseNumber: d.licenseNumber || '',
            address: d.address || '',
            targaNo: d.targaNo || ''
          });
          if (d.currentRoute) setCurrentRoute(d.currentRoute);
        }
      } catch (err) {
        console.error('Failed to load driver profile:', err);
      }
    };

    if (resolvedDriverId) fetchDriverProfile();
  }, [resolvedDriverId, token]);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await axios.get('https://taxipayeth.onrender.com/api/routes', authHeader);
        if (res.data.success) {
          setAvailableRoutes(res.data.routes);
        }
      } catch (err) {
        console.error('Failed to load routes:', err);
      }
    };
    fetchRoutes();
  }, [token]);

  // Live Socket Payments & Earnings Tracker
  useEffect(() => {
    const driverRoomId = resolvedDriverId || driverId;
    if (!driverRoomId) return;

    const socket = io('https://taxipayeth.onrender.com', {
      withCredentials: true
    });

    socket.emit('join_driver_room', driverRoomId);

    socket.on('payment_received', (payload) => {
      setPayments((prev) => [payload, ...prev]);
      setTotalToday((prev) => prev + payload.amount);

      if ('speechSynthesis' in window) {
        const announcement = new SpeechSynthesisUtterance(`Payment Received. ${payload.amount} Birr`);
        announcement.rate = 1.0;
        window.speechSynthesis.speak(announcement);
      }
    });

    return () => socket.disconnect();
  }, [driverId, resolvedDriverId]);

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const data = new FormData();
      data.append('driverId', resolvedDriverId || driverId);
      data.append('fullName', formData.fullName);
      data.append('mobileNumber', formData.mobileNumber);
      data.append('emergencyContact', formData.emergencyContact);
      data.append('birthDate', formData.birthDate);
      data.append('licenseNumber', formData.licenseNumber);
      data.append('address', formData.address);
      data.append('targaNo', formData.targaNo);

      if (profilePicFile) data.append('profilePic', profilePicFile);
      if (digitalIdFile) data.append('digitalId', digitalIdFile);

      const res = await axios.post(
        'https://taxipayeth.onrender.com/api/drivers/complete-profile',
        data,
        {
          headers: {
            ...authHeader.headers
          }
        }
      );

      if (res.data.success) {
        // 1. Update localStorage so top bar persists across page refreshes
        if (res.data.user) {
          localStorage.setItem('taxi_pay_user', JSON.stringify(res.data.user));

          // 2. Refresh parent state instantly to update the Top Bar header
          if (onUserUpdate) {
            onUserUpdate(res.data.user);
          }
        }

        setToastMessage('✅ Profile updated and synced!');
        setShowEditModal(false);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      setToastMessage('❌ Failed to update profile');
    } finally {
      setSavingProfile(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleRouteSelect = async (e) => {
    const routeId = e.target.value;
    if (!routeId) return;
    try {
      const res = await axios.put('https://taxipayeth.onrender.com/api/drivers/current-route', { routeId }, authHeader);
      if (res.data.success) {
        setCurrentRoute(res.data.currentRoute);
        setToastMessage('✅ Route updated successfully!');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to update route:', err);
      setToastMessage('❌ Failed to update route');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-neutral-900 text-white rounded-3xl p-6 shadow-2xl border border-neutral-800 relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-800 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl border border-neutral-700 animate-bounce text-xs">
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black">Driver Dashboard</h2>
          <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Operational Feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-neutral-800 hover:bg-neutral-700 p-2.5 rounded-full text-blue-400 transition"
            title="Edit Profile"
          >
            <Edit3 size={18} />
          </button>
          <div className="bg-neutral-800 p-2.5 rounded-full text-blue-400">
            <Bell size={18} />
          </div>
        </div>
      </div>

      {/* Route Selection */}
      <div className="bg-neutral-950 p-4 rounded-2xl mb-6 border border-neutral-800">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Route</label>
        <select
          value={currentRoute?._id || currentRoute || ''}
          onChange={handleRouteSelect}
          className="w-full bg-neutral-900 border border-neutral-700 p-2.5 rounded-xl text-white outline-none focus:border-blue-500"
        >
          <option value="" disabled>Select your active route</option>
          {availableRoutes.map(route => (
            <option key={route._id} value={route._id}>
              {route.name} (ETB {route.baseFare})
            </option>
          ))}
        </select>
      </div>

      {/* Earnings Summary Card */}
      <div className="bg-neutral-950 p-5 rounded-2xl mb-6 text-center border border-neutral-800 shadow-inner">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Today's Total Earnings</span>
        <h3 className="text-3xl font-black text-emerald-400 mt-1">ETB {totalToday.toFixed(2)}</h3>
      </div>

      {/* Incoming Live Payments */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Today's Payments</h4>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs border border-dashed border-neutral-800 rounded-2xl">
              Waiting for incoming passenger scans...
            </div>
          ) : (
            payments.map((pay, idx) => (
              <div key={idx} className="bg-neutral-950 p-4 rounded-2xl flex justify-between items-center border-l-4 border-emerald-500 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-400"><ArrowDownCircle size={22} /></div>
                  <div>
                    <p className="text-xs font-mono text-gray-300">ID: ...{pay.transactionId.slice(-6)}</p>
                    <p className="text-[10px] text-gray-500">{pay.time} • {pay.seats} Seat{pay.seats > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="text-base font-black text-white">+ETB {pay.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 📝 Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black flex items-center gap-2">
                <UserCheck size={20} className="text-blue-400" /> Edit Profile Details
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-bold uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none"
                  placeholder="Kirubel Asmelash"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 font-bold uppercase mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-bold uppercase mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 font-bold uppercase mb-1">Plate Number</label>
                  <input
                    type="text"
                    required
                    value={formData.targaNo}
                    onChange={(e) => setFormData({ ...formData, targaNo: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none font-mono"
                    placeholder="AA-2-3456"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-bold uppercase mb-1">License No.</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold uppercase mb-1">Address / City</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-white outline-none"
                  placeholder="Addis Ababa"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold uppercase mb-1">Profile Picture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProfilePicFile(e.target.files[0])}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 rounded-xl text-gray-400 text-[11px]"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold uppercase mb-1">Digital ID / License Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDigitalIdFile(e.target.files[0])}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 rounded-xl text-gray-400 text-[11px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Check size={16} /> {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 bg-neutral-800 hover:bg-neutral-700 py-2.5 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
