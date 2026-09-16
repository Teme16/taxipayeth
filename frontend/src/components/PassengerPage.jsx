import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRScanner from './QRScanner';
import SeatPicker from './SeatPicker';
import ReceiptModal from './ReceiptModal';
import ProfilePage from './ProfilePage';
import {
  QrCode, CheckCircle2, User, ShieldCheck, CreditCard, ChevronRight,
  RefreshCw, Bell, Smartphone, Building2, Wallet, Receipt, UserCircle2,
  PlusCircle, ArrowUpRight, Lock, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const socket = io(API_BASE_URL, {
  withCredentials: true,
  autoConnect: false
});

const normalizeDriverId = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export default function PassengerPage({ user, onUserUpdate }) {
  const token = localStorage.getItem('taxipay_token');
  useEffect(() => {
    if (token) {
      socket.auth = { token };
      
      const onConnect = () => {
        const userId = user?._id || user?.id;
        if (userId) {
          socket.emit('register_online_user', userId);
        }
      };

      socket.on('connect', onConnect);
      socket.connect();

      if (socket.connected) {
        onConnect();
      }
    }
    return () => {
      socket.off('connect');
      socket.disconnect();
    };
  }, [token, user]);

  const [showScanner, setShowScanner] = useState(false);
  const [scannedTaxi, setScannedTaxi] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState({});

  // Payment Pin / Authorization State
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Payment & Wallet Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [selectedGateway, setSelectedGateway] = useState('telebirr');
  const [totalAmount, setTotalAmount] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Storage Keys per User Account
  const userKey = user?.phone || user?._id || user?.id || user?.name || 'guest';
  const storageKey = `taxi_pay_receipts_${userKey}`;
  const balanceKey = `taxi_pay_balance_${userKey}`;

  // Wallet Balance (Syncs with backend user.balance)
  const [balance, setBalance] = useState(user?.balance || 0);

  // Transaction History
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

  // Play a simple notification sound using Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) { console.warn('Audio play failed:', e); }
  };

  // Notification auto-dismiss timer helper
  const triggerNotification = useCallback((title, message) => {
    playNotificationSound();
    setNotification({ title, message });
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Re-sync history ONLY when the active user changes (storageKey changes)
  useEffect(() => {
    const savedReceipts = localStorage.getItem(storageKey);
    if (savedReceipts) {
      setReceiptHistory(JSON.parse(savedReceipts));
    } else {
      setReceiptHistory([]);
    }
  }, [storageKey]);

  // Sync balance from user object separately
  useEffect(() => {
    if (user?.balance !== undefined) {
      setBalance(user.balance);
    }
  }, [user?.balance]);

  // Persist transaction history changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(receiptHistory));
  }, [receiptHistory, storageKey]);

  // Socket Seat Status Monitoring
  useEffect(() => {
    // Use the User ObjectId to join the driver's room — matches what the payment route emits to
    const userObjectId = normalizeDriverId(scannedTaxi?.driverUserId);
    const stringDriverId = normalizeDriverId(scannedTaxi?.driverId);

    if (!userObjectId && !stringDriverId) return;

    // Join with User ObjectId (primary — this is what the payment route emits to)
    if (userObjectId) {
      socket.emit('join_driver_room', userObjectId);
    }
    // Also join with string driverId as fallback
    if (stringDriverId && stringDriverId !== userObjectId) {
      socket.emit('join_driver_room', stringDriverId);
    }

    const handleSeatStatusChange = ({ seatNumbers, status }) => {
      const seatsToUpdate = Array.isArray(seatNumbers) ? seatNumbers : [seatNumbers];

      setOccupiedSeats((prev) => {
        const updated = { ...prev };
        seatsToUpdate.forEach((s) => {
          updated[s] = status;
        });
        return updated;
      });

      setSelectedSeats((prev) =>
        prev.filter((seatNum) => !seatsToUpdate.includes(seatNum) || status === 'unpaid')
      );
    };

    socket.on('seat_status_changed', handleSeatStatusChange);
    return () => {
      socket.off('seat_status_changed', handleSeatStatusChange);
    };
  }, [scannedTaxi?.driverUserId, scannedTaxi?.driverId]);

  const handleScanSuccess = async (qrRawData) => {
    setShowScanner(false);
    let driverId = '';
    let driverUserId = '';
    let parsed = {};
    try {
      parsed = JSON.parse(qrRawData);
      driverId = parsed.driverId || '';
      driverUserId = parsed.userId || '';
    } catch {
      driverId = qrRawData;
    }

    // Use the MongoDB userId for lookup if available, otherwise fall back to driverId
    const lookupId = driverUserId || driverId;

    if (!lookupId) {
      alert('Invalid QR code. No driver identifier found.');
      return;
    }

    const fallbackData = {
      driverName: parsed.driverName || 'Unknown Driver',
      driverId: parsed.driverId || driverId || 'UNKNOWN',
      driverUserId: driverUserId,
      targaNo: parsed.targaNo || 'UNKNOWN',
      tariffPerSeat: parsed.tariffPerSeat || 15,
      profilePic: null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/${lookupId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.driver) {
          const pic = data.driver.profilePic || data.driver.driverData?.profileImage || data.driver.user?.avatar;

          let formattedPic = null;
          if (pic) {
            if (pic.startsWith('http') || pic.startsWith('data:')) {
              formattedPic = pic;
            } else {
              const cleanPath = pic.replace(/\\/g, '/').replace(/^uploads\//, '');
              formattedPic = `${API_BASE_URL}/uploads/${cleanPath}`;
            }
          }

          setScannedTaxi({
            ...fallbackData,
            driverName: data.driver.user?.name || data.driver.fullName || data.driver.name || fallbackData.driverName,
            driverId: data.driver.driverId || fallbackData.driverId,
            driverUserId: data.driver.user?._id || data.driver.user || driverUserId,
            targaNo: data.driver.targaNo || fallbackData.targaNo,
            profilePic: formattedPic
          });

          // Fetch occupied seats
          try {
            const seatsRes = await fetch(`${API_BASE_URL}/api/drivers/${lookupId}/seats`, {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              }
            });
            if (seatsRes.ok) {
              const seatsData = await seatsRes.json();
              if (seatsData.success && seatsData.occupiedSeats) {
                setOccupiedSeats(seatsData.occupiedSeats);
              }
            }
          } catch (seatErr) {
            console.error('Failed to fetch occupied seats:', seatErr);
          }
          return;
        }
      }

      alert('Driver not found. Please scan a valid, up-to-date QR code.');
    } catch (err) {
      console.error('Failed to fetch driver info:', err);
      alert('Network error while looking up driver.');
    }
  };

  // Deposit Money to Wallet Balance
  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);

    if (selectedGateway === 'chapa') {
      try {
        const res = await fetch(`${API_BASE_URL}/api/payments/chapa/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            amount,
            email: user?.email || 'passenger@taxipay.com',
            firstName: user?.name?.split(' ')[0] || 'TaxiPay',
            lastName: user?.name?.split(' ')[1] || 'Passenger'
          })
        });

        const data = await res.json();

        if (res.ok && data.success && data.checkout_url) {
          // Redirect user to the Chapa hosted checkout page
          window.location.href = data.checkout_url;
        } else {
          alert(data.message || 'Chapa initialization failed.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Chapa Payment Error:", err);
        alert("Failed to initialize Chapa payment.");
        setIsProcessing(false);
      }
      return; // Stop here, redirect is happening
    }

    // Mock deposit for other gateways
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setBalance(data.user.balance);
        if (onUserUpdate) onUserUpdate({ balance: data.user.balance });
        setShowDepositModal(false);

        const depositRecord = {
          transactionId: `DEP-${Math.floor(100000 + Math.random() * 900000)}`,
          passengerPhone: user?.phone || 'Guest',
          passengerName: user?.name || 'Passenger',
          driverName: `Top-up (${selectedGateway.toUpperCase()})`,
          targaNo: 'WALLET DEPOSIT',
          seats: ['N/A'],
          amountPaid: amount,
          paymentMethod: selectedGateway,
          type: 'deposit',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        };

        setReceiptHistory((prev) => [depositRecord, ...prev]);
        triggerNotification('Deposit Successful!', `Added ${amount.toFixed(2)} ETB to your wallet via ${selectedGateway.toUpperCase()}`);
      } else {
        alert(data.message || 'Deposit failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during deposit');
    } finally {
      setIsProcessing(false);
    }
  };

  // Withdraw Money from Wallet
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (amount > balance) {
      alert('Insufficient wallet balance!');
      return;
    }

    if (!withdrawAccountName || !withdrawAccountNumber) {
      alert('Please enter your account name and number');
      return;
    }

    setIsProcessing(true);
    try {
      // Map selected gateway to Chapa bank code
      let bank_code = '855'; // default (Telebirr)
      if (selectedGateway === 'cbe_birr') bank_code = '946'; // CBE
      if (selectedGateway === 'chapa') bank_code = '855'; // fallback

      const res = await fetch(`${API_BASE_URL}/api/payments/chapa/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount,
          account_name: withdrawAccountName,
          account_number: withdrawAccountNumber,
          bank_code
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setBalance(data.user.balance);
        if (onUserUpdate) onUserUpdate({ balance: data.user.balance });
        setShowWithdrawModal(false);

        const withdrawRecord = {
          transactionId: `WTH-${Math.floor(100000 + Math.random() * 900000)}`,
          passengerPhone: user?.phone || 'Guest',
          passengerName: user?.name || 'Passenger',
          driverName: `Payout (${selectedGateway.toUpperCase()})`,
          targaNo: 'WALLET WITHDRAWAL',
          seats: ['N/A'],
          amountPaid: amount,
          paymentMethod: selectedGateway,
          type: 'withdraw',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        };

        setReceiptHistory((prev) => [withdrawRecord, ...prev]);
        triggerNotification('Withdrawal Processed!', `Transferred ${amount.toFixed(2)} ETB to your ${selectedGateway.toUpperCase()} account.`);
      } else {
        alert(data.message || 'Withdrawal failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during withdrawal');
    } finally {
      setIsProcessing(false);
    }
  };



  // Trigger PIN Modal before checkout
  const initiatePayment = () => {
    const amountNum = parseFloat(totalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    if (balance < amountNum) {
      triggerNotification('Insufficient Balance!', `Your balance is ${balance.toFixed(2)} ETB. Please deposit funds to pay ${amountNum} ETB.`);
      setShowDepositModal(true);
      return;
    }

    setPassword('');
    setShowPasswordModal(true);
  };

  // Execute Direct Payment post PIN verification
  const processDirectPayment = async () => {
    if (!password) {
      alert('Please enter your account password or PIN to confirm.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `taxi-pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          driverId: scannedTaxi.driverUserId,
          targaNo: scannedTaxi.targaNo,
          passengerName: user?.name || user?.phone || 'Passenger',
          passengerPhone: user?.phone || '',
          userId: user?._id || user?.id,
          seats: selectedSeats,
          amount: totalAmount,
          password,
          paymentMethod: 'TaxiPay Wallet'
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setShowPasswordModal(false);
        setPassword('');

        const updatedBalance = balance - totalAmount;
        setBalance(updatedBalance);
        if (onUserUpdate) onUserUpdate({ balance: updatedBalance });
        setPaymentSuccess(true);

        const newReceipt = {
          transactionId: resData.receipt?.transactionId || `TXP-${Math.floor(100000 + Math.random() * 900000)}`,
          passengerPhone: user?.phone || 'Guest',
          passengerName: user?.name || 'Passenger',
          driverName: scannedTaxi.driverName,
          targaNo: scannedTaxi.targaNo,
          seats: selectedSeats,
          amountPaid: totalAmount,
          paymentMethod: 'TaxiPay Wallet',
          type: 'fare',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        };

        setReceiptHistory((prev) => [newReceipt, ...prev]);
        triggerNotification('Fare Paid Successfully!', `${totalAmount} ETB deducted from wallet for seat(s) ${selectedSeats.join(', ')}.`);
      } else {
        alert(resData.message || 'Payment authorization failed.');
      }
    } catch (err) {
      console.error('Payment Error:', err);
      alert('Network error connecting to payment gateway.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFlow = () => {
    setScannedTaxi(null);
    setPaymentSuccess(false);
    setSelectedSeats([]);
    setOccupiedSeats({});
    setPassword('');
    setTotalAmount('');
  };

  return (
    <div className="max-w-md mx-auto w-full text-white space-y-4 relative">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 left-4 max-w-md mx-auto glass-card border border-emerald-500/50 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <Bell className="text-emerald-400 shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-xs text-emerald-400">{notification.title}</h4>
            <p className="text-[11px] opacity-90 text-gray-300">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="flex justify-between items-center gap-2">
        {/* Interactive User Name Card - Navigates directly to Profile */}
        <button
          onClick={() => setIsProfileOpen(true)}
          type="button"
          className="flex items-center gap-2.5 glass-card/90 border border-white/10 hover:border-emerald-500/50 hover:glass-panel/60 p-1.5 pr-3 rounded-2xl transition cursor-pointer text-left group"
        >
          <div className="h-8 w-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition">
            <UserCircle2 size={18} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold block leading-none">Passenger</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition truncate max-w-[110px]">
                {user?.name || user?.phone || 'Guest User'}
              </span>
              <ChevronRight size={12} className="text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowHistoryModal(true)}
          type="button"
          className="glass-card border border-white/10 hover:border-emerald-500/50 text-emerald-400 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition cursor-pointer"
        >
          <Receipt size={15} /> Receipts ({receiptHistory.length})
        </button>
      </div>

      {/* PRO DIGITAL WALLET CARD */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
              <Wallet size={14} className="text-emerald-400" />
              <span>TaxiPay Wallet Balance</span>
            </div>
            <h2 className="text-3xl font-black font-mono text-white tracking-tight">
              {balance.toFixed(2)}{' '}
              <span className="text-xs font-bold text-emerald-400">ETB</span>
            </h2>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
            Active
          </span>
        </div>

        {/* Quick Deposit / Withdraw Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setShowDepositModal(true)}
            type="button"
            className="glass-button hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
          >
            <PlusCircle size={16} /> Top-Up / Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            type="button"
            className="glass-panel hover:bg-neutral-700 text-gray-200 font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-white/20 transition cursor-pointer"
          >
            <ArrowUpRight size={16} /> Withdraw
          </button>
        </div>
      </div>

      {showScanner && <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}

      {isProfileOpen && (
        <ProfilePage
          user={user}
          balance={balance}
          onClose={() => setIsProfileOpen(false)}
          onProfileUpdated={(updatedUser) => {
            if (onUserUpdate) onUserUpdate(updatedUser);
            setIsProfileOpen(false);
          }}
        />
      )}

      {/* NO SCANNER SELECTED VIEW */}
      {!scannedTaxi && (
        <div className="glass-card border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center shadow-2xl">
          <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
            <QrCode size={32} />
          </div>
          <h3 className="text-xl font-black mb-1">Scan Minibus QR</h3>
          <p className="text-xs text-gray-400 mb-6">Point your camera at the vehicle QR code to pick seats & pay.</p>
          <button
            onClick={() => setShowScanner(true)}
            type="button"
            className="w-full glass-button-primary hover:bg-blue-500 font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer text-white"
          >
            <QrCode size={18} /> Open Camera Scanner
          </button>
        </div>
      )}

      {/* TAXI SCANNED VIEW */}
      {scannedTaxi && !paymentSuccess && (
        <div className="space-y-4 animate-fadeIn">
          {/* Taxi Info */}
          <div className="glass-card border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Verified Taxi</span>
              </div>
            </div>
          </div>

          <div className="glass-card backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.4)] animate-in slide-in-from-bottom-4 duration-500 space-y-4">

            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-md animate-pulse"></div>
                  {scannedTaxi.profilePic ? (
                    <img src={scannedTaxi.profilePic} alt={scannedTaxi.driverName} className="relative h-14 w-14 rounded-full object-cover border-2 border-emerald-500/50 shadow-lg" />
                  ) : (
                    <div className="relative h-14 w-14 glass-panel rounded-full flex items-center justify-center text-gray-300 font-bold border-2 border-emerald-500/50 shadow-lg">
                      <User size={24} />
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-neutral-900 w-4 h-4 rounded-full"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-white tracking-tight">{scannedTaxi.driverName}</h4>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Verified</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {scannedTaxi.driverId}</p>
                </div>
              </div>
              <div className="text-right glass-panel/50 px-3 py-2 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Plate</p>
                <p className="text-sm font-black text-blue-400 font-mono">{scannedTaxi.targaNo}</p>
              </div>
            </div>

            <button onClick={resetFlow} type="button" className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer w-full justify-center">
              <RefreshCw size={12} /> Scan Again
            </button>
          </div>

          <SeatPicker selectedSeats={selectedSeats} setSelectedSeats={setSelectedSeats} seatStates={occupiedSeats} />

          {/* Direct Wallet Checkout Bar */}
          <div className="glass-card border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center px-1">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Selected Seats</span>
                <span className="text-sm font-mono font-bold text-white">{selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Enter Amount to Pay</span>
                <div className="relative">
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-28 text-right bg-black/40 border border-white/10 rounded-xl py-2 pr-9 pl-2 font-mono font-black text-emerald-400 outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-500/50 pointer-events-none">ETB</span>
                </div>
              </div>
            </div>

            <button
              onClick={initiatePayment}
              disabled={selectedSeats.length === 0 || isProcessing || !totalAmount || parseFloat(totalAmount) <= 0}
              type="button"
              className="w-full glass-button hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CreditCard size={18} />
              {isProcessing
                ? 'Processing Authorization...'
                : selectedSeats.length === 0
                  ? 'Select Seats Above'
                  : !totalAmount || parseFloat(totalAmount) <= 0
                    ? 'Enter Amount'
                    : `Pay ${totalAmount} ETB from Wallet`}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PAYMENT PASSWORD / PIN AUTHORIZATION MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Authorize Payment</h3>
                <p className="text-[11px] text-gray-400">Enter your account PIN or password</p>
              </div>
            </div>

            <div className="glass-panel p-3 rounded-2xl border border-white/10 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Amount:</span>
                <span className="font-mono font-bold text-emerald-400">{totalAmount} ETB</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Seats:</span>
                <span className="font-mono font-bold text-white">{selectedSeats.join(', ')}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase text-gray-400 font-bold block mb-1">Password or PIN</label>
              <div className="relative">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password / PIN"
                  className="w-full glass-panel border border-white/10 rounded-2xl p-3 pr-10 text-sm font-mono text-white outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                className="w-1/2 glass-panel hover:bg-neutral-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={processDirectPayment}
                disabled={isProcessing || !password}
                className="w-1/2 glass-button hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-40"
              >
                {isProcessing ? 'Verifying...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="text-emerald-400" size={20} /> Deposit to TaxiPay
            </h3>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-1">Deposit Amount (ETB)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-2xl p-3 text-lg font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                placeholder="100"
              />
            </div>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-2">Select Gateway</label>
              <div className="space-y-2">
                {[
                  { id: 'telebirr', name: 'Telebirr', icon: Smartphone },
                  { id: 'cbe_birr', name: 'CBE Birr', icon: Building2 },
                  { id: 'chapa', name: 'Chapa (Cards)', icon: Wallet }
                ].map((gateway) => {
                  const Icon = gateway.icon;
                  return (
                    <button
                      key={gateway.id}
                      onClick={() => setSelectedGateway(gateway.id)}
                      type="button"
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between transition cursor-pointer ${selectedGateway === gateway.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 glass-panel text-gray-400'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span className="font-bold text-xs">{gateway.name}</span>
                      </div>
                      {selectedGateway === gateway.id && <CheckCircle2 size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDepositModal(false)}
                type="button"
                className="w-1/2 glass-panel hover:bg-neutral-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={isProcessing}
                type="button"
                className="w-1/2 glass-button hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                {isProcessing ? 'Processing...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WITHDRAW MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowUpRight className="text-blue-400" size={20} /> Withdraw Funds
            </h3>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-1">Withdraw Amount (ETB)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-2xl p-3 text-lg font-mono font-bold text-blue-400 outline-none focus:border-blue-500"
                placeholder="50"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">Max available: {balance.toFixed(2)} ETB</span>
            </div>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-2">Payout Method</label>
              <div className="space-y-2">
                {[
                  { id: 'telebirr', name: 'Telebirr Wallet', icon: Smartphone },
                  { id: 'cbe_birr', name: 'CBE Bank Account', icon: Building2 },
                  { id: 'chapa', name: 'Chapa Account', icon: Wallet }
                ].map((gateway) => {
                  const Icon = gateway.icon;
                  return (
                    <button
                      key={gateway.id}
                      onClick={() => setSelectedGateway(gateway.id)}
                      type="button"
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between transition cursor-pointer ${selectedGateway === gateway.id
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-white/10 glass-panel text-gray-400'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span className="font-bold text-xs">{gateway.name}</span>
                      </div>
                      {selectedGateway === gateway.id && <CheckCircle2 size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-1">Account Name</label>
              <input
                type="text"
                value={withdrawAccountName}
                onChange={(e) => setWithdrawAccountName(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-2xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-1">Account Number</label>
              <input
                type="text"
                value={withdrawAccountNumber}
                onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                className="w-full glass-panel border border-white/10 rounded-2xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                placeholder={selectedGateway === 'cbe_birr' ? "1000XXXXXXX" : "0911XXXXXX"}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWithdrawModal(false)}
                type="button"
                className="w-1/2 glass-panel hover:bg-neutral-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isProcessing}
                type="button"
                className="w-1/2 glass-button-primary hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                {isProcessing ? 'Processing...' : 'Withdraw Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SUCCESS VIEW */}
      {paymentSuccess && (
        <div className="glass-card border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-2xl animate-fadeIn">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-2xl font-black text-white">Payment Sent!</h3>
          <p className="text-xs text-gray-400">
            {totalAmount} ETB deducted from wallet for Seat(s){' '}
            <span className="text-emerald-400 font-mono font-bold">{selectedSeats.join(', ')}</span> to{' '}
            <span className="text-white font-bold">{scannedTaxi.driverName}</span> ({scannedTaxi.targaNo}).
          </p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              type="button"
              className="w-1/2 glass-button/20 hover:glass-button/30 text-emerald-400 text-xs font-bold py-3.5 rounded-xl transition border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Receipt size={14} /> View Receipt
            </button>
            <button
              onClick={resetFlow}
              type="button"
              className="w-1/2 glass-panel hover:bg-neutral-700 text-xs font-bold py-3.5 rounded-xl transition border border-white/20 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* RECEIPT HISTORY MODAL */}
      {showHistoryModal && (
        <ReceiptModal history={receiptHistory} user={user} onClose={() => setShowHistoryModal(false)} />
      )}
    </div>
  );
}