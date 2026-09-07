import React, { useState, useEffect } from 'react';
import QRScanner from './QRScanner';
import SeatPicker from './SeatPicker';
import ReceiptModal from './ReceiptModal';
import ProfilePage from './ProfilePage';
import { QrCode, CheckCircle2, User, ShieldCheck, CreditCard, ChevronRight, RefreshCw, Bell, Smartphone, Building2, Wallet, Receipt, UserCircle2 } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001');

const normalizeDriverId = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export default function PassengerPage({ user, token, onUserUpdate }) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedTaxi, setScannedTaxi] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState({});

  // Payment flow state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('telebirr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Generate unique storage key bound directly to the user identity
  const userKey = user?.phone || user?._id || user?.id || user?.name || 'guest';
  const storageKey = `taxi_pay_receipts_${userKey}`;

  // Transaction History State (Unique per passenger account)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

  // Re-sync receipts whenever the active user or storage key changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setReceiptHistory(saved ? JSON.parse(saved) : []);
  }, [storageKey]);

  // Persist transaction history whenever it updates
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(receiptHistory));
  }, [receiptHistory, storageKey]);

  useEffect(() => {
    const normalizedDriverId = normalizeDriverId(scannedTaxi?.driverId);
    if (!normalizedDriverId) return;

    socket.emit('join_driver_room', normalizedDriverId);

    const handleSeatStatusChange = ({ seatNumbers, status }) => {
      setOccupiedSeats((prev) => {
        const updated = { ...prev };
        const seatsToUpdate = Array.isArray(seatNumbers) ? seatNumbers : [seatNumbers];
        seatsToUpdate.forEach((s) => {
          updated[s] = status;
        });
        return updated;
      });

      setSelectedSeats((prev) =>
        prev.filter((seatNum) => !seatNumbers.includes(seatNum) || status === 'unpaid')
      );
    };

    socket.on('seat_status_changed', handleSeatStatusChange);
    return () => socket.off('seat_status_changed', handleSeatStatusChange);
  }, [scannedTaxi?.driverId]);

  const handleScanSuccess = (qrRawData) => {
    setShowScanner(false);
    try {
      const parsed = JSON.parse(qrRawData);
      setScannedTaxi({
        driverName: parsed.driverName || 'Hagos Teklay',
        driverId: parsed.driverId || 'DRV-98231',
        targaNo: parsed.targaNo || 'AA-23456',
        tariffPerSeat: parsed.tariffPerSeat || 15
      });
    } catch {
      setScannedTaxi({
        driverName: 'Hagos Teklay',
        driverId: qrRawData || 'DRV-98231',
        targaNo: 'AA-23456',
        tariffPerSeat: 15
      });
    }
  };

  const processPayment = async () => {
    setIsProcessing(true);
    const totalAmount = selectedSeats.length * scannedTaxi.tariffPerSeat;

    try {
      const response = await fetch('http://localhost:5001/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: scannedTaxi.driverId,
          targaNo: scannedTaxi.targaNo,
          passengerName: user?.name || user?.phone || 'Passenger',
          seats: selectedSeats,
          amount: totalAmount,
          paymentMethod: selectedMethod
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setShowPaymentModal(false);
        setPaymentSuccess(true);

        // Record user-bound receipt into transaction history
        const newReceipt = {
          transactionId: resData.receipt.transactionId,
          passengerPhone: user?.phone || 'Guest',
          passengerName: user?.name || 'Passenger',
          driverName: scannedTaxi.driverName,
          targaNo: scannedTaxi.targaNo,
          seats: selectedSeats,
          amountPaid: totalAmount,
          paymentMethod: selectedMethod,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        };

        setReceiptHistory((prev) => [newReceipt, ...prev]);

        // Show Notification Toast
        setNotification({
          title: 'Payment Successful!',
          message: `${totalAmount} ETB paid via ${selectedMethod.toUpperCase()} for seat(s) ${selectedSeats.join(', ')}`
        });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err) {
      console.error('Payment Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFlow = () => {
    setScannedTaxi(null);
    setPaymentSuccess(false);
    setSelectedSeats([]);
    setOccupiedSeats({});
  };

  const totalAmount = selectedSeats.length * (scannedTaxi?.tariffPerSeat || 0);

  return (
    <div className="max-w-md mx-auto w-full text-white space-y-4 relative">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 left-4 max-w-md mx-auto bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 z-50 animate-bounce">
          <Bell size={24} />
          <div>
            <h4 className="font-bold text-xs">{notification.title}</h4>
            <p className="text-[11px] opacity-90">{notification.message}</p>
          </div>
        </div>
      )}

      {/* History Button Bar */}
      <div className="flex flex-wrap justify-between gap-3">
        <button
          onClick={() => setShowHistoryModal(true)}
          type="button"
          className="bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer"
        >
          <Receipt size={16} /> Transaction History ({receiptHistory.length})
        </button>
        <button
          onClick={() => setIsProfileOpen(true)}
          type="button"
          className="bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 text-blue-300 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer"
        >
          <UserCircle2 size={16} /> Manage Profile
        </button>
      </div>

      {showScanner && <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      {isProfileOpen && (
        <ProfilePage
          token={token}
          onClose={() => setIsProfileOpen(false)}
          onProfileUpdated={(updatedUser) => {
            if (onUserUpdate) onUserUpdate(updatedUser);
            setIsProfileOpen(false);
          }}
        />
      )}

      {!scannedTaxi && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center flex flex-col items-center shadow-2xl">
          <div className="h-16 w-16 bg-taxi-blue-primary/10 rounded-2xl flex items-center justify-center text-taxi-blue-primary mb-4 border border-taxi-blue-primary/20">
            <QrCode size={32} />
          </div>
          <h3 className="text-2xl font-black mb-2">Scan Taxi QR</h3>
          <p className="text-xs text-gray-400 mb-6">Point your camera at the minibus QR code to pick your seats.</p>
          <button
            onClick={() => setShowScanner(true)}
            type="button"
            className="w-full bg-taxi-blue-primary hover:bg-blue-600 font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode size={18} /> Open Camera Scanner
          </button>
        </div>
      )}

      {scannedTaxi && !paymentSuccess && (
        <div className="space-y-4 animate-fadeIn">
          {/* Taxi Info */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Verified Taxi</span>
              </div>
              <button onClick={resetFlow} type="button" className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer">
                <RefreshCw size={12} /> Scan Again
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-neutral-800 rounded-full flex items-center justify-center text-gray-300 font-bold">
                  <User size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{scannedTaxi.driverName}</h4>
                  <p className="text-[11px] text-gray-400 font-mono">ID: {scannedTaxi.driverId}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Vehicle Plate</span>
                <span className="font-mono font-black text-white text-xs">{scannedTaxi.targaNo}</span>
              </div>
            </div>
          </div>

          <SeatPicker selectedSeats={selectedSeats} setSelectedSeats={setSelectedSeats} occupiedSeats={occupiedSeats} />

          {/* Checkout Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center px-1">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Selected Seats</span>
                <span className="text-sm font-mono font-bold text-white">{selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Total ({scannedTaxi.tariffPerSeat} ETB/seat)</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{totalAmount} ETB</span>
              </div>
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={selectedSeats.length === 0}
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CreditCard size={18} />
              {selectedSeats.length === 0 ? 'Select Seats Above' : `Proceed to Pay ${totalAmount} ETB`}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Payment Selection Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold">Select Payment Gateway</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => setSelectedMethod('telebirr')}
                type="button"
                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  selectedMethod === 'telebirr' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={20} />
                  <span className="font-bold text-sm">Telebirr</span>
                </div>
                {selectedMethod === 'telebirr' && <CheckCircle2 size={18} />}
              </button>

              <button
                onClick={() => setSelectedMethod('cbe_birr')}
                type="button"
                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  selectedMethod === 'cbe_birr' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 size={20} />
                  <span className="font-bold text-sm">CBE Birr</span>
                </div>
                {selectedMethod === 'cbe_birr' && <CheckCircle2 size={18} />}
              </button>

              <button
                onClick={() => setSelectedMethod('chapa')}
                type="button"
                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  selectedMethod === 'chapa' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wallet size={20} />
                  <span className="font-bold text-sm">Chapa (Cards / Bank)</span>
                </div>
                {selectedMethod === 'chapa' && <CheckCircle2 size={18} />}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                type="button"
                className="w-1/2 bg-neutral-800 hover:bg-neutral-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                disabled={isProcessing}
                type="button"
                className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                {isProcessing ? 'Confirming...' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Success View */}
      {paymentSuccess && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl animate-fadeIn">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-2xl font-black text-white">Payment Sent!</h3>
          <p className="text-xs text-gray-400">
            {totalAmount} ETB transferred for Seat(s){' '}
            <span className="text-emerald-400 font-mono font-bold">{selectedSeats.join(', ')}</span> to{' '}
            <span className="text-white font-bold">{scannedTaxi.driverName}</span> ({scannedTaxi.targaNo}).
          </p>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              type="button"
              className="w-1/2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold py-3.5 rounded-xl transition border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Receipt size={14} /> View Receipt
            </button>
            <button
              onClick={resetFlow}
              type="button"
              className="w-1/2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold py-3.5 rounded-xl transition border border-neutral-700 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Receipt History Modal */}
      {showHistoryModal && (
        <ReceiptModal history={receiptHistory} user={user} onClose={() => setShowHistoryModal(false)} />
      )}
    </div>
  );
}