const test = require('node:test');
const assert = require('node:assert/strict');
const { createFallbackStore } = require('../utils/fallbackStore');

test('register and validate users in the fallback store', async () => {
  const store = createFallbackStore();

  const user = await store.registerUser({
    name: 'Alice',
    phone: '0912345678',
    password: 'secret123',
    role: 'passenger'
  });

  assert.equal(user.phone, '0912345678');
  assert.equal(user.role, 'passenger');

  const validated = await store.validateUser('0912345678', 'secret123');
  assert.ok(validated);
  assert.equal(validated.name, 'Alice');
});

test('stores transactions for later lookup', async () => {
  const store = createFallbackStore();

  const transaction = await store.createTransaction({
    driverId: 'driver-1',
    passengerPhone: '0911111111',
    amountPaid: 30,
    seatsBooked: 3,
    paymentStatus: 'SUCCESS'
  });

  assert.equal(transaction.amountPaid, 30);
  assert.equal(transaction.seatsBooked, 3);

  const found = store.getTransaction(transaction.transactionId);
  assert.ok(found);
  assert.equal(found.driverId, 'driver-1');
});
