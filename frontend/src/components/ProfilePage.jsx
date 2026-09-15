import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Phone, Wallet, ShieldCheck, CheckCircle, Save,
  Loader2, AlertCircle, Camera, Settings, LogOut, Trash2,
  Key, Eye, EyeOff, UploadCloud, ChevronLeft
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://taxipayeth.onrender.com';

export default function ProfilePage({ user, balance, onClose, onProfileUpdated }) {
  const { updateUser, logout } = useAuth();
  const token = localStorage.getItem('taxipay_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Core State
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // UI State
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'verify'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState('none'); // 'none' | 'password' | 'delete'

  // Form States
  const [formState, setFormState] = useState({ 
    name: '', phone: '', avatar: '',
    targaNo: '', licenseNo: '', address: ''
  });
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);

  // Verification Form State
  const [verifyForm, setVerifyForm] = useState({ docType: 'national_id', frontId: null, backId: null });
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  // Password Form State
  const [passForm, setPassForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState({ old: false, new: false, confirm: false });

  // Refs
  const settingsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/profile`, authHeader);
        if (isMounted) {
          const u = res.data?.user || user;
          setProfile(u);
          setFormState({ 
            name: u.name || '', 
            phone: u.phone || '', 
            avatar: u.avatar || '',
            targaNo: u.driverData?.targaNo || u.targaNo || '',
            licenseNo: u.driverData?.licenseNo || u.licenseNumber || '',
            address: u.driverData?.address || u.address || ''
          });
        }
      } catch (err) {
        if (isMounted) {
          setProfile(user || {});
          setFormState({ 
            name: user?.name || '', 
            phone: user?.phone || '', 
            avatar: user?.avatar || '',
            targaNo: user?.driverData?.targaNo || user?.targaNo || '',
            licenseNo: user?.driverData?.licenseNo || user?.licenseNumber || '',
            address: user?.driverData?.address || user?.address || ''
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [user]);

  // Click outside to close settings
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsRef]);

  // --- Handlers ---

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }
    setError(null);
    setSelectedAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFormState(prev => ({ ...prev, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      let res;
      if (selectedAvatarFile) {
        const fd = new FormData();
        fd.append('avatarFile', selectedAvatarFile);
        fd.append('name', formState.name);
        fd.append('phone', formState.phone);
        res = await axios.put(`${API_BASE_URL}/api/users/profile`, fd, {
          headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        res = await axios.put(`${API_BASE_URL}/api/users/profile`, {
          name: formState.name,
          phone: formState.phone,
          avatar: formState.avatar
        }, authHeader);
      }

      if (res.data?.success) {
        if (profile?.role === 'driver') {
          const driverFd = new FormData();
          driverFd.append('driverId', profile.driverData?.driverId || profile._id);
          driverFd.append('fullName', formState.name);
          driverFd.append('mobileNumber', formState.phone);
          driverFd.append('targaNo', formState.targaNo);
          driverFd.append('licenseNumber', formState.licenseNo);
          driverFd.append('address', formState.address);
          await axios.post(`${API_BASE_URL}/api/drivers/complete-profile`, driverFd, authHeader);
        }
        
        setMessage('Profile updated successfully!');
        setSelectedAvatarFile(null);
        
        // Refetch profile to get synchronized data
        const freshRes = await axios.get(`${API_BASE_URL}/api/users/profile`, authHeader);
        const updatedUser = freshRes.data?.user || { ...user, ...formState };
        setProfile(updatedUser);
        updateUser(updatedUser);
        if (onProfileUpdated) onProfileUpdated(updatedUser);
        setMode('view');
      } else {
        setError(res.data?.message || 'Failed to update profile.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server connection error.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyForm.frontId || !verifyForm.backId) {
      setError('Both front and back ID images are required.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('docType', verifyForm.docType);
      fd.append('frontId', verifyForm.frontId);
      fd.append('backId', verifyForm.backId);

      const res = await axios.post(`${API_BASE_URL}/api/users/verify-request`, fd, {
        headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setMessage('Verification submitted successfully!');
        const updatedUser = { ...profile, verificationStatus: 'pending' };
        setProfile(updatedUser);
        updateUser(updatedUser);
        if (onProfileUpdated) onProfileUpdated(updatedUser);
        setMode('view');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification submission failed.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/api/users/change-password`, {
        oldPassword: passForm.oldPassword,
        newPassword: passForm.newPassword
      }, authHeader);
      setMessage('Password changed successfully.');
      setActiveModal('none');
      setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/users/account`, authHeader);
      if (logout) logout();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account.');
      setSaving(false);
      setActiveModal('none');
    }
  };

  // --- Render Helpers ---

  const getVerificationBadge = () => {
    const status = profile?.verificationStatus || 'not_verified';
    if (status === 'verified') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <CheckCircle size={14} /> Verified {profile?.role}
        </div>
      );
    }
    if (status === 'pending') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(251,191,36,0.2)]">
          <Loader2 size={14} className="animate-spin" /> Pending Verification
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-bold uppercase tracking-wider">
        <ShieldCheck size={14} /> Not Verified
      </div>
    );
  };

  const handleIdUpload = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    setVerifyForm(prev => ({ ...prev, [side]: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      if (side === 'frontId') setFrontPreview(reader.result);
      else setBackPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-fadeIn sm:p-6">
      <div className="glass-card border border-white/10 rounded-[2rem] w-full max-w-md text-white shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] bg-gradient-to-b from-neutral-900/90 to-black/95">
        
        {/* Cover Photo / Header Banner */}
        <div className="h-32 w-full bg-gradient-to-br from-blue-600/30 via-emerald-500/20 to-purple-600/30 relative">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
          
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-md transition-all z-20">
            <X size={18} />
          </button>

          {/* Settings Gear */}
          <div className="absolute top-4 left-4 z-20" ref={settingsRef}>
            <motion.button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              animate={{ rotate: isSettingsOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="p-2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-md transition-all"
            >
              <Settings size={18} />
            </motion.button>
            
            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-12 left-0 w-48 bg-neutral-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden py-2"
                >
                  <button onClick={() => { setActiveModal('password'); setIsSettingsOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors">
                    <Key size={16} className="text-gray-400" /> Change Password
                  </button>
                  <button onClick={() => logout && logout()} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition-colors">
                    <LogOut size={16} className="text-gray-400" /> Log Out
                  </button>
                  <div className="h-px w-full bg-white/10 my-1"></div>
                  <button onClick={() => { setActiveModal('delete'); setIsSettingsOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-rose-500/10 text-rose-400 transition-colors">
                    <Trash2 size={16} /> Delete Account
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 pb-6 -mt-16 space-y-5 overflow-y-auto relative z-10 custom-scrollbar">
          {loading ? (
            <div className="py-12 space-y-4">
              <div className="w-28 h-28 mx-auto bg-white/5 rounded-full animate-pulse border-4 border-neutral-900"></div>
              <div className="h-6 w-1/2 mx-auto bg-white/5 rounded-full animate-pulse mt-4"></div>
              <div className="h-4 w-1/3 mx-auto bg-white/5 rounded-full animate-pulse"></div>
              <div className="space-y-3 mt-8">
                <div className="h-12 w-full bg-white/5 rounded-2xl animate-pulse"></div>
                <div className="h-12 w-full bg-white/5 rounded-2xl animate-pulse"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Profile Avatar & Header */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 flex items-center justify-center text-gray-400 shadow-2xl transition-transform duration-300 group-hover:scale-[1.02] relative">
                    {formState.avatar ? (
                      <img src={formState.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="opacity-50" />
                    )}
                    {/* Hover Overlay */}
                    {mode === 'edit' && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={20} className="text-white mb-1" />
                        <span className="text-[10px] font-bold text-white">CHANGE</span>
                      </div>
                    )}
                  </div>
                  {mode === 'edit' && (
                    <label className="absolute inset-0 cursor-pointer rounded-full z-10 opacity-0">
                      <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                    </label>
                  )}
                </div>

                <div className="mt-4 text-center flex flex-col items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight">{profile?.name || 'Your Profile'}</h2>
                  {getVerificationBadge()}
                </div>
              </div>

              {/* Messages */}
              <AnimatePresence>
                {message && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs flex items-center gap-2">
                    <CheckCircle size={16} className="shrink-0" /> <span>{message}</span>
                  </motion.div>
                )}
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" /> <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* View Mode */}
              {mode === 'view' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Stats */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-3xl flex items-center justify-between shadow-lg">
                    <div>
                      <span className="text-[10px] text-emerald-400/80 uppercase font-black block mb-0.5 tracking-wider">Wallet Balance</span>
                      <div className="flex items-center gap-1.5 text-white font-mono font-bold text-lg">
                        <Wallet size={18} className="text-emerald-400" />
                        <span>{typeof balance === 'number' ? balance.toFixed(2) : (profile?.balance || 0)} ETB</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <ShieldCheck size={20} />
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-gray-400"><User size={18} /></div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Full Name</p>
                        <p className="text-sm font-medium">{profile?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-gray-400"><Phone size={18} /></div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Phone</p>
                        <p className="text-sm font-mono">{profile?.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic CTA */}
                  {profile?.role === 'driver' && profile?.verificationStatus === 'not_verified' ? (
                    <button onClick={() => setMode('verify')} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2">
                      <ShieldCheck size={18} /> Verify Account
                    </button>
                  ) : profile?.verificationStatus === 'pending' ? (
                    <button disabled className="w-full bg-white/10 text-gray-400 font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-not-allowed">
                      <Loader2 size={18} className="animate-spin" /> Verification Under Review
                    </button>
                  ) : (
                    <button onClick={() => setMode('edit')} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center gap-2">
                      Edit Profile
                    </button>
                  )}
                </motion.div>
              )}

              {/* Edit Mode */}
              {mode === 'edit' && (
                <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleProfileSave} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={() => setMode('view')} className="p-1 text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                    <h3 className="font-bold">Edit Profile</h3>
                  </div>
                  
                  {profile?.verificationStatus === 'verified' && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400/90 rounded-xl text-xs">
                      Note: You are verified. Major changes may require re-verification.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Full Name</label>
                    <input type="text" value={formState.name} onChange={(e) => setFormState({...formState, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-emerald-500/50 transition-all" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Phone Number</label>
                    <input type="tel" value={formState.phone} onChange={(e) => setFormState({...formState, phone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm font-mono text-white outline-none focus:border-emerald-500/50 transition-all" required />
                  </div>
                  
                  {profile?.role === 'driver' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Plate Number</label>
                        <input type="text" value={formState.targaNo} onChange={(e) => setFormState({...formState, targaNo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm font-mono text-white outline-none focus:border-emerald-500/50 transition-all" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">License No.</label>
                        <input type="text" value={formState.licenseNo} onChange={(e) => setFormState({...formState, licenseNo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm font-mono text-white outline-none focus:border-emerald-500/50 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Address / City</label>
                        <input type="text" value={formState.address} onChange={(e) => setFormState({...formState, address: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-emerald-500/50 transition-all" />
                      </div>
                    </>
                  )}

                  <button type="submit" disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
                  </button>
                </motion.form>
              )}

              {/* Verify Mode */}
              {mode === 'verify' && (
                <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleVerifySubmit} className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={() => setMode('view')} className="p-1 text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                    <h3 className="font-bold">Submit Verification</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">Document Type</label>
                    <select value={verifyForm.docType} onChange={e => setVerifyForm({...verifyForm, docType: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-emerald-500/50 transition-all appearance-none">
                      <option value="national_id">National ID</option>
                      <option value="kebele_id">Kebele / Local ID</option>
                    </select>
                  </div>

                  {/* Upload Front */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">ID Front Side</label>
                    <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer overflow-hidden bg-black/20">
                      {frontPreview ? (
                        <img src={frontPreview} alt="Front ID" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
                          <UploadCloud size={28} className="mb-2 opacity-70" />
                          <p className="text-xs font-medium">Click to upload front</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleIdUpload(e, 'frontId')} />
                    </label>
                  </div>

                  {/* Upload Back */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block ml-1">ID Back Side</label>
                    <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer overflow-hidden bg-black/20">
                      {backPreview ? (
                        <img src={backPreview} alt="Back ID" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
                          <UploadCloud size={28} className="mb-2 opacity-70" />
                          <p className="text-xs font-medium">Click to upload back</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleIdUpload(e, 'backId')} />
                    </label>
                  </div>

                  <button type="submit" disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 mt-4">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Submit for Verification
                  </button>
                </motion.form>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Change Password Modal */}
      <AnimatePresence>
        {activeModal === 'password' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={18}/></button>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Key size={18} className="text-emerald-400"/> Change Password</h3>
              
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {['old', 'new', 'confirm'].map((type) => (
                  <div key={type} className="relative">
                    <input 
                      type={showPass[type] ? 'text' : 'password'} 
                      placeholder={type === 'old' ? 'Old Password' : type === 'new' ? 'New Password' : 'Confirm Password'}
                      value={type === 'old' ? passForm.oldPassword : type === 'new' ? passForm.newPassword : passForm.confirmPassword}
                      onChange={e => setPassForm(p => ({ ...p, [type+'Password']: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white pr-10 focus:border-emerald-500/50 outline-none transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => ({ ...p, [type]: !p[type] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPass[type] ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                ))}
                <button type="submit" disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl mt-2 flex justify-center disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : 'Update Password'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {activeModal === 'delete' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-neutral-900 border border-rose-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black mb-2 text-white">Delete Account?</h3>
              <p className="text-sm text-gray-400 mb-6">Are you absolutely sure? This action cannot be undone and you will lose all data.</p>
              
              <div className="flex gap-3">
                <button onClick={() => setActiveModal('none')} disabled={saving} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl disabled:opacity-50">Cancel</button>
                <button onClick={handleDeleteAccount} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)] disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
