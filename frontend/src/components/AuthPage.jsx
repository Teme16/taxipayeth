import React, { useState } from 'react';
import axios from 'axios';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('passenger');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    targaNo: '',
    telegramChatId: '',
    code: ''
  });

  // Verification state machine: 'idle' | 'code_sent' | 'verified'
  const [otpStep, setOtpStep] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Send OTP to Telegram
  const handleSendTelegramCode = async () => {
    if (!formData.phone || !formData.telegramChatId) {
      setError('Please fill in both Phone Number and Telegram Chat ID first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('http://localhost:5001/api/auth/send-telegram-code', {
        phone: formData.phone.trim(),
        telegramChatId: formData.telegramChatId.trim()
      });

      if (res.data.success) {
        setOtpStep('code_sent');
        setSuccessMsg('Verification code sent to your Telegram!');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send Telegram code. Make sure you started the Telegram bot!');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP Code
  const handleVerifyCode = async () => {
    if (!formData.telegramChatId || !formData.code) {
      setError('Please enter both your Telegram Chat ID and the verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('http://localhost:5001/api/auth/verify-telegram-code', {
        telegramChatId: String(formData.telegramChatId).trim(),
        code: String(formData.code).trim()
      });

      if (res.data.success) {
        setOtpStep('verified');
        setSuccessMsg('Telegram code verified successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Final Form Submit (Login or Complete Registration)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && otpStep !== 'verified') {
      setError('You must verify your Telegram code before registering.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    // Clean up payload (trim phone numbers and whitespace)
    const payload = isLogin
      ? { 
          phone: formData.phone.trim(), 
          password: formData.password 
        }
      : { 
          ...formData, 
          phone: formData.phone.trim(), 
          telegramChatId: formData.telegramChatId.trim(),
          role 
        };

    try {
      const res = await axios.post(`http://localhost:5001${endpoint}`, payload);
      
      if (res.data.success) {
        if (isLogin) {
          localStorage.setItem('taxi_pay_token', res.data.token);
          localStorage.setItem('taxi_pay_user', JSON.stringify(res.data.user));
          onLoginSuccess(res.data.user);
        } else {
          setIsLogin(true);
          setOtpStep('idle');
          setFormData({ name: '', phone: '', password: '', targaNo: '', telegramChatId: '', code: '' });
          alert('Registration successful! Please login with your credentials.');
        }
      }
    } catch (err) {
      // Direct error string extraction from backend status 400 response
      const serverMessage = err.response?.data?.message;
      setError(serverMessage || 'Authentication failed. Check your phone/password or backend status.');
    } finally {
      setLoading(false);
    }
  };

  const resetFormState = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccessMsg('');
    setOtpStep('idle');
  };

  return (
    <div className="max-w-md mx-auto w-full text-white animate-fadeIn">
      <div className="bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-neutral-800">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-gray-400 text-xs mt-1">
            {isLogin ? 'Sign in to access your TaxiPay portal' : 'Choose your role and register'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 text-xs p-3 rounded-xl mb-4 text-center font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs p-3 rounded-xl mb-4 text-center font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Role Toggle for Registration */}
              <div className="flex bg-neutral-950 p-1 rounded-xl mb-3 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setRole('passenger')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'passenger' ? 'bg-taxi-blue-primary text-white' : 'text-gray-400'}`}
                >
                  Passenger
                </button>
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'driver' ? 'bg-taxi-blue-primary text-white' : 'text-gray-400'}`}
                >
                  Minibus Driver
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none"
                  placeholder="e.g. Abebe Bikila"
                />
              </div>

              {role === 'driver' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Vehicle Plate Number</label>
                  <input
                    type="text"
                    required
                    value={formData.targaNo}
                    onChange={(e) => setFormData({ ...formData, targaNo: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none font-mono"
                    placeholder="e.g. AA-3-A12345"
                  />
                </div>
              )}
            </>
          )}

          {/* Phone Input */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none font-mono"
              placeholder="0912345678"
            />
          </div>

          {/* Registration Telegram Section */}
          {!isLogin && (
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl space-y-3">
              {otpStep === 'verified' ? (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 text-xs font-bold">
                  <span>✓ Telegram ID Verified</span>
                  <span className="text-[10px] opacity-75">Ready to Register</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telegram Chat ID</label>
                    <input
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none font-mono"
                      placeholder="e.g. 123456789"
                    />
                  </div>

                  {otpStep === 'idle' && (
                    <button
                      type="button"
                      onClick={handleSendTelegramCode}
                      disabled={loading}
                      className="w-full bg-neutral-800 hover:bg-neutral-700 text-xs text-blue-400 font-bold py-2.5 rounded-xl border border-blue-500/30 transition disabled:opacity-50"
                    >
                      {loading ? 'Sending Code...' : 'Send Verification Code via Telegram'}
                    </button>
                  )}

                  {otpStep === 'code_sent' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telegram OTP Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 text-center font-mono text-base tracking-widest rounded-xl p-2.5 text-white"
                          placeholder="123456"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyCode}
                          disabled={loading}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 rounded-xl transition disabled:opacity-50"
                        >
                          {loading ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (!isLogin && otpStep !== 'verified')}
            className="w-full bg-taxi-blue-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition cursor-pointer mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-neutral-800">
          <button
            onClick={resetFormState}
            className="text-xs text-gray-400 hover:text-white transition cursor-pointer"
          >
            {isLogin ? "Don't have an account? Register" : 'Already registered? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}