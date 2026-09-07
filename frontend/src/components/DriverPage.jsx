import React, { useState, useEffect } from 'react';
import { 
  QrCode, Armchair, X, Radio, RefreshCw, 
  Bell, Wallet, Receipt, User, Phone, Calendar, ShieldCheck, 
  FileText, Edit3, Camera, Upload, CheckCircle, ShieldAlert, MapPin
} from 'lucide-react';
import { io } from 'socket.io-client';
import DriverQRModal from './DriverQRModal';
import DriverReceiptModal from './DriverReceiptModal';

const socket = io('http://localhost:5001');

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

  const activeDriverId = normalizeDriverId(driver?.id || driver?._id || driver?.driverId || propDriverId || 'DRV-98231');
  const activeDriverName = driver?.fullName || driver?.name || driverName;
  const activeTargaNo = driver?.targaNo || targaNo;

  const formatPicUrl = (picPath) => {
    if (!picPath) return null;
    if (picPath.startsWith('http')) return picPath;
    const cleanPath = picPath.replace(/\\/g, '/').replace(/^uploads\//, '');
    return `http://localhost:5001/uploads/${cleanPath}`;
  };

  const [profilePicUrl, setProfilePicUrl] = useState(formatPicUrl(driver?.profilePic || driver?.driverData?.profileImage));

  // Modals & UI States
  const [showQRModal, setShowQRModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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
  const [totalEarnings, setTotalEarnings] = useState(0);
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

  // Fetch driver data & listen for socket updates
  useEffect(() => {
    if (!activeDriverId) return;

    const fetchDriverProfile = async () => {
      try {
        const token = localStorage.getItem('taxi_pay_token');
        const res = await fetch(`http://localhost:5001/api/drivers/${activeDriverId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.driver) {
          setDriver(data.driver);
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

    fetchDriverProfile();
    socket.emit('join_driver_room', activeDriverId);

    const handleSeatStatusChange = (data) => {
      const { seatNumbers, status, passengerName, amount, transactionId, timestamp } = data;
      if (!seatNumbers) return;

      const seatsToUpdate = Array.isArray(seatNumbers) ? seatNumbers.map(Number) : [Number(seatNumbers)];

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
            id: transactionId || Date.now(),
            passengerName: passengerName || 'Passenger',
            seats: seatsToUpdate,
            amount: numericAmount,
            date: timestamp || new Date().toISOString()
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

    socket.on('seat_status_changed', handleSeatStatusChange);
    return () => socket.off('seat_status_changed', handleSeatStatusChange);
  }, [activeDriverId, activeDriverName, activeTargaNo]);

  const toggleSeatStatus = (seatNum) => {
    setSeatStates((prev) => {
      const current = prev[seatNum] || 'unpaid';
      let nextStatus = 'unpaid';
      if (current === 'unpaid') nextStatus = 'pending';
      else if (current === 'pending') nextStatus = 'paid';

      const newState = { ...prev, [seatNum]: nextStatus };
      socket.emit('update_seat_status', { driverId: activeDriverId, seatNumbers: [seatNum], status: nextStatus });
      return newState;
    });
  };

  const resetAllSeats = () => {
    const resetState = {};
    for (let i = 1; i <= 15; i++) resetState[i] = 'unpaid';
    setSeatStates(resetState);

    socket.emit('update_seat_status', {
      driverId: activeDriverId,
      seatNumbers: Array.from({ length: 15 }, (_, i) => i + 1),
      status: 'unpaid'
    });
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

      const token = localStorage.getItem('taxi_pay_token');

      const response = await fetch('http://localhost:5001/api/drivers/complete-profile', {
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
        
        // Sync editFormData with the newly saved backend data
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
        <div className="fixed top-4 right-4 left-4 max-w-md mx-auto bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 z-50 animate-bounce">
          <Bell size={22} className="text-emerald-200 shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-xs">{notification.title}</h4>
            <p className="text-[11px] opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold p-1">✕</button>
        </div>
      )}

      {/* Driver Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsEditingProfile(false);
                setShowProfileModal(true);
              }}
              className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500 hover:border-emerald-400 transition cursor-pointer shadow-lg bg-neutral-950 flex items-center justify-center shrink-0 group"
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
            className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-2xl shadow-lg transition flex flex-col items-center gap-1 cursor-pointer border border-blue-400/30"
          >
            <QrCode size={20} />
            <span className="text-[9px] font-bold">Show QR</span>
          </button>
        </div>

        {/* Earnings Card */}
        <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Trip Earnings</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">{totalEarnings} ETB</span>
            </div>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            type="button"
            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-emerald-400 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <Receipt size={16} /> History ({transactions.length})
          </button>
        </div>
      </div>

      {/* Minibus Seat Occupancy Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white">Minibus Occupancy</h3>
            <p className="text-[11px] text-gray-400">Tap seat to toggle state manually</p>
          </div>
          <button onClick={resetAllSeats} className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 bg-neutral-800 p-2 rounded-xl transition border border-neutral-700 cursor-pointer">
            <RefreshCw size={12} /> Reset Trip
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center">
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-1.5 rounded-lg">Unpaid ({15 - paidCount - pendingCount})</div>
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-1.5 rounded-lg">Pending ({pendingCount})</div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-1.5 rounded-lg">Paid ({paidCount})</div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
          {Array.from({ length: 15 }, (_, i) => i + 1).map((seatNum) => {
            const status = seatStates[seatNum] || 'unpaid';
            const statusBg = status === 'paid' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : status === 'pending' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-red-500/10 border-red-500/40 text-red-400/80';
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

      {/* DRIVER PROFILE MODAL - PREMIUM REDESIGN */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300"></div>
          <div className="relative w-full max-w-md bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] text-white max-h-[90vh] overflow-y-auto overflow-x-hidden transform transition-all duration-300 scale-100">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black bg-linear-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                {isEditingProfile ? 'Update Profile' : 'Driver Identity'}
              </h3>
              <div className="flex items-center gap-2">
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-2xl bg-neutral-800/50 hover:bg-neutral-700/50 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {profileError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-2xl text-xs flex items-center gap-2 shadow-inner">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {!isEditingProfile ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* ID Card Top */}
                <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-neutral-800/80 to-neutral-900/80 border border-white/5 p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
                  <div className="absolute top-0 inset-x-0 h-1/2 bg-linear-to-b from-emerald-500/10 to-transparent"></div>
                  
                  <div className="relative w-28 h-28 rounded-full p-1 bg-linear-to-tr from-emerald-500 to-teal-300 shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-neutral-950 flex items-center justify-center">
                      {profilePicUrl ? (
                        <img src={profilePicUrl} alt={activeDriverName} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                      ) : (
                        <User size={48} className="text-emerald-400/50" />
                      )}
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black tracking-tight">{activeDriverName}</h3>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-inner">
                        ID: {driver?.licenseNumber || driver?.driverData?.licenseNo || 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col justify-center transition-all hover:bg-neutral-800/60">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5 mb-1"><ShieldCheck size={12} className="text-emerald-400" /> Targa (Plate)</span>
                    <span className="font-mono font-bold text-sm text-white">{activeTargaNo}</span>
                  </div>
                  <div className="bg-neutral-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col justify-center transition-all hover:bg-neutral-800/60">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5 mb-1"><Phone size={12} className="text-blue-400" /> Phone</span>
                    <span className="font-mono font-bold text-sm text-white">{driver?.mobileNumber || driver?.phone || editFormData.mobileNumber || 'N/A'}</span>
                  </div>
                  <div className="bg-neutral-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col justify-center transition-all hover:bg-neutral-800/60">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5 mb-1"><MapPin size={12} className="text-pink-400" /> Address</span>
                    <span className="font-medium text-sm text-white">{driver?.address || editFormData.address || 'N/A'}</span>
                  </div>
                  <div className="bg-neutral-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col justify-center transition-all hover:bg-neutral-800/60">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-amber-400" /> Birth Date</span>
                    <span className="font-medium text-sm text-white">{driver?.birthDate || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 bg-neutral-800/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-neutral-800/60">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5 mb-1"><FileText size={12} className="text-purple-400" /> Verification Docs</span>
                      <span className="text-xs font-medium text-gray-300">Digital ID / Fayda</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shadow-inner ${driver?.digitalIdDoc || driver?.driverData?.documentUrl ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {driver?.digitalIdDoc || driver?.driverData?.documentUrl ? 'Verified' : 'Missing'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="w-full bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black py-4 rounded-2xl text-sm transition-all transform hover:scale-[1.02] shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Edit3 size={18} /> Update Information
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-24 h-24 rounded-full p-1 bg-linear-to-tr from-emerald-500/50 to-transparent flex items-center justify-center overflow-hidden cursor-pointer group hover:from-emerald-400 transition-all shadow-lg">
                    <div className="w-full h-full bg-neutral-950 rounded-full flex flex-col items-center justify-center relative overflow-hidden border border-white/10">
                      {profilePicPreview ? (
                        <img src={profilePicPreview} alt="Preview" className="w-full h-full object-cover group-hover:opacity-50 transition" />
                      ) : profilePicUrl ? (
                        <img src={profilePicUrl} alt="Current" className="w-full h-full object-cover group-hover:opacity-50 transition" />
                      ) : (
                        <Camera size={28} className="text-gray-500 group-hover:text-emerald-400 transition" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                        <Camera size={24} className="text-white" />
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setNewProfilePic, setProfilePicPreview, profilePicPreview)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile Photo</span>
                </div>

                <div className="space-y-4">
                  <div className="group">
                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Full Name</label>
                    <input
                      type="text"
                      value={editFormData.fullName}
                      onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Mobile Phone</label>
                      <input
                        type="tel"
                        value={editFormData.mobileNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                        className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
                        required
                      />
                    </div>
                    <div className="group">
                      <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Plate Number</label>
                      <input
                        type="text"
                        value={editFormData.targaNo}
                        onChange={(e) => setEditFormData({ ...editFormData, targaNo: e.target.value })}
                        className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Birth Date</label>
                      <input
                        type="date"
                        value={editFormData.birthDate}
                        onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                        className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
                      />
                    </div>
                    <div className="group">
                      <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">License No.</label>
                      <input
                        type="text"
                        value={editFormData.licenseNumber}
                        onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
                        className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Emergency Phone</label>
                    <input
                      type="tel"
                      value={editFormData.emergencyContact}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContact: e.target.value })}
                      className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
                    />
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Address / City</label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Update Digital ID Document</label>
                  <div className="relative w-full h-24 bg-neutral-950/50 border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center p-2 cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all">
                    {digitalIdPreview ? (
                      <img src={digitalIdPreview} alt="ID Preview" className="h-full object-contain rounded-lg" />
                    ) : (
                      <div className="text-center space-y-1">
                        <Upload size={20} className="mx-auto text-gray-500 group-hover:text-emerald-400 transition" />
                        <span className="text-[10px] font-medium text-gray-400 block group-hover:text-emerald-300 transition">Tap or drag to upload ID</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileChange(e, setNewDigitalId, setDigitalIdPreview, digitalIdPreview)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="w-1/3 bg-neutral-800/80 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-2xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-2/3 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black py-3.5 rounded-2xl text-xs transition-all transform hover:scale-[1.02] shadow-[0_10px_20px_-10px_rgba(16,185,129,0.4)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:transform-none"
                  >
                    {savingProfile ? (
                      <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Saving...</span>
                    ) : (
                      <><CheckCircle size={16} /> Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showQRModal && (
        <DriverQRModal
          driverName={activeDriverName}
          driverId={activeDriverId}
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