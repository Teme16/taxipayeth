import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as authApi from '../api/auth.js';
import { CheckCircle2, ShieldCheck, Loader2, MessageCircle, RefreshCw } from 'lucide-react';

export default function AuthPage() {
  const { login, register, setUser } = useAuth();

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
    if (!isLogin && otpStep === 'code_sent' && formData.phone) {
      intervalId = setInterval(() => {
        handleVerifyCode(true); // Silent background check
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [otpStep, isLogin, formData.phone]);

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
      const res = await authApi.requestVerification(formData.phone.trim());

      if (res.data.success) {
        setOtpStep('code_sent');
        setSuccessMsg('Verification initiated. Open Telegram and complete the verification step.');
        setFormData((prev) => ({ ...prev, code: res.data.verificationCode }));
        setTelegramBotLink(res.data.telegramBotLink || '');
      }
    } catch (err) {
      setError(err.message || 'Failed to request Telegram verification.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Check if Telegram user verified contact
  const handleVerifyCode = async (isSilent = false) => {
    if (!formData.phone) return;

    if (!isSilent) {
      setLoading(true);
      setError('');
      setSuccessMsg('Checking verification status...');
    }

    try {
      const res = await authApi.checkVerification(formData.phone.trim(), formData.code.trim());

      if (res.data.success && res.data.verified) {
        setOtpStep('verified');
        setError('');
        setSuccessMsg('Telegram phone match verified successfully!');
      } else if (!isSilent && !res.data.verified) {
        setSuccessMsg(res.data.message || 'Telegram verification incomplete.');
      }
    } catch (err) {
      if (!isSilent) {
        setError(err.message || 'The phone number shared does not match TaxiPay registration.');
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

    
    const payload = isLogin
            ? { phone: formData.phone.trim(), password: formData.password }

      : {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        role,
        targaNo: role === 'driver' ? formData.targaNo.trim() : undefined,
        code: formData.code.trim(),
        verificationCode: formData.code.trim()
      };


    try {
      if (isLogin) {
        await login(payload);
      } else {
        await register(payload);
       // SWITCH TO LOGIN SCREEN INSTEAD OF AUTO-LOGGING IN
        setIsLogin(true);
        setOtpStep('idle');
        setFormData({ ...formData, password: '', code: '' });
        setSuccessMsg('Registration successful! Please check Telegram for your account status.');
      }
    } catch (err) {
            setError(err.message || 'Authentication failed.');

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
      <div className="glass-card rounded-3xl p-6">
        <h2 className="text-3xl font-black text-center mb-1 text-white">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-gray-300 text-xs text-center mb-6">
          {isLogin ? 'Sign in to your TaxiPay account' : 'Register with phone verification'}
        </p>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 text-xs p-3 rounded-xl mb-4 text-center">{error}</div>}
        {successMsg && <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs p-3 rounded-xl mb-4 text-center">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Role Selector */}
              <div className="flex glass-panel p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setRole('passenger')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'passenger' ? 'glass-button-primary' : 'text-gray-300 hover:text-white'}`}
                >
                  Passenger
                </button>
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${role === 'driver' ? 'glass-button-primary' : 'text-gray-300 hover:text-white'}`}
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
                className="w-full glass-input rounded-xl p-3 text-sm"
              />

              {role === 'driver' && (
                <input
                  type="text"
                  required
                  placeholder="Plate Number (e.g. AA-3-A12345)"
                  value={formData.targaNo}
                  onChange={(e) => setFormData({ ...formData, targaNo: e.target.value })}
                  className="w-full glass-input rounded-xl p-3 text-sm font-mono"
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
            className="w-full glass-input rounded-xl p-3 text-sm font-mono"
          />

          {!isLogin && (
            <div className="p-5 mt-4 glass-panel border border-emerald-500/20 rounded-3xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Account Verification</h4>
              </div>

              {otpStep === 'verified' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 animate-fadeIn">
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="text-emerald-400 font-bold text-sm">Verified Successfully</h5>
                    <p className="text-[10px] text-gray-300">Your phone number is now linked. You can complete registration.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 relative z-10">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    To secure your account, please verify your phone number using our official Telegram Bot.
                  </p>

                  {otpStep === 'idle' && (
                    <button
                      type="button"
                      onClick={handleSendTelegramCode}
                      disabled={loading || !formData.phone}
                      className="w-full glass-button hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                      {loading ? 'Requesting...' : 'Start Telegram Verification'}
                    </button>
                  )}

                  {otpStep === 'code_sent' && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="bg-black/30 border border-white/10 p-4 rounded-2xl shadow-inner">
                        <p className="text-center text-[11px] text-gray-400 mb-2">
                          Your verification code is:
                        </p>
                        <p className="text-center">
                          <span className="font-mono text-emerald-400 font-black text-2xl tracking-[0.2em]">{formData.code}</span>
                        </p>
                      </div>
                      
                      {telegramBotLink && (
                        <a
                          href={telegramBotLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1C88BA] text-white font-bold py-3.5 rounded-2xl text-xs transition shadow-[0_0_15px_rgba(34,158,217,0.3)]"
                        >
                          <MessageCircle size={16} /> Open Telegram Bot
                        </a>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleVerifyCode(false)}
                        disabled={loading}
                        className="w-full glass-button text-gray-300 hover:text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {loading ? 'Checking Status...' : 'I have verified in Telegram'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <input
            type="password"
            required
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full glass-input rounded-xl p-3 text-sm"
          />

          <button
            type="submit"
            disabled={loading || (!isLogin && otpStep !== 'verified')}
            className="w-full glass-button-primary font-bold py-3.5 rounded-xl transition mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-white/10">
          <button onClick={toggleAuthMode} className="text-xs text-gray-300 hover:text-white transition">
            {isLogin ? "Don't have an account? Register" : 'Already registered? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
