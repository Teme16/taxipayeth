function normalizeDriverId(driverId) {
  if (driverId === undefined || driverId === null) return '';
  return String(driverId).trim();
}

function getDriverRoomName(driverId) {
  return `driver_${normalizeDriverId(driverId)}`;
}

module.exports = { normalizeDriverId, getDriverRoomName };
