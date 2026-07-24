const bcrypt = require('bcryptjs');

function createFallbackStore() {
  const state = {
    users: [],
    drivers: [],
    transactions: [],
    tariffs: [
      { fromLocation: 'Addis Ababa', toLocation: 'Bole', price: 25, estimatedDurationMins: 20 },
      { fromLocation: 'Addis Ababa', toLocation: 'Piassa', price: 20, estimatedDurationMins: 15 },
      { fromLocation: 'Addis Ababa', toLocation: 'Merkato', price: 18, estimatedDurationMins: 18 }
    ]
  };

  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    async registerUser({ name, phone, password, role, driverData = {} }) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: generateId('user'),
        name,
        phone,
        password: hashedPassword,
        role,
        driverData,
        createdAt: new Date().toISOString()
      };
      state.users.push(user);
      return user;
    },

    findUserByPhone(phone) {
      return state.users.find((entry) => entry.phone === phone);
    },

    async validateUser(phone, password) {
      const user = state.users.find((entry) => entry.phone === phone);
      if (!user) return null;

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return null;

      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        driverData: user.driverData
      };
    },

    async createDriver(payload) {
      const driver = {
        id: generateId('driver'),
        ...payload,
        createdAt: new Date().toISOString()
      };
      state.drivers.push(driver);
      return driver;
    },

    getDriverById(driverId) {
      return state.drivers.find((driver) => driver.id === driverId || driver._id === driverId);
    },

    async createTransaction(payload) {
      const transaction = {
        transactionId: payload.transactionId || generateId('txn'),
        driverId: payload.driverId,
        passengerPhone: payload.passengerPhone,
        amountPaid: payload.amountPaid,
        seatsBooked: payload.seatsBooked || 1,
        paymentStatus: payload.paymentStatus || 'SUCCESS',
        createdAt: new Date().toISOString()
      };
      state.transactions.push(transaction);
      return transaction;
    },

    getTransaction(transactionId) {
      return state.transactions.find((transaction) => transaction.transactionId === transactionId);
    },

    getTariffs() {
      return state.tariffs;
    },

    searchTariffs(from, to) {
      return state.tariffs.filter((tariff) => {
        const fromMatch = !from || tariff.fromLocation.toLowerCase().includes(from.toLowerCase());
        const toMatch = !to || tariff.toLocation.toLowerCase().includes(to.toLowerCase());
        return fromMatch && toMatch;
      });
    }
  };
}

const fallbackStore = createFallbackStore();

module.exports = {
  createFallbackStore,
  getFallbackStore: () => fallbackStore
};
