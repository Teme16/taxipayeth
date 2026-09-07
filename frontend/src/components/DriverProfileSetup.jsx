import React, { useState } from 'react';
import { Upload, User, Calendar, CreditCard, Phone, CheckCircle, ShieldAlert, Truck } from 'lucide-react';

export default function DriverProfileSetup({ driverId, initialData = {}, onComplete }) {
  const [formData, setFormData] = useState({
    fullName: initialData.name || '',
    mobileNumber: initialData.phone || '',
    targaNo: initialData.driverData?.targaNo || '',
    birthDate: '',
    licenseNumber: '',
    emergencyContact: '',
    address: ''
  });

  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  
  const [digitalId, setDigitalId] = useState(null);
  const [digitalIdPreview, setDigitalIdPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Text Input Changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle Image Previews
  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = new FormData();
      data.append('driverId', driverId);
      data.append('fullName', formData.fullName);
      data.append('mobileNumber', formData.mobileNumber);
      data.append('targaNo', formData.targaNo);
      data.append('birthDate', formData.birthDate);
      data.append('licenseNumber', formData.licenseNumber);
      data.append('emergencyContact', formData.emergencyContact);
      data.append('address', formData.address);

      if (profilePic) data.append('profilePic', profilePic);
      if (digitalId) data.append('digitalId', digitalId);

      const token = localStorage.getItem('taxi_pay_token');

      const response = await fetch('http://localhost:5001/api/drivers/complete-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data // FormData handles multipart/form-data boundary headers automatically
      });

      const result = await response.json();

      if (result.success) {
        // Sync updated User data back to localStorage for top bar rendering
        if (result.user) {
          localStorage.setItem('taxi_pay_user', JSON.stringify(result.user));
        }
        if (onComplete) onComplete(result.driver, result.user);
      } else {
        setError(result.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8 relative animate-in fade-in zoom-in-95 duration-500">
      {/* Background glow effects */}
      <div className="absolute top-0 -left-10 w-48 h-48 bg-emerald-500/20 rounded-full mix-blend-screen filter blur-[50px] animate-pulse"></div>
      <div className="absolute bottom-0 -right-10 w-48 h-48 bg-teal-500/20 rounded-full mix-blend-screen filter blur-[50px] animate-pulse delay-1000"></div>

      <div className="relative bg-neutral-900/80 backdrop-blur-2xl border border-white/10 text-white rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(16,185,129,0.2)]">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-2 border border-emerald-500/20 shadow-inner">
            <User size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black tracking-tight bg-linear-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Driver Setup
          </h2>
          <p className="text-xs text-gray-400 font-medium max-w-sm mx-auto">
            Provide your verification documents and vehicle information to activate your driver account.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-3 shadow-inner animate-in slide-in-from-top-2">
            <ShieldAlert size={20} className="shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture Upload - Prominent */}
          <div className="flex flex-col items-center gap-3 bg-neutral-950/50 p-6 rounded-3xl border border-white/5 shadow-inner">
            <div className="relative w-28 h-28 rounded-full p-1 bg-linear-to-tr from-emerald-500/50 to-transparent flex items-center justify-center overflow-hidden cursor-pointer group hover:from-emerald-400 transition-all shadow-lg">
              <div className="w-full h-full bg-neutral-900 rounded-full flex flex-col items-center justify-center relative overflow-hidden border border-white/10">
                {profilePicPreview ? (
                  <img src={profilePicPreview} alt="Profile Preview" className="w-full h-full object-cover group-hover:opacity-50 transition duration-300" />
                ) : (
                  <User size={36} className="text-gray-500 group-hover:text-emerald-400 transition duration-300" />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                  <Upload size={24} className="text-white" />
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, setProfilePic, setProfilePicPreview)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <div className="text-center">
              <label className="text-xs font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Profile Photo</label>
              <span className="text-[10px] text-gray-500">Tap to upload a clear headshot</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Full Name</label>
              <input
                type="text"
                name="fullName"
                placeholder="e.g. Kirubel Asmelash"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Mobile Phone</label>
              <input
                type="tel"
                name="mobileNumber"
                placeholder="0912345678"
                value={formData.mobileNumber}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 transition-colors">
                <Truck size={12} /> Plate Number
              </label>
              <input
                type="text"
                name="targaNo"
                placeholder="e.g. AA-2-3456"
                value={formData.targaNo}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 transition-colors">
                <CreditCard size={12} /> License No.
              </label>
              <input
                type="text"
                name="licenseNumber"
                placeholder="e.g. DL-987213"
                value={formData.licenseNumber}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 transition-colors">
                <Calendar size={12} /> Birth Date
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 transition-colors">
                <Phone size={12} /> Emergency Phone
              </label>
              <input
                type="tel"
                name="emergencyContact"
                placeholder="09..."
                value={formData.emergencyContact}
                onChange={handleChange}
                required
                className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono focus:bg-neutral-900/80 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="group">
            <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Address / City</label>
            <input
              type="text"
              name="address"
              placeholder="Addis Ababa"
              value={formData.address}
              onChange={handleChange}
              required
              className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900/80 transition-all shadow-inner"
            />
          </div>

          <div className="group">
            <label className="text-[10px] font-bold text-gray-400 group-focus-within:text-emerald-400 uppercase tracking-wider mb-1 block transition-colors">Digital ID / Fayda ID</label>
            <div className="relative w-full h-32 bg-neutral-950/50 border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all shadow-inner">
              {digitalIdPreview ? (
                <img src={digitalIdPreview} alt="Digital ID Preview" className="h-full object-contain rounded-lg" />
              ) : (
                <div className="text-center space-y-2">
                  <div className="p-3 bg-neutral-900 rounded-full inline-block border border-white/5 shadow-lg group-hover:border-emerald-500/30 transition-colors">
                    <Upload size={20} className="text-gray-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Click or drag file to upload</p>
                    <span className="text-[10px] text-gray-500">JPG, PNG, or PDF</span>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e, setDigitalId, setDigitalIdPreview)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black py-4 rounded-2xl text-sm transition-all transform hover:scale-[1.02] shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></div> Saving Profile...</span>
              ) : (
                <><CheckCircle size={18} /> Complete Setup & Proceed</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}