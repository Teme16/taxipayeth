import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Sparkles } from 'lucide-react';

export default function ProfilePage({ onClose, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [formState, setFormState] = useState({ name: '', phone: '', avatar: '', preferences: '{}' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Helper to extract JWT token from local storage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('taxi_pay_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('http://localhost:5001/api/users/profile', {
          withCredentials: true,
          headers: getAuthHeaders() // Pass Bearer JWT token in headers
        });

        if (res.data.success) {
          const user = res.data.user;
          setProfile(user);
          setFormState({
            name: user.name || '',
            phone: user.phone || '',
            avatar: user.avatar || '',
            preferences: JSON.stringify(user.preferences || {}, null, 2)
          });
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    let preferencesValue = {};

    try {
      preferencesValue = formState.preferences ? JSON.parse(formState.preferences) : {};
    } catch (parseError) {
      setError('Preferences must be valid JSON.');
      setSaving(false);
      return;
    }

    try {
      const res = await axios.put(
        'http://localhost:5001/api/users/profile',
        {
          name: formState.name.trim(),
          phone: formState.phone.trim(),
          avatar: formState.avatar.trim(),
          preferences: preferencesValue
        },
        {
          withCredentials: true,
          headers: getAuthHeaders() // Pass Bearer JWT token in headers
        }
      );

      if (res.data.success) {
        setProfile(res.data.user);
        setMessage('Profile updated successfully.');
        if (onProfileUpdated) {
          onProfileUpdated(res.data.user);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-3xl max-w-2xl w-full text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-3xl bg-linear-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black">Your Profile</h2>
              <p className="text-xs text-gray-400">Update your personal information and preferences securely.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white rounded-full p-2">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading profile…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 px-6 py-6">
            {error && <div className="rounded-2xl bg-red-500/20 border border-red-500 text-red-200 p-3 text-xs">{error}</div>}
            {message && <div className="rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-200 p-3 text-xs">{message}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs uppercase text-gray-400 font-bold">
                Full Name
                <input
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="mt-2 w-full rounded-2xl bg-neutral-950 border border-neutral-800 p-3 text-white outline-none"
                />
              </label>
              <label className="block text-xs uppercase text-gray-400 font-bold">
                Phone
                <input
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  className="mt-2 w-full rounded-2xl bg-neutral-950 border border-neutral-800 p-3 text-white outline-none font-mono"
                />
              </label>
            </div>

            <label className="block text-xs uppercase text-gray-400 font-bold">
              Avatar URL
              <input
                value={formState.avatar}
                onChange={(e) => setFormState({ ...formState, avatar: e.target.value })}
                className="mt-2 w-full rounded-2xl bg-neutral-950 border border-neutral-800 p-3 text-white outline-none"
                placeholder="https://example.com/avatar.jpg"
              />
            </label>

            <label className="block text-xs uppercase text-gray-400 font-bold">
              Preferences
              <textarea
                value={formState.preferences}
                onChange={(e) => setFormState({ ...formState, preferences: e.target.value })}
                rows={6}
                className="mt-2 w-full rounded-2xl bg-neutral-950 border border-neutral-800 p-3 text-white outline-none font-mono text-xs"
                placeholder='e.g. {"notifications":true, "language":"en"}'
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-2xl px-5 py-3 text-sm font-bold text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 rounded-2xl px-5 py-3 text-sm font-bold text-white transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}