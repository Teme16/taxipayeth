import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('passenger');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    targaNo: '',
    code: ''
  });

  const [otpStep, setOtpStep] = useState('idle'); // 'idle' | 'code_sent' | 'verified'
  const [telegramBotLink, setTelegramBotLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-poll verification status while user is in 'code_sent' state
  useEffect(() => {
    let intervalId;
    if (!isLogin && otpStep === 'code_sent' && formData.phone && formData.code) {
      intervalId = setInterval(() => {
        handleVerifyCode(true); // Silent background check
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [otpStep, isLogin, formData.phone, formData.code]);

  const verificationStatusText = () => {
    if (otpStep === 'verified') return 'Telegram verification complete. You may finish registration.';
    if (otpStep === 'code_sent') return 'Open Telegram, share your contact, and TaxiPay will verify it automatically.';
    return 'Start by entering your phone number and requesting Telegram verification.';
  };

  // 1. Request Telegram verification code & deep link
  const handleSendTelegramCode = async () => {
    if (!formData.phone) {
      setError('Please enter your phone number first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('http://localhost:5001/api/auth/request-telegram-verification', {
        phone: formData.phone.trim()
      });

      if (res.data.success) {
        setOtpStep('code_sent');
        setSuccessMsg('Verification initiated. Open Telegram and complete the verification step.');
        setFormData((prev) => ({ ...prev, code: res.data.verificationCode }));
        setTelegramBotLink(res.data.telegramBotLink || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request Telegram verification.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Check if Telegram user verified contact
  const handleVerifyCode = async (isSilent = false) => {
    if (!formData.phone || !formData.code) return;

    if (!isSilent) {
      setLoading(true);
      setError('');
      setSuccessMsg('Checking verification status...');
    }

    try {
      const res = await axios.post('http://localhost:5001/api/auth/check-telegram-verification', {
        phone: formData.phone.trim(),
        code: formData.code.trim()
      });

      if (res.data.success && res.data.verified) {
        setOtpStep('verified');
        setError('');
        setSuccessMsg('Telegram phone match verified successfully!');
      } else if (!isSilent && !res.data.verified) {
        setSuccessMsg(res.data.message || 'Telegram verification incomplete.');
      }
    } catch (err) {
      if (!isSilent) {
        setError(err.response?.data?.message || 'The phone number shared does not match TaxiPay registration.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // 3. Final Registration / Login submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && otpStep !== 'verified') {
      setError('You must verify your Telegram phone contact before registering.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    // Explicit Payload Mapping
    const payload = isLogin
      ? { 
          phone: formData.phone.trim(), 
          password: formData.password 
        }
      : { 
          name: formData.name.trim(),
          phone: formData.phone.trim(), 
          password: formData.password,
          role,
          targaNo: role === 'driver' ? formData.targaNo.trim() : undefined,
          code: formData.code.trim(),
          verificationCode: formData.code.trim() // Required by backend authController
        };

    console.log('📤 [Auth] Submitting', isLogin ? 'login' : 'registration', 'payload:', payload);

    try {
      const res = await axios.post(`http://localhost:5001${endpoint}`, payload);
      if (res.data.success) {
        localStorage.setItem('taxi_pay_token', res.data.token);
        localStorage.setItem('taxi_pay_user', JSON.stringify(res.data.user));
        console.log('✅ [Auth] Success!');
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Authentication failed.';
      console.error('❌ [Auth] Error:', errorMsg, 'Full response:', err.response?.data);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccessMsg('');
    setOtpStep('idle');
  };

  return (
    <div className="max-w-md mx-auto w-full text-white animate-fadeIn">
      <div className="bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-neutral-800">
        <h2 className="text-3xl font-black text-center mb-1">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-gray-400 text-xs text-center mb-6">
          {isLogin ? 'Sign in to your TaxiPay account' : 'Register with phone verification'}
        </p>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 text-xs p-3 rounded-xl mb-4 text-center">{error}</div>}
        {successMsg && <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs p-3 rounded-xl mb-4 text-center">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Role Selector */}
              <div className="flex bg-neutral-950 p-1 rounded-xl mb-3 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setRole('passenger')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'passenger' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  Passenger
                </button>
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'driver' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  Minibus Driver
                </button>
              </div>

              <input
                type="text"
                required
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 outline-none rounded-xl p-3 text-sm"
              />

              {role === 'driver' && (
                <input
                  type="text"
                  required
                  placeholder="Plate Number (e.g. AA-3-A12345)"
                  value={formData.targaNo}
                  onChange={(e) => setFormData({ ...formData, targaNo: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 outline-none rounded-xl p-3 text-sm font-mono"
                />
              )}
            </>
          )}

          <input
            type="tel"
            required
            placeholder="Phone Number (0912345678)"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 outline-none rounded-xl p-3 text-sm font-mono"
          />

          {!isLogin && (
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-3xl space-y-4">
              <div className="text-xs text-gray-400 uppercase tracking-[0.3em] font-semibold">
                Verification Steps
              </div>

              <div className="rounded-3xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
                <div className="text-sm font-bold text-blue-200">{verificationStatusText()}</div>
                <div className="text-xs text-gray-500">
                  1. Request verification. 2. Open TaxiPay bot in Telegram. 3. Share your contact. 4. Finish registration.
                </div>
              </div>

              {otpStep === 'verified' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-emerald-300 text-xs font-bold text-center">
                  ✓ Telegram phone verified. Ready to register.
                </div>
              ) : (
                <>
                  {otpStep === 'idle' && (
                    <button
                      type="button"
                      onClick={handleSendTelegramCode}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl border border-blue-500/30 text-sm transition shadow-lg disabled:opacity-50"
                    >
                      {loading ? 'Requesting verification...' : 'Request Telegram verification'}
                    </button>
                  )}

                  {otpStep === 'code_sent' && (
                    <div className="space-y-3">
                      {telegramBotLink && (
                        <a
                          href={telegramBotLink.replace('https://t.me/', 'tg://resolve?domain=')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center w-full bg-linear-to-r from-blue-500 to-cyan-500 text-white font-bold py-3 rounded-2xl text-sm transition shadow-xl"
                        >
                          Open Telegram and share your contact
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleVerifyCode(false)}
                        disabled={loading}
                        className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-2xl text-sm font-bold transition border border-neutral-700 disabled:opacity-50"
                      >
                        {loading ? 'Checking status...' : 'Check verification status'}
                      </button>
                      <div className="text-xs text-gray-400 text-center">
                        Verification code: <span className="font-mono text-white">{formData.code}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <input
            type="password"
            required
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 outline-none rounded-xl p-3 text-sm"
          />

          <button
            type="submit"
            disabled={loading || (!isLogin && otpStep !== 'verified')}
            className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-neutral-800">
          <button onClick={toggleAuthMode} className="text-xs text-gray-400 hover:text-white transition">
            {isLogin ? "Don't have an account? Register" : 'Already registered? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}