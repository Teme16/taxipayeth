/**
 * Generates a consistent Socket.io room name for a driver based on their ID.
 * @param {string|Object} driverId - Mongoose ObjectId or string representation of driver ID.
 * @returns {string} Formatted room name string.
 */
const getDriverRoomName = (driverId) => {
  if (!driverId) return 'driver_unknown';
  const cleanId = typeof driverId === 'object' ? driverId.toString() : String(driverId);
  return `driver_${cleanId.trim()}`;
};

module.exports = {
  getDriverRoomName
};