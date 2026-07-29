const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDriverId, getDriverRoomName } = require('../utils/driverRooms');

test('normalizes driver IDs before building a socket room name', () => {
  assert.equal(normalizeDriverId('  DRV-123  '), 'DRV-123');
  assert.equal(normalizeDriverId(42), '42');
  assert.equal(normalizeDriverId(''), '');
  assert.equal(getDriverRoomName(' DRV-123 '), 'driver_DRV-123');
});
