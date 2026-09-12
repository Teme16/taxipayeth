import React, {
  useCallback,
  useMemo,
  useState
} from 'react';

import axios from 'axios';

import {
  CreditCard,
  CheckCircle,
  Lock,
  ShieldCheck,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

/*
 * Supports both:
 * - Create React App: REACT_APP_API_BASE_URL
 * - Vite: VITE_API_BASE_URL
 *
 * The backend API base should be:
 * http://localhost:5001
 *
 * The endpoint becomes:
 * http://localhost:5001/api/payments/checkout
 */
const API_BASE_URL =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.REACT_APP_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  'https://taxipayeth.onrender.com';

/*
 * Creates a browser-compatible idempotency key.
 */
const createIdempotencyKey = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2)
  ].join('-');
};

/*
 * Props:
 *
 * tripId         REQUIRED
 * selectedSeats  REQUIRED
 * token          JWT token
 * onPaymentSuccess optional callback
 * onReset optional callback
 *
 * Example:
 *
 * <PassengerPay
 *   tripId={trip._id}
 *   selectedSeats={[1, 2]}
 *   token={token}
 *   onPaymentSuccess={handlePaymentSuccess}
 * />
 */
export default function PassengerPay({
  tripId,
  selectedSeats = [],
  token,
  onPaymentSuccess,
  onReset
}) {
  const [password, setPassword] =
    useState('');

  const [
    showConfirmModal,
    setShowConfirmModal
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [receipt, setReceipt] =
    useState(null);

  const [formError, setFormError] =
    useState('');

  const [modalError, setModalError] =
    useState('');

  /*
   * Keep one idempotency key for the
   * current payment attempt.
   *
   * If the request is retried because of
   * a network problem, the backend can
   * return the already-created transaction
   * instead of charging twice.
   */
  const [
    idempotencyKey,
    setIdempotencyKey
  ] = useState(() =>
    createIdempotencyKey()
  );

  const normalizedSeats =
    useMemo(() => {
      if (!Array.isArray(selectedSeats)) {
        return [];
      }

      return [
        ...new Set(
          selectedSeats
            .map((seat) =>
              Number(seat)
            )
            .filter((seat) =>
              Number.isInteger(seat)
            )
        )
      ].sort((a, b) => a - b);
    }, [selectedSeats]);

  const seatCount =
    normalizedSeats.length;

  const closeModal =
    useCallback(() => {
      if (loading) {
        return;
      }

      setShowConfirmModal(false);
      setModalError('');
      setPassword('');
    }, [loading]);

  const handleInitiatePayment = (
    event
  ) => {
    event.preventDefault();

    setFormError('');
    setModalError('');

    if (!tripId) {
      setFormError(
        'Trip information is missing. Please scan the vehicle QR code again.'
      );

      return;
    }

    if (normalizedSeats.length === 0) {
      setFormError(
        'Please select at least one available seat.'
      );

      return;
    }

    if (!token) {
      setFormError(
        'Your session has expired. Please log in again.'
      );

      return;
    }

    setShowConfirmModal(true);
  };

  const handleFinalPayment =
    async () => {
      if (loading) {
        return;
      }

      setModalError('');

      if (!password.trim()) {
        setModalError(
          'Please enter your password to confirm payment.'
        );

        return;
      }

      if (!tripId) {
        setModalError(
          'Trip information is missing.'
        );

        return;
      }

      if (
        normalizedSeats.length === 0
      ) {
        setModalError(
          'No valid seats are selected.'
        );

        return;
      }

      setLoading(true);

      try {
        const response =
          await axios.post(
            `${API_BASE_URL}/api/payments/checkout`,
            {
              tripId,
              seats:
                normalizedSeats,
              password
            },
            {
              timeout: 20000,

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,

                'Idempotency-Key':
                  idempotencyKey
              }
            }
          );

        if (!response.data?.success) {
          throw new Error(
            response.data?.message ||
            'Payment processing failed.'
          );
        }

        const paymentReceipt =
          response.data.receipt;

        setReceipt(
          paymentReceipt
        );

        setPassword('');
        setShowConfirmModal(false);

        if (
          typeof onPaymentSuccess ===
          'function'
        ) {
          onPaymentSuccess({
            receipt:
              paymentReceipt,

            seats:
              normalizedSeats,

            alreadyProcessed:
              Boolean(
                response.data
                  .alreadyProcessed
              )
          });
        }
      } catch (error) {
        const status =
          error?.response?.status;

        const serverMessage =
          error?.response?.data
            ?.message;

        if (status === 409) {
          setModalError(
            serverMessage ||
            'One or more selected seats are no longer available. Please select different seats.'
          );
        } else if (
          status === 401
        ) {
          setModalError(
            'Authentication failed. Please check your password or log in again.'
          );
        } else if (
          status === 403
        ) {
          setModalError(
            serverMessage ||
            'You are not allowed to complete this payment.'
          );
        } else if (
          status === 429
        ) {
          setModalError(
            serverMessage ||
            'Too many payment attempts. Please wait before trying again.'
          );
        } else if (
          error?.code ===
          'ECONNABORTED'
        ) {
          setModalError(
            'The payment request timed out. Do not submit immediately again. Please retry using the same payment attempt.'
          );
        } else if (
          !error?.response
        ) {
          setModalError(
            'Unable to connect to the server. Please check your internet connection and try again.'
          );
        } else {
          setModalError(
            serverMessage ||
            error.message ||
            'Payment processing failed.'
          );
        }
      } finally {
        setPassword('');
        setLoading(false);
      }
    };

  const handleRetryPayment = () => {
    setModalError('');
    setIdempotencyKey(
      createIdempotencyKey()
    );
  };

  const handleDone = () => {
    setReceipt(null);
    setPassword('');
    setFormError('');
    setModalError('');

    /*
     * New payment flow gets a new
     * idempotency key.
     */
    setIdempotencyKey(
      createIdempotencyKey()
    );

    if (
      typeof onReset === 'function'
    ) {
      onReset();
    }
  };

  /*
   * Payment success screen
   */
  if (receipt) {
    return (
      <div className="max-w-md mx-auto glass-card text-white rounded-3xl p-6 shadow-2xl border border-white/10 text-center">
        <div className="flex justify-center mb-4 text-emerald-400">
          <CheckCircle size={64} />
        </div>

        <h2 className="text-2xl font-bold mb-2">
          Payment Successful
        </h2>

        <p className="text-gray-400 text-sm mb-6">
          Your seat reservation has been confirmed.
        </p>

        <div className="glass-panel rounded-2xl p-4 text-left space-y-3 font-mono text-sm border border-white/10">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">
              Txn ID:
            </span>

            <span className="text-gray-200 break-all text-right">
              {receipt.transactionId ||
                'N/A'}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">
              Amount Paid:
            </span>

            <span className="text-red-400 font-bold">
              -ETB{' '}
              {Number(
                receipt.amountPaid || 0
              ).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">
              Seats:
            </span>

            <span className="text-gray-200 text-right">
              {Array.isArray(
                receipt.seatsBooked
              )
                ? receipt.seatsBooked.join(
                  ', '
                )
                : normalizedSeats.join(
                  ', '
                )}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-gray-400">
              Status:
            </span>

            <span className="text-emerald-400 font-bold">
              Completed
            </span>
          </div>

          {receipt.timestamp && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">
                Time:
              </span>

              <span className="text-gray-200 text-right">
                {new Date(
                  receipt.timestamp
                ).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleDone}
          className="mt-6 w-full glass-button-primary hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition cursor-pointer"
        >
          Done
        </button>
      </div>
    );
  }

  /*
   * Main payment screen
   */
  return (
    <div className="max-w-md mx-auto glass-card text-white rounded-3xl p-6 shadow-2xl border border-white/10 relative">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">
          Taxi Pay
        </h2>

        <p className="text-gray-400 text-sm">
          Review your selected seats and
          complete payment.
        </p>
      </div>

      <form
        onSubmit={
          handleInitiatePayment
        }
        className="space-y-5"
      >
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Selected Seats
          </label>

          <div className="relative">
            <CreditCard
              className="absolute left-3 top-3.5 text-gray-500"
              size={18}
            />

            <div className="w-full glass-panel border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white">
              {seatCount > 0
                ? normalizedSeats.join(', ')
                : 'No seats selected'}
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              Number of Seats
            </span>

            <span className="text-lg font-bold text-white">
              {seatCount}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            The final amount is calculated
            securely by the server using the
            current trip fare.
          </p>
        </div>

        {formError && (
          <div className="flex gap-2 items-start glass-button-danger border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
            <AlertCircle
              size={18}
              className="shrink-0 mt-0.5"
            />

            <span>
              {formError}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            seatCount === 0 ||
            !tripId
          }
          className="w-full glass-button-primary hover:bg-blue-500 disabled:glass-panel disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          Review & Pay
        </button>
      </form>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl relative space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ShieldCheck
                  size={20}
                />

                <span>
                  Confirm Payment
                </span>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="text-gray-400 hover:text-white disabled:opacity-50 p-1 rounded-full transition cursor-pointer"
                aria-label="Close payment confirmation"
              >
                <X size={18} />
              </button>
            </div>

            <div className="glass-panel border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">
                  Seats:
                </span>

                <span className="font-mono text-gray-200 text-right">
                  {normalizedSeats.join(
                    ', '
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-400">
                  Seat Count:
                </span>

                <span className="font-bold text-white">
                  {seatCount}
                </span>
              </div>

              <div className="border-t border-white/10 pt-3">
                <p className="text-gray-400">
                  The final payable amount
                  will be calculated by the
                  server.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Enter Account Password
              </label>

              <div className="relative">
                <Lock
                  className="absolute left-3 top-3.5 text-gray-500"
                  size={18}
                />

                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full glass-panel border border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-white outline-none font-mono tracking-widest text-lg disabled:opacity-60"
                  autoFocus
                />
              </div>

              {modalError && (
                <div className="mt-3 flex gap-2 items-start glass-button-danger border border-red-500/30 rounded-xl p-3 text-red-300 text-xs">
                  <AlertCircle
                    size={16}
                    className="shrink-0 mt-0.5"
                  />

                  <span>
                    {modalError}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="w-1/2 glass-panel hover:bg-neutral-700 disabled:opacity-50 font-bold py-3 rounded-xl text-xs text-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleFinalPayment
                }
                disabled={
                  loading ||
                  !password.trim()
                }
                className="w-1/2 glass-button hover:bg-emerald-500 disabled:glass-panel text-white font-bold py-3 rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />

                    Processing...
                  </>
                ) : (
                  'Authorize & Pay'
                )}
              </button>
            </div>

            {modalError &&
              !loading && (
                <button
                  type="button"
                  onClick={
                    handleRetryPayment
                  }
                  className="w-full text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  Start a new payment attempt
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
