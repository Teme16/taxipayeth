import React, { useState } from 'react';
import { Camera, Upload, User, Calendar, CreditCard, Phone, CheckCircle, ShieldAlert } from 'lucide-react';

export default function DriverProfileSetup({ driverId, onComplete }) {
  const [formData, setFormData] = useState({
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
      data.append('birthDate', formData.birthDate);
      data.append('licenseNumber', formData.licenseNumber);
      data.append('emergencyContact', formData.emergencyContact);
      data.append('address', formData.address);

      if (profilePic) data.append('profilePic', profilePic);
      if (digitalId) data.append('digitalId', digitalId);

      const response = await fetch('http://localhost:5001/api/drivers/complete-profile', {
        method: 'POST',
        body: data // FormData handles multipart/form-data headers automatically
      });

      const result = await response.json();

      if (result.success) {
        if (onComplete) onComplete(result.driver);
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
    <div className="max-w-lg mx-auto bg-neutral-900 border border-neutral-800 text-white rounded-3xl p-6 shadow-2xl space-y-6 my-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black">Complete Your Profile</h2>
        <p className="text-xs text-gray-400">Please provide your verification documents and info to start driving.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-2xl text-xs flex items-center gap-2">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Profile Picture Upload */}
        <div className="flex flex-col items-center gap-2">
          <label className="text-xs font-bold text-gray-300">Profile Picture</label>
          <div className="relative w-24 h-24 rounded-full bg-neutral-950 border-2 border-dashed border-neutral-700 flex items-center justify-center overflow-hidden group cursor-pointer hover:border-emerald-500 transition">
            {profilePicPreview ? (
              <img src={profilePicPreview} alt="Profile Preview" className="w-full h-full object-cover" />
            ) : (
              <User size={32} className="text-gray-500 group-hover:text-emerald-400" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, setProfilePic, setProfilePicPreview)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              required
            />
          </div>
          <span className="text-[10px] text-gray-400">Click to upload clear headshot</span>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Birth Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
              <Calendar size={12} /> Birth Date
            </label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* License Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
              <CreditCard size={12} /> Driving License No.
            </label>
            <input
              type="text"
              name="licenseNumber"
              placeholder="e.g. DL-987213"
              value={formData.licenseNumber}
              onChange={handleChange}
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
            <Phone size={12} /> Emergency Contact Phone
          </label>
          <input
            type="tel"
            name="emergencyContact"
            placeholder="+251 9..."
            value={formData.emergencyContact}
            onChange={handleChange}
            required
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Digital ID Document Upload */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-300">Upload Digital ID / Fayda ID</label>
          <div className="relative w-full h-28 bg-neutral-950 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer hover:border-emerald-500/50 transition">
            {digitalIdPreview ? (
              <img src={digitalIdPreview} alt="Digital ID Preview" className="h-full object-contain rounded-lg" />
            ) : (
              <div className="text-center space-y-1">
                <Upload size={20} className="mx-auto text-gray-400" />
                <p className="text-xs text-gray-400">Click or drag file to upload Digital ID photo</p>
                <span className="text-[10px] text-gray-500">JPG, PNG, or PDF</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileChange(e, setDigitalId, setDigitalIdPreview)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              required
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <span>Saving Profile...</span>
          ) : (
            <>
              <CheckCircle size={16} /> Save & Proceed to Dashboard
            </>
          )}
        </button>
      </form>
    </div>
  );
}