import React, { useState, useEffect } from 'react';
import {
  QrCode, Armchair, X, Radio, RefreshCw,
  Bell, Wallet, Receipt, User, Phone, Calendar, ShieldCheck,
  FileText, Edit3, Camera, Upload, CheckCircle, ShieldAlert, MapPin
} from 'lucide-react';
import { io } from 'socket.io-client';
import DriverQRModal from './DriverQRModal';
import DriverReceiptModal from './DriverReceiptModal';

// Dynamic API & Socket URL setup
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:5001';
const SOCKET_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_URL) || API_BASE_URL;

const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  transports: ['polling', 'websocket']
});

const normalizeDriverId = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export default function DriverPage({
  driver: initialDriver,
  driverId: propDriverId,
  targaNo = 'AA-3-A12345',
  driverName = 'Abebe Kebede'
}) {
  const [driver, setDriver] = useState(initialDriver || null);

  // Prioritize the User ObjectId for socket room matching (this is what the payment route emits to)
  const activeUserObjectId = normalizeDriverId(driver?.user?._id || driver?.user || driver?.userId || driver?._id || propDriverId);
  // Display-friendly driverId (string like 'DRV-98231') for UI only
  const activeDriverId = normalizeDriverId(driver?.driverId || driver?.driverData?.driverId || propDriverId || driver?.id || driver?._id || '');
  const activeDriverName = driver?.fullName || driver?.name || driverName;
  const activeTargaNo = driver?.targaNo || targaNo;

  const formatPicUrl = (picPath) => {
    if (!picPath) return null;
    if (picPath.startsWith('http') || picPath.startsWith('data:')) return picPath;
    const cleanPath = picPath.replace(/\\/g, '/').replace(/^uploads\//, '');
    return `${API_BASE_URL}/uploads/${cleanPath}`;
  };

  const [profilePicUrl, setProfilePicUrl] = useState(formatPicUrl(driver?.profilePic || driver?.driverData?.profileImage));

  // Modals & UI States
  const [showQRModal, setShowQRModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form Data
  const [editFormData, setEditFormData] = useState({
    fullName: activeDriverName,
    mobileNumber: driver?.mobileNumber || driver?.phone || '',
    targaNo: activeTargaNo,
    birthDate: driver?.birthDate || '',
    licenseNumber: driver?.licenseNumber || driver?.driverData?.licenseNo || '',
    emergencyContact: driver?.emergencyContact || '',
    address: driver?.address || ''
  });

  const [newProfilePic, setNewProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [newDigitalId, setNewDigitalId] = useState(null);
  const [digitalIdPreview, setDigitalIdPreview] = useState(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [notification, setNotification] = useState(null);

  // Earnings & Seats
  const [totalEarnings, setTotalEarnings] = useState(initialDriver?.totalEarnings || 0);
  const [transactions, setTransactions] = useState([]);
  const [seatStates, setSeatStates] = useState({
    1: 'unpaid', 2: 'unpaid', 3: 'unpaid', 4: 'unpaid', 5: 'unpaid',
    6: 'unpaid', 7: 'unpaid', 8: 'unpaid', 9: 'unpaid', 10: 'unpaid',
    11: 'unpaid', 12: 'unpaid', 13: 'unpaid', 14: 'unpaid', 15: 'unpaid'
  });

  // Sync props to state
  useEffect(() => {
    if (initialDriver) {
      setDriver(initialDriver);
      if (initialDriver.totalEarnings !== undefined) {
        setTotalEarnings(initialDriver.totalEarnings);
      }
      setProfilePicUrl(formatPicUrl(initialDriver.profilePic || initialDriver.driverData?.profileImage));
      setEditFormData({
        fullName: initialDriver.fullName || initialDriver.name || driverName,
        mobileNumber: initialDriver.mobileNumber || initialDriver.phone || '',
        targaNo: initialDriver.targaNo || initialDriver.driverData?.targaNo || targaNo,
        birthDate: initialDriver.birthDate || '',
        licenseNumber: initialDriver.licenseNumber || initialDriver.driverData?.licenseNo || '',
        emergencyContact: initialDriver.emergencyContact || '',
        address: initialDriver.address || ''
      });
    }
  }, [initialDriver, driverName, targaNo]);

  // ═══════════════════════════════════════════════════════════════
  // SINGLE consolidated socket + driver-data effect
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const token = localStorage.getItem('taxipay_token');

    // ── 1. Fetch the Driver profile from API ──────────────────
    const fetchDriverProfile = async () => {
      try {
        const lookupId = activeUserObjectId || activeDriverId;
        if (!lookupId) return;
        const res = await fetch(`${API_BASE_URL}/api/drivers/${lookupId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.driver) {
          setDriver(data.driver);
          if (data.driver.totalEarnings !== undefined) {
            setTotalEarnings(data.driver.totalEarnings);
          }
          setProfilePicUrl(formatPicUrl(data.driver.profilePic || data.driver.driverData?.profileImage));
          setEditFormData({
            fullName: data.driver.fullName || data.driver.name || activeDriverName,
            mobileNumber: data.driver.mobileNumber || data.driver.phone || '',
            targaNo: data.driver.targaNo || data.driver.driverData?.targaNo || activeTargaNo,
            birthDate: data.driver.birthDate || '',
            licenseNumber: data.driver.licenseNumber || data.driver.driverData?.licenseNo || '',
            emergencyContact: data.driver.emergencyContact || '',
            address: data.driver.address || ''
          });
        }
      } catch (err) {
        console.error('Driver fetch error:', err);
      }
    };

    if (activeUserObjectId || activeDriverId) {
      fetchDriverProfile();
    }

    // ── 1b. Fetch Transaction History ─────────────────────────────
    const fetchDriver = async () => {
      if (initialDriver) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/drivers/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.driver) {
          setDriver(data.driver);
        }
      } catch (err) {
        console.error('Driver fetch error:', err);
      }
    };

    const fetchHistory = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/payments/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.transactions) {
          const formattedTransactions = data.transactions.map(t => ({
            transactionId: t.transactionId || t._id,
            passengerName: t.passengerSnapshot?.name || 'Passenger',
            passengerPhone: t.passengerSnapshot?.phone || '',
            seats: t.seats || [],
            amount: t.amount,
            createdAt: t.createdAt,
            paymentStatus: t.status || 'SUCCESS'
          }));
          setTransactions(formattedTransactions);

          // Restore seat states from today's successful transactions after lastTripResetAt
          setSeatStates(prev => {
            const newStates = { ...prev };

            // Only consider transactions after lastTripResetAt (if provided)
            let resetTime = 0;
            if (data.lastTripResetAt) {
              resetTime = new Date(data.lastTripResetAt).getTime();
            }

            data.transactions.forEach(t => {
              const txTime = new Date(t.createdAt).getTime();
              if (txTime > resetTime && t.status !== 'failed' && t.type !== 'withdraw' && Array.isArray(t.seats)) {
                t.seats.forEach(s => {
                  newStates[s] = 'paid';
                });
              }
            });
            return newStates;
          });
        }
      } catch (err) {
        console.error('History fetch error:', err);
      }
    };

    fetchDriver();
    fetchHistory();

    // ── 2. Socket setup ───────────────────────────────────────
    // Helper: join all relevant rooms once the socket is connected
    const joinRooms = () => {
      // Join with User ObjectId (primary — matches what the payment route emits to)
      if (activeUserObjectId) {
        socket.emit('join_driver_room', activeUserObjectId);
        socket.emit('register_online_user', activeUserObjectId);
      }
      // Join with display driverId as fallback
      if (activeDriverId && activeDriverId !== activeUserObjectId) {
        socket.emit('join_driver_room', activeDriverId);
      }
      // If we have the fetched driver object, also join with its document IDs
      if (driver) {
        if (driver._id) socket.emit('join_driver_room', String(driver._id));
        if (driver.user) {
          const userIdStr = typeof driver.user === 'object'
            ? String(driver.user._id || driver.user)
            : String(driver.user);
          socket.emit('join_driver_room', userIdStr);
        }
      }
      console.log('[DriverPage] Socket rooms joined. activeUserObjectId:', activeUserObjectId, 'activeDriverId:', activeDriverId);
    };

    // Handler for seat status changes from the server
    const handleSeatStatusChange = (data) => {
      console.log('🔥 [DriverPage] RECEIVED SOCKET EVENT:', data);

      const { seatNumbers, status, passengerName, amount, transactionId, timestamp } = data;
      if (!seatNumbers) {
        console.warn('⚠️ [DriverPage] Received event without seatNumbers!');
        return;
      }

      const seatsToUpdate = Array.isArray(seatNumbers) ? seatNumbers.map(Number) : [Number(seatNumbers)];
      console.log(`[DriverPage] Updating seats ${seatsToUpdate.join(', ')} to status: ${status}`);

      setSeatStates((prev) => {
        const updated = { ...prev };
        seatsToUpdate.forEach((s) => { updated[s] = status; });
        return updated;
      });

      if (status === 'paid' && amount) {
        const numericAmount = Number(amount);
        setTotalEarnings((prev) => prev + numericAmount);

        setTransactions((prev) => [
          {
            transactionId: transactionId || `TXN-${Date.now()}`,
            passengerName: passengerName || 'Passenger',
            passengerPhone: '',
            seats: seatsToUpdate,
            amount: numericAmount,
            createdAt: timestamp || new Date().toISOString(),
            paymentStatus: 'SUCCESS'
          },
          ...prev
        ]);

        setNotification({
          title: '💰 Payment Received!',
          message: `${passengerName || 'Passenger'} paid ${amount} ETB for Seat(s) #${seatsToUpdate.join(', ')}`
        });
        setTimeout(() => setNotification(null), 6000);
      }
    };

    // Register the listener BEFORE connecting so buffered events aren't lost
    socket.on('seat_status_changed', handleSeatStatusChange);

    // When the socket connects (or is already connected), join rooms
    if (socket.connected) {
      joinRooms();
    }
    socket.on('connect', joinRooms);

    // Connect the socket if not already connected
    if (!socket.connected && token) {
      socket.auth = { token };
      socket.connect();
    }

    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading, speed } = position.coords;
          socket.emit('driver_location_update', {
            lat: latitude,
            lng: longitude,
            heading,
            speed
          });
        },
        (err) => console.warn('Geolocation tracking disabled or failed:', err.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      socket.off('seat_status_changed', handleSeatStatusChange);
      socket.off('connect', joinRooms);
      socket.disconnect();
    };
  }, [activeUserObjectId, activeDriverId, activeDriverName, activeTargaNo, driver?._id]);

  const toggleSeatStatus = (seatNum) => {
    setSeatStates((prev) => {
      const current = prev[seatNum] || 'unpaid';
      let nextStatus = 'unpaid';
      if (current === 'unpaid') nextStatus = 'pending';
      else if (current === 'pending') nextStatus = 'paid';

      const newState = { ...prev, [seatNum]: nextStatus };
      socket.emit('update_seat_status', { driverId: activeUserObjectId || activeDriverId, seatNumbers: [seatNum], status: nextStatus });
      return newState;
    });
  };

  const resetAllSeats = async () => {
    const token = localStorage.getItem('taxipay_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/reset-trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const resetState = {};
          for (let i = 1; i <= 15; i++) resetState[i] = 'unpaid';
          setSeatStates(resetState);
        }
      }
    } catch (err) {
      console.error('Reset trip error:', err);
    }
  };

  const handleFileChange = (e, setFile, setPreview, currentPreview) => {
    const file = e.target.files[0];
    if (file) {
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');

    try {
      const data = new FormData();
      data.append('driverId', activeDriverId);
      data.append('fullName', editFormData.fullName);
      data.append('mobileNumber', editFormData.mobileNumber);
      data.append('targaNo', editFormData.targaNo);
      data.append('birthDate', editFormData.birthDate);
      data.append('licenseNumber', editFormData.licenseNumber);
      data.append('emergencyContact', editFormData.emergencyContact);
      data.append('address', editFormData.address);

      if (newProfilePic) data.append('profilePic', newProfilePic);
      if (newDigitalId) data.append('digitalId', newDigitalId);

      const token = localStorage.getItem('taxipay_token');

      const response = await fetch(`${API_BASE_URL}/api/drivers/complete-profile`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: data
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setDriver(result.driver);
        setProfilePicUrl(formatPicUrl(result.driver.profilePic || result.driver.driverData?.profileImage));

        setEditFormData({
          fullName: result.driver.fullName || result.driver.name || activeDriverName,
          mobileNumber: result.driver.mobileNumber || result.driver.phone || '',
          targaNo: result.driver.targaNo || result.driver.driverData?.targaNo || activeTargaNo,
          birthDate: result.driver.birthDate || '',
          licenseNumber: result.driver.licenseNumber || result.driver.driverData?.licenseNo || '',
          emergencyContact: result.driver.emergencyContact || '',
          address: result.driver.address || ''
        });

        if (result.user) {
          localStorage.setItem('taxi_pay_user', JSON.stringify(result.user));
        }

        setIsEditingProfile(false);
        setNotification({
          title: '✅ Profile Saved',
          message: 'Your profile details have been saved to the database.'
        });
        setTimeout(() => setNotification(null), 5000);
      } else {
        setProfileError(result.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setProfileError('Failed to connect to backend server.');
    } finally {
      setSavingProfile(false);
    }
  };

  const paidCount = Object.values(seatStates).filter((s) => s === 'paid').length;
  const pendingCount = Object.values(seatStates).filter((s) => s === 'pending').length;

  return (
    <div className="max-w-md mx-auto w-full text-white space-y-4 p-2 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 left-4 max-w-md mx-auto glass-button text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 z-50 animate-bounce">
          <Bell size={22} className="text-emerald-200 shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-xs">{notification.title}</h4>
            <p className="text-[11px] opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold p-1">✕</button>
        </div>
      )}

      {/* Driver Header */}
      <div className="glass-card border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event('openProfile'));
              }}
              className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500 hover:border-emerald-400 transition cursor-pointer shadow-lg glass-panel flex items-center justify-center shrink-0 group"
              title="Click to view/edit profile"
            >
              {profilePicUrl ? (
                <img src={profilePicUrl} alt={activeDriverName} className="w-full h-full object-cover" />
              ) : (
                <User size={26} className="text-emerald-400" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Edit3 size={14} className="text-white" />
              </div>
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                <Radio size={10} className="animate-pulse" /> Live Driver
              </span>
              <h2 className="text-xl font-black font-mono mt-0.5">{activeTargaNo}</h2>
              <p className="text-xs text-gray-400">{activeDriverName}</p>
            </div>
          </div>

          <button
            onClick={() => setShowQRModal(true)}
            type="button"
            className="glass-button-primary hover:bg-blue-500 text-white p-2.5 rounded-2xl shadow-lg transition flex flex-col items-center gap-1 cursor-pointer border border-blue-400/30"
          >
            <QrCode size={20} />
            <span className="text-[9px] font-bold">Show QR</span>
          </button>
        </div>

        {/* Earnings Card */}
        <div className="glass-panel border border-white/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Trip Earnings</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{totalEarnings.toFixed(2)} ETB</span>
            </div>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            type="button"
            className="glass-panel hover:bg-neutral-700 border border-white/20 text-emerald-400 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <Receipt size={16} /> History ({transactions.length})
          </button>
        </div>
      </div>

      {/* Minibus Seat Occupancy Grid */}
      <div className="glass-card border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-black text-white">Minibus Occupancy</h3>
            <p className="text-[11px] text-gray-400">Tap seat to toggle state manually</p>
          </div>
          <button onClick={resetAllSeats} className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 glass-panel p-2 rounded-xl transition border border-white/20 cursor-pointer">
            <RefreshCw size={12} /> Reset Trip
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center">
          <div className="glass-button-danger border border-red-500/30 text-red-400 p-1.5 rounded-lg">Unpaid ({15 - paidCount - pendingCount})</div>
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-1.5 rounded-lg">Pending ({pendingCount})</div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-1.5 rounded-lg">Paid ({paidCount})</div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 glass-panel p-4 rounded-2xl border border-white/10">
          {Array.from({ length: 15 }, (_, i) => i + 1).map((seatNum) => {
            const status = seatStates[seatNum] || 'unpaid';
            const statusBg = status === 'paid' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : status === 'pending' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'glass-button-danger border-red-500/40 text-red-400/80';
            return (
              <button key={seatNum} type="button" onClick={() => toggleSeatStatus(seatNum)} className={`h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-black text-xs transition-all cursor-pointer ${statusBg}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <Armchair size={14} />
                  <span>#{seatNum}</span>
                </div>
                <span className="text-[9px] uppercase font-sans font-bold">{status}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DRIVER PROFILE MODAL REMOVED - Using Global ProfilePage instead */}

      {showQRModal && (
        <DriverQRModal
          driverName={activeDriverName}
          driverId={activeDriverId}
          userId={driver?.user?._id || driver?.user || driver?._id || ''}
          targaNo={activeTargaNo}
          defaultTariff={15}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {showHistoryModal && (
        <DriverReceiptModal
          transactions={transactions}
          totalEarnings={totalEarnings}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}