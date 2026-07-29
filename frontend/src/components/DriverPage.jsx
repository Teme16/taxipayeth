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

  const [profilePicUrl, setProfilePicUrl] = useState(formatPicUrl(driver?.profilePic));

  // Modals & UI States
  const [showQRModal, setShowQRModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Form Data
  const [editFormData, setEditFormData] = useState({
    fullName: activeDriverName,
    birthDate: driver?.birthDate || '',
    licenseNumber: driver?.licenseNumber || '',
    emergencyContact: driver?.emergencyContact || '',
    mobileNumber: driver?.mobileNumber || '',
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
      setProfilePicUrl(formatPicUrl(initialDriver.profilePic));
      setEditFormData({
        fullName: initialDriver.fullName || driverName,
        birthDate: initialDriver.birthDate || '',
        licenseNumber: initialDriver.licenseNumber || '',
        emergencyContact: initialDriver.emergencyContact || '',
        mobileNumber: initialDriver.mobileNumber || '',
        address: initialDriver.address || ''
      });
    }
  }, [initialDriver, driverName]);

  // Fetch driver data & listen for socket updates
  useEffect(() => {
    if (!activeDriverId) return;

    const fetchDriverProfile = async () => {
      try {
        const res = await fetch(`http://localhost:5001/api/drivers/${activeDriverId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.driver) {
          setDriver(data.driver);
          setProfilePicUrl(formatPicUrl(data.driver.profilePic));
          setEditFormData({
            fullName: data.driver.fullName || activeDriverName,
            birthDate: data.driver.birthDate || '',
            licenseNumber: data.driver.licenseNumber || '',
            emergencyContact: data.driver.emergencyContact || '',
            mobileNumber: data.driver.mobileNumber || '',
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

        // Append to transactions array
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
  }, [activeDriverId, activeDriverName]);

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
      data.append('birthDate', editFormData.birthDate);
      data.append('licenseNumber', editFormData.licenseNumber);
      data.append('emergencyContact', editFormData.emergencyContact);
      data.append('mobileNumber', editFormData.mobileNumber);
      data.append('address', editFormData.address);

      if (newProfilePic) data.append('profilePic', newProfilePic);
      if (newDigitalId) data.append('digitalId', newDigitalId);

      const response = await fetch('http://localhost:5001/api/drivers/complete-profile', {
        method: 'POST',
        body: data
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setDriver(result.driver);
        setProfilePicUrl(formatPicUrl(result.driver.profilePic));
        setIsEditingProfile(false);
        setNotification({
          title: '✅ Profile Saved',
          message: 'Your profile details have been saved.'
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

      {/* DRIVER PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-4 text-white max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="text-lg font-black">{isEditingProfile ? 'Edit Profile' : 'Driver Profile'}</h3>
              <div className="flex items-center gap-2">
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-gray-400 hover:text-white p-1.5 rounded-xl bg-neutral-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {profileError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-2xl text-xs flex items-center gap-2">
                <ShieldAlert size={16} />
                <span>{profileError}</span>
              </div>
            )}

            {!isEditingProfile ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500 overflow-hidden shadow-xl bg-neutral-950 flex items-center justify-center">
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt={activeDriverName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{activeDriverName}</h3>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block mt-1">
                      License: {driver?.licenseNumber || 'Not set'}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-gray-400 flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Vehicle Plate (Targa)</span>
                    <span className="font-mono font-bold text-white">{activeTargaNo}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-gray-400 flex items-center gap-1.5"><Phone size={14} className="text-blue-400" /> Mobile Number</span>
                    <span className="font-mono text-white">{driver?.mobileNumber || editFormData.mobileNumber || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-gray-400 flex items-center gap-1.5"><MapPin size={14} className="text-pink-400" /> Address</span>
                    <span className="text-white">{driver?.address || editFormData.address || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-gray-400 flex items-center gap-1.5"><Calendar size={14} className="text-amber-400" /> Birth Date</span>
                    <span className="text-white">{driver?.birthDate || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-gray-400 flex items-center gap-1.5"><Phone size={14} className="text-red-400" /> Emergency Phone</span>
                    <span className="font-mono text-white">{driver?.emergencyContact || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5"><FileText size={14} className="text-purple-400" /> Digital ID Document</span>
                    <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${driver?.digitalIdDoc ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                      {driver?.digitalIdDoc ? 'Uploaded' : 'Missing'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} /> Edit Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-xs font-bold text-gray-300">Change Profile Photo</label>
                  <div className="relative w-20 h-20 rounded-full bg-neutral-950 border-2 border-dashed border-emerald-500/50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-400 transition">
                    {profilePicPreview ? (
                      <img src={profilePicPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : profilePicUrl ? (
                      <img src={profilePicUrl} alt="Current" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-gray-400" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setNewProfilePic, setProfilePicPreview, profilePicPreview)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">Mobile Phone</label>
                    <input
                      type="tel"
                      value={editFormData.mobileNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">Emergency Phone</label>
                    <input
                      type="tel"
                      value={editFormData.emergencyContact}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContact: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">Birth Date</label>
                    <input
                      type="date"
                      value={editFormData.birthDate}
                      onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">License No.</label>
                    <input
                      type="text"
                      value={editFormData.licenseNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, licenseNumber: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">Address / City</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">Update Digital ID Photo</label>
                  <div className="relative w-full h-20 bg-neutral-950 border border-dashed border-neutral-800 rounded-xl flex items-center justify-center p-2 cursor-pointer hover:border-emerald-500/50 transition">
                    {digitalIdPreview ? (
                      <img src={digitalIdPreview} alt="ID Preview" className="h-full object-contain rounded" />
                    ) : (
                      <div className="text-center space-y-1">
                        <Upload size={16} className="mx-auto text-gray-400" />
                        <span className="text-[10px] text-gray-400 block">Upload ID Document</span>
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

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="w-1/2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-1/2 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : <><CheckCircle size={14} /> Save Changes</>}
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