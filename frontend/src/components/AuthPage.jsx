import React, { useState } from 'react';
import axios from 'axios';

export default function AuthPage({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('passenger');
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', targaNo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { phone: formData.phone, password: formData.password }
      : { ...formData, role };

    try {
      const res = await axios.post(`http://localhost:5001${endpoint}`, payload);
      if (res.data.success) {
        if (isLogin) {
          localStorage.setItem('taxi_pay_token', res.data.token);
          localStorage.setItem('taxi_pay_user', JSON.stringify(res.data.user));
          onLoginSuccess(res.data.user);
        } else {
          setIsLogin(true);
          alert('Registration successful! Please login.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Is backend on port 5001?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full text-white animate-fadeIn">
      <div className="bg-charcoal-card rounded-3xl p-6 shadow-2xl border border-neutral-700/80">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-gray-400 text-xs mt-1">
            {isLogin ? 'Sign in to access your Taxi Pay portal' : 'Choose your role and register'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 text-xs p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Role Toggle for Registration */}
              <div className="flex bg-neutral-900 p-1 rounded-xl mb-3 border border-neutral-800">
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
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none"
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
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none font-mono"
                    placeholder="e.g. AA-3-A12345"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none font-mono"
              placeholder="0912345678"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-taxi-blue-primary rounded-xl p-3 text-sm text-white outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-taxi-blue-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition cursor-pointer mt-2"
          >
            {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-neutral-800">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-gray-400 hover:text-white transition"
          >
            {isLogin ? "Don't have an account? Register" : 'Already registered? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}