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
import LiveFleetMap from './LiveFleetMap';

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://taxipayeth.onrender.com';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('analytics');
  const [stats, setStats] = useState({ totalUsers: 0, drivers: 0, passengers: 0, pendingApprovals: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Route management state
  const [routeForm, setRouteForm] = useState({ name: '', origin: '', destination: '', baseFare: '', distance: '', isActive: true });
  const [editingRoute, setEditingRoute] = useState(null);

  // Modal Control States
  const [resetPassUser, setResetPassUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
// Broadcast States
  const [broadcastAudience, setBroadcastAudience] = useState('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Live Online Users Tracker & Toast States
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [liveNotification, setLiveNotification] = useState(null);

  const token = localStorage.getItem('taxipay_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAdminData = async () => {
    try {
      const [usersRes, statsRes, chartRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/users?search=${search}&role=${roleFilter}&approvalStatus=${statusFilter}`, authHeader),
        axios.get(`${API_BASE_URL}/api/admin/stats`, authHeader),
        axios.get(`${API_BASE_URL}/api/admin/analytics`, authHeader)
      ]);
      setUsers(usersRes.data.users);
      setStats({
        totalUsers: statsRes.data.stats?.users?.total || 0,
        drivers: statsRes.data.stats?.users?.drivers || 0,
        passengers: statsRes.data.stats?.users?.passengers || 0,
        pendingApprovals: statsRes.data.stats?.users?.pendingApprovals || 0
      });
      const analytics = chartRes.data.analytics || {};
      const newUsers = analytics.newUsers || [];
      const formattedChart = newUsers.map(u => ({
        day: u._id,
        Drivers: Math.floor(u.count * 0.3) || 0,
        Passengers: Math.ceil(u.count * 0.7) || u.count
      }));
      setChartData(formattedChart);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/transactions`, authHeader);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/trips`, authHeader);
      setTrips(res.data.trips || []);
    } catch (err) {
      console.error('Failed to fetch trips:', err);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/routes`, authHeader);
      setRoutes(res.data.routes || []);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/logs`, authHeader);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const loadActiveTabData = async () => {
    if (activeTab === 'tariff') {
      await fetchTransactions();
      await fetchRoutes();
    }
    if (activeTab === 'analytics') await fetchTrips();
    if (activeTab === 'fleet') await fetchLogs();
  };

  const resetRouteForm = () => {
    setRouteForm({ name: '', origin: '', destination: '', baseFare: '', distance: '', isActive: true });
    setEditingRoute(null);
  };

  const submitRouteForm = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        name: routeForm.name.trim(),
        origin: routeForm.origin.trim(),
        destination: routeForm.destination.trim(),
        baseFare: Number(routeForm.baseFare),
        distance: Number(routeForm.distance),
        isActive: Boolean(routeForm.isActive)
      };

      if (!payload.name || !payload.origin || !payload.destination || Number.isNaN(payload.baseFare) || Number.isNaN(payload.distance)) {
        setLiveNotification('⚠️ Please fill out all route fields correctly.');
        setTimeout(() => setLiveNotification(null), 3000);
        return;
      }

      const url = editingRoute
        ? `${API_BASE_URL}/api/admin/routes/${editingRoute._id}`
        : `${API_BASE_URL}/api/admin/routes`;
      const method = editingRoute ? axios.put : axios.post;
      await method(url, payload, authHeader);

      setLiveNotification(editingRoute ? '✅ Route updated successfully.' : '✅ Route created successfully.');
      resetRouteForm();
      fetchRoutes();
      fetchAdminData();
    } catch (err) {
      setLiveNotification(`❌ ${err.response?.data?.message || 'Unable to save route.'}`);
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };

  const handleEditRoute = (route) => {
    setEditingRoute(route);
    setRouteForm({
      name: route.name || '',
      origin: route.origin || '',
      destination: route.destination || '',
      baseFare: route.baseFare?.toString() || '',
      distance: route.distance?.toString() || '',
      isActive: Boolean(route.isActive)
    });
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('Delete this route permanently?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/routes/${routeId}`, authHeader);
      setLiveNotification('✅ Route deleted successfully.');
      fetchRoutes();
      fetchAdminData();
    } catch (err) {
      setLiveNotification('❌ Unable to delete route.');
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    loadActiveTabData();
  }, [activeTab]);

  // ⚡ Socket.io Real-Time Event Setup
  useEffect(() => {
    const socketToken = localStorage.getItem('taxipay_token');
    const socket = io(API_BASE_URL, {
      auth: { token: socketToken }
    });


    socket.on('connect', () => {
      // Register admin user as online
      const storedUser = JSON.parse(localStorage.getItem('taxi_pay_user') || '{}');
      if (storedUser.id || storedUser._id) {
        socket.emit('register_online_user', storedUser._id || storedUser.id);
      }
    });

    // Receive array of active connected user IDs from backend
    socket.on('online_users_list', (userIds) => {
      setOnlineUserIds(userIds.map(id => String(id)));
    });

    socket.on('new_user_registered', (data) => {
      setLiveNotification(`🎉 New ${data.role} registered: ${data.name} (Pending Approval)`);
      fetchAdminData();
      setTimeout(() => setLiveNotification(null), 5000);
    });

    // ⚡ Real-Time Profile Updates Listener
    socket.on('user_updated', (updatedData) => {
      setLiveNotification(`🔄 Profile updated for ${updatedData.name}`);
      fetchAdminData();

      // Dynamically update modal if currently viewed user is updated
      setSelectedUser((prev) => {
        if (prev && String(prev._id || prev.id) === String(updatedData.userId)) {
          return {
            ...prev,
            name: updatedData.name,
            phone: updatedData.phone,
            driverData: updatedData.driverData
          };
        }
        return prev;
      });

      setTimeout(() => setLiveNotification(null), 4000);
    });

    socket.on('user_status_changed', () => fetchAdminData());
    socket.on('user_deleted', () => fetchAdminData());

    return () => socket.disconnect();
  }, []);

  // Helper check for Online Status
  const isUserOnline = (user) => {
    if (!user) return false;
    const uId = String(user._id || user.id);
    return onlineUserIds.includes(uId);
  };

  const executeResetPassword = async () => {
    if (!newPasswordInput || newPasswordInput.trim().length < 4) {
      setLiveNotification('⚠️ Password must be at least 4 characters long.');
      setTimeout(() => setLiveNotification(null), 3000);
      return;
    }

    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/admin/users/${resetPassUser._id}/reset-password`,
        { newPassword: newPasswordInput.trim() },
        authHeader
      );
      setLiveNotification(`✅ ${res.data.message}`);
      setResetPassUser(null);
      setNewPasswordInput('');
      fetchAdminData();
    } catch (err) {
      setLiveNotification(`❌ ${err.response?.data?.message || 'Error updating password'}`);
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };

  const handleApproveStatus = async (userId, newStatus) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/users/${userId}/approve`,
        { approvalStatus: newStatus }, // Note: the backend expects approvalStatus, not status
        authHeader
      );
      setLiveNotification(`✅ User status updated to ${newStatus.toUpperCase()}`);
      fetchAdminData();

      if (selectedUser?._id === userId) {
        setSelectedUser(prev => ({ ...prev, approvalStatus: newStatus }));
      }
    } catch (err) {
      setLiveNotification('❌ Error updating approval status');
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };
const handleToggleBlock = async (userId, currentStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/status`, { isBlocked: !currentStatus }, authHeader);
      setLiveNotification(`✅ User ${currentStatus ? 'unblocked' : 'blocked'} successfully`);
      fetchAdminData();
    } catch (err) {
      setLiveNotification('❌ Error updating block status');
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };
  const executeDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${deleteConfirmUser._id}`, authHeader);
      setLiveNotification(`🗑️ Account for ${deleteConfirmUser.name} deleted.`);
      setSelectedUser(null);
      setDeleteConfirmUser(null);
      fetchAdminData();
    } catch (err) {
      setLiveNotification('❌ Error deleting account');
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };
const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/broadcast`, { audience: broadcastAudience, message: broadcastMessage }, authHeader);
      setLiveNotification(`📢 ${res.data.message}`);
      setBroadcastMessage('');
    } catch (err) {
      setLiveNotification(`❌ Error: ${err.response?.data?.message || 'Failed to send broadcast'}`);
    } finally {
      setTimeout(() => setLiveNotification(null), 4000);
    }
  };
  return (
    <div className="max-w-7xl mx-auto p-6 text-white relative space-y-6 font-sans">
      {/* ⚡ Real-Time Notification Toast */}
      {liveNotification && (
        <div className="fixed top-5 right-5 z-50 glass-card text-white font-bold px-5 py-3.5 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-md animate-bounce flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
          <span className="text-xs">{liveNotification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🚕 TaxiPay Admin Portal</h1>
          <p className="text-xs text-gray-400 mt-1">Manage user access, driver verification, and platform growth analytics</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Real-Time Socket Active ({onlineUserIds.length} Online)
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card/90 border border-white/10 rounded-3xl p-3 shadow-lg">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'analytics', label: '📊 Analytics & Metrics' },
            { id: 'kyc', label: '👥 User & Driver Management' },
            { id: 'tariff', label: '💰 Tariff & Finance' },
            { id: 'fleet', label: '📡 Fleet & Comms' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white border border-blue-400 shadow-md'
                  : 'glass-panel text-gray-300 border border-white/10 hover:glass-card hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400">
          Viewing: <span className="text-white font-bold capitalize">{activeTab}</span>
        </div>
      </div>

      {/* Active Tab Content */}
       {loading ? (
        <div className="glass-card border border-white/10 rounded-2xl p-8 text-center text-sm text-gray-400">Loading data...</div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: ANALYTICS & METRICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card/90 border border-white/10 p-5 rounded-2xl shadow-lg">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Accounts</p>
                  <p className="text-3xl font-black mt-2 text-white">{stats.totalUsers}</p>
                </div>
                <div className="glass-card/90 border border-white/10 p-5 rounded-2xl shadow-lg">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Minibus Drivers</p>
                  <p className="text-3xl font-black mt-2 text-blue-400">{stats.drivers}</p>
                </div>
                <div className="glass-card/90 border border-white/10 p-5 rounded-2xl shadow-lg">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Passengers</p>
                  <p className="text-3xl font-black mt-2 text-emerald-400">{stats.passengers}</p>
                </div>
                <div className="glass-card/90 border border-white/10 p-5 rounded-2xl shadow-lg">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-3xl font-black mt-2 text-amber-400">{stats.pendingApprovals}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card/90 border border-white/10 p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">7-Day Registration Activity</h2>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Drivers
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Passengers
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-56 w-full">
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
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="Drivers" stroke="#60A5FA" fillOpacity={1} fill="url(#driverGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Passengers" stroke="#34D399" fillOpacity={1} fill="url(#passengerGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card/90 border border-white/10 p-6 rounded-2xl shadow-xl flex flex-col">
                  <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4">Financial & Trip Reporting (Coming Soon)</h2>
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <span className="text-2xl">💸</span>
                    </div>
                    <p className="text-sm text-gray-300">Detailed Chapa payment reports, total network earnings, and user wallet balances will appear here.</p>
                  </div>
                </div>
              </div>

              {/* Trip Statistics (Using existing trips data) */}
              <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl mt-6">
                <div className="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white">Recent Trip Statistics</h3>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-mono">Live Sync</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="glass-panel text-gray-400 uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="p-4">Passenger</th>
                      <th className="p-4">Driver</th>
                      <th className="p-4">Route</th>
                      <th className="p-4">Fare</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Start</th>
                      <th className="p-4">End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {trips.map((trip) => (
                      <tr key={trip._id} className="hover:glass-panel/40 transition">
                        <td className="p-4 text-gray-300">{trip.passenger?.name || '—'}</td>
                        <td className="p-4 text-gray-300">{trip.driver?.name || '—'}</td>
                        <td className="p-4 text-gray-400">{trip.route?.name || `${trip.route?.origin || '—'} → ${trip.route?.destination || '—'}`}</td>
                        <td className="p-4 text-emerald-400 font-semibold">{trip.fare?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 capitalize text-gray-300">{trip.status}</td>
                        <td className="p-4 font-mono text-[11px] text-gray-500">{new Date(trip.startTime).toLocaleString()}</td>
                        <td className="p-4 font-mono text-[11px] text-gray-500">{trip.endTime ? new Date(trip.endTime).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                    {trips.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-gray-500 italic">No trips recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: KYC & USER MANAGEMENT */}
          {activeTab === 'kyc' && (
            <div className="space-y-6 animate-fade-in">
              {/* Controls Bar */}
              <div className="flex flex-wrap gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search by name, phone, plate #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="glass-card border border-white/10 p-3 rounded-xl text-sm flex-1 outline-none focus:border-blue-500 transition"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="glass-card border border-white/10 p-3 rounded-xl text-sm outline-none text-gray-300"
                >
                  <option value="">All Roles</option>
                  <option value="driver">Drivers</option>
                  <option value="passenger">Passengers</option>
                  <option value="admin">Admins</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="glass-card border border-white/10 p-3 rounded-xl text-sm outline-none text-gray-300"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">

              <table className="w-full text-left text-xs">
                <thead className="glass-panel text-gray-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Telegram ID</th>
                    <th className="p-4">Approval Status</th>
                    <th className="p-4">Blocked</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {users.map((u) => {
                    const online = isUserOnline(u);
                    return (
                      <tr key={u._id} className="hover:glass-panel/40 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                online ? 'bg-emerald-500 animate-ping' : 'bg-neutral-600'
                              }`}
                              title={online ? 'User is online' : 'Offline'}
                            />
                            <div className="font-bold text-sm text-white">{u.name}</div>
                            {online && (
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
                        <td className="p-4 capitalize font-semibold text-gray-300">{u.role}</td>
                        <td className="p-4 font-mono text-gray-400">{u.telegramChatId || 'Not Linked'}</td>
                        <td className="p-4 text-sm font-semibold text-gray-300">{u.approvalStatus || 'pending'}</td>
                        <td className="p-4 text-sm font-semibold text-gray-300">{u.isBlocked ? 'Yes' : 'No'}</td>
                        <td className="p-4 text-right space-x-2">
                          {u.approvalStatus !== 'approved' && (
                            <button
                              onClick={() => handleApproveStatus(u._id, 'approved')}
                              className="glass-button hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-white font-bold transition shadow"
                            >
                              Approve
                            </button>
                          )}
                          {u.approvalStatus !== 'rejected' && (
                            <button
                              onClick={() => handleApproveStatus(u._id, 'rejected')}
                              className="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-white font-bold transition"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleBlock(u._id, u.isBlocked)}
                            className={`${u.isBlocked ? 'bg-green-600 hover:bg-green-500' : 'bg-orange-700 hover:bg-orange-600'} px-3 py-1.5 rounded-lg text-white font-bold transition`}
                          >
                            {u.isBlocked ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            onClick={() => setResetPassUser(u)}
                            className="bg-amber-600/80 hover:bg-amber-600 px-3 py-1.5 rounded-lg text-white font-bold transition"
                          >
                            Reset Pass
                          </button>
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="glass-panel hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-gray-300 transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
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
            </div>
          )}

          {/* TAB 3: TARIFF & FINANCIAL CONTROL */}
          {activeTab === 'tariff' && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Configuration Section (Placeholder) */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card/90 border border-white/10 p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Dynamic Zone Configuration</h2>
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 uppercase">Premium</span>
                  </div>
                  <div className="bg-black/30 h-40 rounded-xl border border-white/5 flex items-center justify-center text-center p-6">
                    <p className="text-xs text-gray-400">Map-supported interface to define specific areas of operation or transit corridors will be rendered here.</p>
                  </div>
                </div>

                <div className="glass-card/90 border border-white/10 p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Payment Administration</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="glass-panel p-4 rounded-xl border border-white/5 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-300">Platform Commission</span>
                      <span className="text-emerald-400 font-mono text-sm">15%</span>
                    </div>
                    <div className="glass-panel p-4 rounded-xl border border-white/5 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-300">Payment Gateway</span>
                      <span className="text-blue-400 font-mono text-sm">Chapa (Active)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Route & Tariff Form */}
              <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
              <div className="glass-card border border-white/10 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-4">{editingRoute ? 'Edit Route' : 'Create Route'}</h3>
                <form onSubmit={submitRouteForm} className="space-y-4 text-xs">
                  {[
                    { label: 'Name', name: 'name', type: 'text' },
                    { label: 'Origin', name: 'origin', type: 'text' },
                    { label: 'Destination', name: 'destination', type: 'text' },
                    { label: 'Base Fare', name: 'baseFare', type: 'number' },
                    { label: 'Distance', name: 'distance', type: 'number' }
                  ].map((field) => (
                    <label key={field.name} className="block">
                      <span className="text-gray-400 text-[11px] mb-1 block">{field.label}</span>
                      <input
                        type={field.type}
                        value={routeForm[field.name]}
                        onChange={(e) => setRouteForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full glass-panel border border-white/10 rounded-2xl p-3 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </label>
                  ))}
                  <label className="flex items-center gap-3 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={routeForm.isActive}
                      onChange={(e) => setRouteForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-white/20 glass-card text-blue-500"
                    />
                    Mark route active
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 glass-button-primary hover:bg-blue-500 py-3 rounded-2xl text-white text-sm font-bold transition">
                      {editingRoute ? 'Update Route' : 'Create Route'}
                    </button>
                    {editingRoute && (
                      <button
                        type="button"
                        onClick={resetRouteForm}
                        className="px-5 glass-panel hover:bg-neutral-700 py-3 rounded-2xl text-sm text-gray-300 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
              <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="glass-panel text-gray-400 uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="p-4">Route</th>
                      <th className="p-4">Base Fare</th>
                      <th className="p-4">Distance</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {routes.map((route) => (
                      <tr key={route._id} className="hover:glass-panel/40 transition">
                        <td className="p-4 text-gray-300">{route.name} — {route.origin} → {route.destination}</td>
                        <td className="p-4 text-gray-300">{route.baseFare.toFixed(2)}</td>
                        <td className="p-4 text-gray-300">{route.distance}</td>
                        <td className="p-4 capitalize text-gray-300">{route.isActive ? 'active' : 'inactive'}</td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleEditRoute(route)}
                            className="glass-button-primary hover:bg-blue-500 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route._id)}
                            className="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
              
              {/* Transactions Table */}
              <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/10 bg-black/20">
                  <h3 className="text-sm font-bold text-white">Financial Transactions & Adjustments</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="glass-panel text-gray-400 uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="p-4">Reference</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Passenger</th>
                      <th className="p-4">Driver</th>
                      <th className="p-4">Route</th>
                      <th className="p-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {transactions.map((tx) => (
                      <tr key={tx._id} className="hover:glass-panel/40 transition">
                        <td className="p-4 font-mono text-gray-300">{tx.reference}</td>
                        <td className="p-4 font-semibold text-white">{tx.amount.toFixed(2)}</td>
                        <td className="p-4 capitalize text-gray-300">{tx.type}</td>
                        <td className="p-4 capitalize text-sm font-bold text-gray-200">{tx.status}</td>
                        <td className="p-4 text-gray-400">{tx.user?.name || tx.metadata?.passengerName || '—'}</td>
                        <td className="p-4 text-gray-400">{tx.metadata?.driverId || tx.metadata?.targaNo || '—'}</td>
                        <td className="p-4 text-gray-400">{tx.trip?.route?.name || tx.metadata?.route || '—'}</td>
                        <td className="p-4 font-mono text-[11px] text-gray-500">{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-gray-500 italic">No transactions found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FLEET MONITORING & COMMUNICATIONS */}
          {activeTab === 'fleet' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-[1.5fr_1fr] gap-6">
                
                {/* Live Fleet Tracking Map Placeholder */}
                <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[400px]">
                  <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live Fleet Tracking
                    </h3>
                    <span className="text-xs text-gray-400 font-mono">Map View</span>
                  </div>
                  <div className="flex-1 bg-neutral-900/50 relative overflow-hidden flex items-center justify-center">
                    <LiveFleetMap />
                  </div>
                </div>

                {/* Notification Management */}
                <div className="glass-card border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col">
                  <h3 className="text-sm font-bold text-white mb-4">Broadcast Notification</h3>
                  <form className="space-y-4 flex-1 flex flex-col" onSubmit={handleBroadcast}>
                    <div>
                      <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Target Audience</label>
                      <select 
                        className="w-full glass-panel border border-white/10 rounded-xl p-3 text-sm outline-none text-white"
                        value={broadcastAudience}
                        onChange={(e) => setBroadcastAudience(e.target.value)}
                      >
                        <option value="all">All Users</option>
                        <option value="drivers">Drivers Only</option>
                        <option value="passengers">Passengers Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 block">Message</label>
                      <textarea 
                        className="w-full glass-panel border border-white/10 rounded-xl p-3 text-sm outline-none text-white h-24 resize-none focus:border-blue-500" 
                        placeholder="Enter system alert, promo code, or broadcast message..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                      ></textarea>
                    </div>
                    <div className="mt-auto pt-4">
                      <button type="submit" className="w-full glass-button-primary hover:bg-blue-500 py-3 rounded-xl text-white font-bold transition">
                        Send Broadcast
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* System Security & Access Logs */}
              <div className="glass-card border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white">Security & Access Trails</h3>
                </div>
              <table className="w-full text-left text-xs">
                <thead className="glass-panel text-gray-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-4">Action</th>
                    <th className="p-4">Performed By</th>
                    <th className="p-4">Target</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:glass-panel/40 transition">
                      <td className="p-4 font-semibold text-white">{log.action}</td>
                      <td className="p-4 text-gray-300">{log.performedBy?.name || 'System'}</td>
                      <td className="p-4 text-gray-300">{log.targetUser?.name || '—'}</td>
                      <td className="p-4 text-gray-400">{log.details}</td>
                      <td className="p-4 font-mono text-[11px] text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      )}

      {/* User Info & Document Preview Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/20 rounded-3xl p-6 max-w-lg w-full text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">User Verification File</h3>
                {isUserOnline(selectedUser) && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    ONLINE NOW
                  </span>
                )}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold uppercase border ${
                selectedUser.approvalStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {selectedUser.approvalStatus || 'pending'}
              </span>
            </div>

            {selectedUser.driverData?.profileImage && (
              <div className="mb-4 rounded-3xl overflow-hidden border border-white/10 shadow-inner">
                <img
                  src={`https://taxipayeth.onrender.com${selectedUser.driverData.profileImage}`}
                  alt="Driver Profile"
                  className="w-full h-44 object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/400x200?text=Profile+Image+Not+Found';
                  }}
                />
              </div>
            )}

            <div className="space-y-2.5 text-xs font-mono glass-panel p-4 rounded-2xl border border-white/10 mb-4">
              <p><span className="text-gray-500">ID:</span> {selectedUser._id}</p>
              <p><span className="text-gray-500">Name:</span> {selectedUser.name}</p>
              <p><span className="text-gray-500">Phone:</span> {selectedUser.phone}</p>
              <p><span className="text-gray-500">Role:</span> <span className="capitalize font-bold text-white">{selectedUser.role}</span></p>
              <p><span className="text-gray-500">Telegram Chat ID:</span> {selectedUser.telegramChatId || 'N/A'}</p>
              {selectedUser.driverData && (
                <>
                  <p><span className="text-gray-500">Plate Number:</span> <span className="text-blue-400 font-bold">{selectedUser.driverData.targaNo || 'N/A'}</span></p>
                  <p><span className="text-gray-500">Driver Code:</span> {selectedUser.driverData.driverId || 'N/A'}</p>
                  <p><span className="text-gray-500">License No.:</span> {selectedUser.driverData.licenseNo || 'N/A'}</p>
                  <p><span className="text-gray-500">Birth Date:</span> {selectedUser.driverData.birthDate || 'N/A'}</p>
                  <p><span className="text-gray-500">Emergency Contact:</span> {selectedUser.driverData.emergencyContact || 'N/A'}</p>
                  <p><span className="text-gray-500">Address:</span> {selectedUser.driverData.address || 'N/A'}</p>
                </>
              )}
              <p><span className="text-gray-500">Registered:</span> {new Date(selectedUser.createdAt).toLocaleString()}</p>
            </div>

            {selectedUser.role === 'driver' && (
              <div className="mb-6">
                <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-3">Verification Documents</h4>
                {selectedUser.driverData?.documentUrl || selectedUser.driverData?.licenseImage ? (
                  <div className="relative group glass-panel border border-white/10 rounded-2xl overflow-hidden p-2">
                    <img
                      src={`https://taxipayeth.onrender.com${selectedUser.driverData.documentUrl || selectedUser.driverData.licenseImage}`}
                      alt="Driver Document"
                      className="w-full h-48 object-cover rounded-xl"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/400x200?text=Document+Image+Not+Found';
                      }}
                    />
                    <a
                      href={`https://taxipayeth.onrender.com${selectedUser.driverData.documentUrl || selectedUser.driverData.licenseImage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 bg-black/80 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-sm transition"
                    >
                      🔍 Open Full Size
                    </a>
                  </div>
                ) : (
                  <div className="glass-panel/60 border border-dashed border-white/10 rounded-2xl p-4 text-center text-xs text-gray-500">
                    No verification document uploaded yet.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {selectedUser.approvalStatus !== 'approved' && (
                <button
                  onClick={() => handleApproveStatus(selectedUser._id, 'approved')}
                  className="flex-1 glass-button hover:bg-emerald-500 py-2.5 rounded-xl font-bold transition text-xs"
                >
                  Approve Account
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
                className="px-5 glass-panel hover:bg-neutral-700 py-2.5 rounded-xl font-bold transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/20 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl">
            <h3 className="text-xl font-black mb-2">Reset User Password</h3>
            <p className="text-xs text-gray-400 mb-4">Set a new plain-text password for <span className="text-white font-bold">{resetPassUser.name}</span>.</p>
            <input
              type="text"
              placeholder="Enter new password (min 4 chars)"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full glass-panel border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-amber-500 mb-6 font-mono text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={executeResetPassword}
                className="flex-1 bg-amber-600 hover:bg-amber-500 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Save New Password
              </button>
              <button
                onClick={() => {
                  setResetPassUser(null);
                  setNewPasswordInput('');
                }}
                className="px-5 glass-panel hover:bg-neutral-700 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-white/20 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl">
            <h3 className="text-xl font-black text-red-400 mb-2">Delete Account</h3>
            <p className="text-xs text-gray-300 mb-6">Are you sure you want to permanently delete <span className="font-bold text-white">{deleteConfirmUser.name}</span> ({deleteConfirmUser.phone})? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={executeDeleteUser}
                className="flex-1 bg-red-600 hover:bg-red-500 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Confirm Permanent Delete
              </button>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-5 glass-panel hover:bg-neutral-700 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
