import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { X, User, Phone, Wallet, ShieldCheck, CheckCircle, Save, Loader2, AlertCircle, Camera } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function ProfilePage({ user, balance, onClose, onProfileUpdated }) {
  const { updateUser } = useAuth();
  
  const token = localStorage.getItem('taxipay_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [profile, setProfile] = useState(null);
  const [formState, setFormState] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    avatar: user?.avatar || ''
  });
  const [selectedFile, setSelectedFile] = useState(null); // Holds actual File object for Multer upload
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  ];

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/profile`, authHeader);

        if (isMounted) {
          if (res.data?.success && res.data?.user) {
            const u = res.data.user;
            setProfile(u);
            setFormState({
              name: u.name || '',
              phone: u.phone || '',
              avatar: u.avatar || ''
            });
          } else {
            setProfile(user || {});
            setFormState({
              name: user?.name || '',
              phone: user?.phone || '',
              avatar: user?.avatar || ''
            });
          }
        }
      } catch (err) {
        console.warn('Backend profile fetch failed, loading local user props.', err);
        if (isMounted) {
          setProfile(user || {});
          setFormState({
            name: user?.name || '',
            phone: user?.phone || '',
            avatar: user?.avatar || ''
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [user]);

  // Handle real file selection for avatar upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file); // Store actual File for FormData upload

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormState((prev) => ({ ...prev, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      let res;

      if (selectedFile) {
        // Real file upload — use multipart FormData
        const formDataPayload = new FormData();
        formDataPayload.append('avatarFile', selectedFile);
        formDataPayload.append('name', formState.name);
        formDataPayload.append('phone', formState.phone);

        res = await axios.put(`${API_BASE_URL}/api/users/profile`, formDataPayload, {
          headers: {
            ...authHeader.headers,
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // No file — send JSON body with avatar URL string
        res = await axios.put(`${API_BASE_URL}/api/users/profile`, {
          name: formState.name,
          phone: formState.phone,
          avatar: formState.avatar
        }, authHeader);
      }

      if (res.data?.success) {
        setMessage('Profile updated successfully!');
        setSelectedFile(null); // Clear file reference after successful upload

        const updatedUserData = res.data.user || { ...user, ...formState };

        // Update global AuthContext state
        updateUser(updatedUserData);

        // Notify parent component
        if (onProfileUpdated) {
          onProfileUpdated(updatedUserData);
        }
      } else {
        setError(res.data?.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Update Error:', err);
      // Fallback: save locally if server fails
      if (onProfileUpdated) {
        const fallbackUser = { ...user, ...formState };
        onProfileUpdated(fallbackUser);
        updateUser(fallbackUser);
        setMessage('Profile changes saved locally.');
      } else {
        setError(err.response?.data?.message || 'Server connection error.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-fadeIn sm:p-6">
      <div className="glass-card border border-white/10 rounded-[2rem] w-full max-w-md text-white shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] bg-gradient-to-b from-neutral-900/80 to-black/95">
        
        {/* Cover Photo / Header Banner */}
        <div className="h-32 w-full bg-gradient-to-br from-blue-600/50 via-emerald-500/30 to-purple-600/40 relative">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-md transition-all cursor-pointer z-10 hover:scale-105"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 pb-6 -mt-16 space-y-5 overflow-y-auto relative z-10 custom-scrollbar">
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Profile Picture & Badges Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 flex items-center justify-center text-gray-400 shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]">
                  {formState.avatar ? (
                    <img src={formState.avatar} alt="Profile Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="opacity-50" />
                  )}
                </div>
                <label className="absolute bottom-1 right-1 bg-emerald-500 hover:bg-emerald-400 text-white p-2.5 rounded-full cursor-pointer shadow-lg transition-all border-4 border-neutral-900 hover:scale-110">
                  <Camera size={16} />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>

              <div className="mt-3 text-center">
                <h2 className="text-xl font-black tracking-tight">{profile?.name || user?.name || 'Your Profile'}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck size={14} /> Verified {user.role}
                </div>
              </div>
            </div>

            {message && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle size={16} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="py-8 text-center text-gray-400 space-y-3">
                <Loader2 size={32} className="animate-spin mx-auto text-emerald-400" />
                <p className="text-xs font-medium animate-pulse">Loading profile data...</p>
              </div>
            ) : (
              <>
                {/* Avatar Presets Selection */}
                <div className="glass-panel border border-white/5 p-4 rounded-3xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider">Preset Avatars</span>
                    <span className="text-[10px] text-emerald-400 font-medium">Or paste a URL</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {avatarPresets.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormState({ ...formState, avatar: url });
                          setSelectedFile(null);
                        }}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300 ${formState.avatar === url ? 'border-emerald-400 scale-110 shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-105'}`}
                      >
                        <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={selectedFile ? '' : formState.avatar}
                      onChange={(e) => {
                        setFormState({ ...formState, avatar: e.target.value });
                        setSelectedFile(null);
                      }}
                      disabled={!!selectedFile}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                    />
                    {selectedFile && (
                      <p className="text-[10px] text-emerald-400 mt-1.5 font-medium flex items-center gap-1"><CheckCircle size={10} /> {selectedFile.name}</p>
                    )}
                  </div>
                </div>

                {/* Account Quick Metrics Card */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-3xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] text-emerald-400/80 uppercase font-black block mb-0.5 tracking-wider">Wallet Balance</span>
                    <div className="flex items-center gap-1.5 text-white font-mono font-bold text-lg">
                      <Wallet size={18} className="text-emerald-400" />
                      <span>{typeof balance === 'number' ? balance.toFixed(2) : `${user.balance}`} ETB</span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck size={20} />
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Full Name</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        placeholder="e.g. Abebe Bikila"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 pl-11 text-sm text-white font-medium outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all group-hover:border-white/20"
                        required
                      />
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Phone Number</label>
                    <div className="relative group">
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        placeholder="0911223344"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 pl-11 text-sm font-mono text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all group-hover:border-white/20"
                        required
                      />
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/3 glass-panel hover:bg-neutral-800 font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer text-gray-300 border border-white/5 hover:border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-2/3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} /> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}