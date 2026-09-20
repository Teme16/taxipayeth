'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Trip = require('../models/Trip');
const Transaction =
    require('../models/Transaction');

const createHttpError = (
    statusCode,
    message
) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const createTransactionId = () =>
    `TXN-${crypto.randomUUID()}`;

// Detect if MongoDB supports multi-document transactions (replica set / mongos)
const isReplicaSetOrMongos = () => {
    try {
        const topology = mongoose.connection.client.topology;
        // Check for replica set name or sharded cluster
        if (topology?.s?.description?.type) {
            const type = topology.s.description.type;
            return type === 'ReplicaSetWithPrimary' || type === 'Sharded';
        }
        return !!topology?.s?.replicaSet;
    } catch {
        return false;
    }
};

const checkout = async ({
    userId,
    driverId,
    amount,
    seats,
    password,
    idempotencyKey
}) => {
    if (!mongoose.isValidObjectId(driverId)) {
        throw createHttpError(400, 'Invalid driver identifier.');
    }

    const useTransactions = isReplicaSetOrMongos();

    // Core checkout logic — receives an optional session
    const runCheckout = async (session) => {
        const sessionOpt = session ? { session } : {};

        const existing = await Transaction.findOne({ idempotencyKey }, null, sessionOpt);
        if (existing) {
            return { transaction: existing, alreadyProcessed: true };
        }

        const user = await User.findById(userId).select('+password +balance').setOptions(sessionOpt);
        if (!user) {
            throw createHttpError(404, 'User account not found.');
        }

        if (!(await user.matchPassword(password))) {
            throw createHttpError(401, 'Invalid payment password.');
        }

        const numAmount = Number(amount);
        if (user.balance < numAmount) {
            throw createHttpError(409, 'Insufficient wallet balance.');
        }

        const uniqueSeats = [...new Set(seats.map(Number))];
        if (uniqueSeats.length === 0 || uniqueSeats.some((s) => !Number.isInteger(s))) {
            throw createHttpError(422, 'Invalid seat selection.');
        }

        const driverUser = await User.findById(driverId).setOptions(sessionOpt);
        if (!driverUser) {
            throw createHttpError(404, 'Driver not found.');
        }

        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            throw createHttpError(400, 'Invalid payment amount.');
        }

        const adminFee = 0.5;
        if (numericAmount <= adminFee) {
            throw createHttpError(400, `Payment amount must be greater than ${adminFee} birr.`);
        }
        const driverAmount = numericAmount - adminFee;

        // Atomically decrement passenger balance
        const userUpdate = await User.findOneAndUpdate(
            { _id: user._id, balance: { $gte: numericAmount } },
            { $inc: { balance: -numericAmount } },
            { returnDocument: 'after', ...sessionOpt }
        );

        if (!userUpdate) {
            throw createHttpError(409, 'Balance deduction failed due to concurrent update.');
        }

        // Credit the driver
        const driverUpdate = await User.findOneAndUpdate(
            { _id: driverUser._id },
            { $inc: { balance: driverAmount } },
            { returnDocument: 'after', ...sessionOpt }
        );

        // Credit the driver's profile totalEarnings
        const Driver = require('../models/Driver');
        await Driver.findOneAndUpdate(
            { user: driverUser._id },
            { $inc: { totalEarnings: driverAmount } },
            sessionOpt
        );

        console.log(`💰 Driver ${driverUser._id} balance updated: ${driverUpdate?.balance}`);

        // Credit the admin
        await User.findOneAndUpdate(
            { role: 'admin' },
            { $inc: { balance: adminFee } },
            { sort: { createdAt: 1 }, ...sessionOpt }
        );

        // Create transaction record
        const txArgs = [
            {
                user: user._id,
                driver: driverUser._id,
                amount: numericAmount,
                type: 'payment',
                status: 'completed',
                transactionId: createTransactionId(),
                idempotencyKey,
                passengerSnapshot: {
                    name: user.name,
                    phone: user.phone
                },
                seats: uniqueSeats
            }
        ];

        const transaction = session
            ? await Transaction.create(txArgs, { session })
            : await Transaction.create(txArgs);

        return {
            transaction: Array.isArray(transaction) ? transaction[0] : transaction,
            alreadyProcessed: false
        };
    };

    // === Replica Set / Mongos: full ACID transaction ===
    if (useTransactions) {
        const session = await mongoose.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                result = await runCheckout(session);
            });
            return result;
        } finally {
            await session.endSession();
        }
    }

    // === Standalone dev: no session, atomic per-operation ===
    return runCheckout(null);
};

module.exports = { checkout };