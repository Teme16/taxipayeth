import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, drivers: 0, passengers: 0, pendingApprovals: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // ⚡ Live Online Users Tracker State
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  // Live Notification Toast State
  const [liveNotification, setLiveNotification] = useState(null);

  // State maps to toggle password visibility per user (table & modal)
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  const token = localStorage.getItem('taxi_pay_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAdminData = async () => {
    try {
      const [usersRes, statsRes, chartRes] = await Promise.all([
        axios.get(`http://localhost:5001/api/admin/users?search=${search}&role=${roleFilter}`, authHeader),
        axios.get('http://localhost:5001/api/admin/stats', authHeader),
        axios.get('http://localhost:5001/api/admin/analytics', authHeader)
      ]);
      setUsers(usersRes.data.users);
      setStats(statsRes.data.stats);
      setChartData(chartRes.data.analytics || []);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [search, roleFilter]);

  // ⚡ Real-Time Socket Connection Setup
  useEffect(() => {
    const socket = io('http://localhost:5001');

    socket.on('connect', () => {
      console.log('⚡ Admin dashboard connected to real-time socket server');
    });

    // Listen for live list of active user IDs from server.js
    socket.on('online_users_list', (userIds) => {
      setOnlineUserIds(userIds);
    });

    // Listen for new registration events
    socket.on('new_user_registered', (data) => {
      setLiveNotification(`🎉 New ${data.role} registered: ${data.name}`);
      fetchAdminData(); // Instantly update user table, stat counter cards, and charts

      // Auto-hide toast after 4 seconds
      setTimeout(() => setLiveNotification(null), 4000);
    });

    // Listen for status changes or account updates across admin sessions
    socket.on('user_status_changed', () => {
      fetchAdminData();
    });

    socket.on('user_deleted', () => {
      fetchAdminData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const togglePasswordVisibility = (userId) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleResetPassword = async (userId, userName) => {
    const newPassword = prompt(`Enter a new password for ${userName}:`);
    if (!newPassword) return;

    if (newPassword.trim().length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    try {
      const res = await axios.patch(
        `http://localhost:5001/api/admin/users/${userId}/reset-password`,
        { newPassword: newPassword.trim() },
        authHeader
      );
      alert(res.data.message || 'Password updated successfully!');
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating password');
    }
  };

  const handleApproveStatus = async (userId, newStatus) => {
    try {
      await axios.patch(`http://localhost:5001/api/admin/users/${userId}/approve`, { status: newStatus }, authHeader);
      fetchAdminData();
      if (selectedUser?._id === userId) {
        setSelectedUser(prev => ({ ...prev, approvalStatus: newStatus }));
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${userName}?`)) return;
    try {
      await axios.delete(`http://localhost:5001/api/admin/users/${userId}`, authHeader);
      setSelectedUser(null);
      fetchAdminData();
    } catch (err) {
      alert('Error deleting user');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 text-white relative space-y-6">
      {/* ⚡ Real-time Toast Alert */}
      {liveNotification && (
        <div className="fixed top-5 right-5 z-50 bg-blue-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl border border-blue-400/40 animate-bounce">
          {liveNotification}
        </div>
      )}

      {/* Title Bar with Real-Time Pulse Indicator */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-black">🚕 TaxiPay Admin Portal</h1>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          Real-Time Socket Active
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 font-bold uppercase">Total Users</p>
          <p className="text-2xl font-black mt-1">{stats.totalUsers}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 font-bold uppercase">Minibus Drivers</p>
          <p className="text-2xl font-black mt-1 text-blue-400">{stats.drivers}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 font-bold uppercase">Passengers</p>
          <p className="text-2xl font-black mt-1 text-emerald-400">{stats.passengers}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <p className="text-xs text-gray-400 font-bold uppercase">Pending IDs</p>
          <p className="text-2xl font-black mt-1 text-amber-400">{stats.pendingApprovals}</p>
        </div>
      </div>

      {/* 📈 1C: Visual Analytics Chart */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">7-Day Registration Growth</h2>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Drivers
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Passengers
            </span>
          </div>
        </div>
        
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="driverGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="passengerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="day" stroke="#737373" fontSize={11} />
              <YAxis stroke="#737373" fontSize={11} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '12px' }} 
              />
              <Area type="monotone" dataKey="Drivers" stroke="#60A5FA" fillOpacity={1} fill="url(#driverGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Passengers" stroke="#34D399" fillOpacity={1} fill="url(#passengerGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search by name, phone, plate #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-sm flex-1 outline-none focus:border-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-sm outline-none"
        >
          <option value="">All Roles</option>
          <option value="driver">Drivers</option>
          <option value="passenger">Passengers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-gray-400 uppercase font-bold border-b border-neutral-800">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Role</th>
              <th className="p-4">Password Hash</th>
              <th className="p-4">Telegram Chat ID</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {users.map((u) => {
              const isOnline = onlineUserIds.includes(u._id);
              const isPasswordVisible = showPasswordMap[u._id];

              return (
                <tr key={u._id} className="hover:bg-neutral-800/50 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {/* Live Online/Offline Status Indicator Dot */}
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isOnline ? 'bg-emerald-500 animate-ping' : 'bg-neutral-600'
                        }`}
                        title={isOnline ? 'User is currently online' : 'Offline'}
                      />
                      <div className="font-bold text-sm text-white">{u.name}</div>
                      {isOnline && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wide">
                          ONLINE
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 font-mono text-xs mt-0.5">{u.phone}</div>
                    {u.driverData?.targaNo && (
                      <div className="text-[10px] text-blue-400 font-mono mt-0.5">Plate: {u.driverData.targaNo}</div>
                    )}
                  </td>
                  <td className="p-4 capitalize font-semibold">{u.role}</td>
                  
                  {/* Password Hash Reveal Column */}
                  <td className="p-4 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="bg-neutral-950 px-2 py-1 rounded border border-neutral-800 max-w-[130px] truncate text-gray-400">
                        {isPasswordVisible ? (u.password || 'N/A') : '••••••••••••'}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(u._id)}
                        className="text-xs bg-neutral-800 hover:bg-neutral-700 p-1 rounded-md transition"
                        title={isPasswordVisible ? "Hide hash" : "Show hash"}
                      >
                        {isPasswordVisible ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </td>

                  <td className="p-4 font-mono text-gray-400">{u.telegramChatId || 'Not Linked'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      u.approvalStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      u.approvalStatus === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {u.approvalStatus || 'approved'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleResetPassword(u._id, u.name)}
                      className="bg-amber-600/80 hover:bg-amber-600 px-3 py-1.5 rounded-lg text-white font-bold transition"
                      title="Set a new password for this user"
                    >
                      Reset Pass
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setShowModalPassword(false);
                      }}
                      className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-gray-300 transition"
                    >
                      View Info
                    </button>
                    {u.approvalStatus !== 'approved' && (
                      <button
                        onClick={() => handleApproveStatus(u._id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-white font-bold transition"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(u._id, u.name)}
                      className="bg-red-600/80 hover:bg-red-600 px-3 py-1.5 rounded-lg text-white font-bold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 🖼️ User Info & Driver Document Previewer Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 max-w-lg w-full text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black">Driver & User Verification</h3>
              {onlineUserIds.includes(selectedUser._id) && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-mono font-bold">
                  ONLINE NOW
                </span>
              )}
            </div>

            {/* Account Info Card */}
            <div className="space-y-2.5 text-xs font-mono bg-neutral-950 p-4 rounded-2xl border border-neutral-800 mb-4">
              <p><span className="text-gray-500">ID:</span> {selectedUser._id}</p>
              <p><span className="text-gray-500">Name:</span> {selectedUser.name}</p>
              <p><span className="text-gray-500">Phone:</span> {selectedUser.phone}</p>
              
              {/* Modal Password Hash Row */}
              <div className="flex items-center justify-between">
                <div className="overflow-hidden">
                  <span className="text-gray-500">Hash:</span>{' '}
                  <span className="break-all text-xs text-gray-400">
                    {showModalPassword ? (selectedUser.password || 'N/A') : '••••••••••••'}
                  </span>
                </div>
                <button
                  onClick={() => setShowModalPassword(!showModalPassword)}
                  className="text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-0.5 rounded transition ml-2 shrink-0"
                >
                  {showModalPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <p><span className="text-gray-500">Role:</span> <span className="capitalize font-bold text-white">{selectedUser.role}</span></p>
              <p><span className="text-gray-500">Telegram Chat ID:</span> {selectedUser.telegramChatId || 'N/A'}</p>
              
              {selectedUser.driverData && (
                <>
                  <p><span className="text-gray-500">Plate Number:</span> <span className="text-blue-400 font-bold">{selectedUser.driverData.targaNo || 'N/A'}</span></p>
                  <p><span className="text-gray-500">Driver Code:</span> {selectedUser.driverData.driverId || 'N/A'}</p>
                </>
              )}
              <p><span className="text-gray-500">Registered:</span> {new Date(selectedUser.createdAt).toLocaleString()}</p>
            </div>

            {/* 📄 Driver Uploaded Documents Section */}
            {selectedUser.role === 'driver' && (
              <div className="mb-6">
                <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-3">
                  Uploaded Verification Documents
                </h4>

                {selectedUser.driverData?.documentUrl || selectedUser.driverData?.licenseImage ? (
                  <div className="space-y-3">
                    <div className="relative group bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden p-2">
                      <img
                        src={`http://localhost:5001${selectedUser.driverData.documentUrl || selectedUser.driverData.licenseImage}`}
                        alt="Driver Document"
                        className="w-full h-48 object-cover rounded-xl"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/400x200?text=Document+Image+Not+Found';
                        }}
                      />
                      <a
                        href={`http://localhost:5001${selectedUser.driverData.documentUrl || selectedUser.driverData.licenseImage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-4 right-4 bg-black/80 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700 backdrop-blur-sm transition"
                      >
                        🔍 Open Full Size
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-950/60 border border-dashed border-neutral-800 rounded-2xl p-4 text-center text-xs text-gray-500">
                    No verification document files uploaded yet for this driver.
                  </div>
                )}
              </div>
            )}

            {/* Action Controls */}
            <div className="flex items-center gap-2">
              {selectedUser.approvalStatus !== 'approved' && (
                <button
                  onClick={() => handleApproveStatus(selectedUser._id, 'approved')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold transition text-xs"
                >
                  Approve Driver
                </button>
              )}
              {selectedUser.approvalStatus !== 'rejected' && (
                <button
                  onClick={() => handleApproveStatus(selectedUser._id, 'rejected')}
                  className="flex-1 bg-red-600 hover:bg-red-500 py-2.5 rounded-xl font-bold transition text-xs"
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => setSelectedUser(null)}
                className="px-5 bg-neutral-800 hover:bg-neutral-700 py-2.5 rounded-xl font-bold transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}