'use strict';

const mongoose = require('mongoose');

const {
  normalizePhone,
  normalizePlateNumber,
  normalizeSeatNumbers
} = require('../utils/modelHelpers');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Passenger is required'],
      index: true
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver is required'],
      index: true
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: false,
      index: true
    },

    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0, 'Amount cannot be negative'],
      validate: {
        validator(value) {
          return Number.isFinite(value) && value <= 1000000;
        },
        message: 'Amount must be valid.'
      }
    },

    currency: {
      type: String,
      enum: ['ETB'],
      default: 'ETB',
      immutable: true
    },

    type: {
      type: String,
      enum: ['payment', 'refund', 'payout', 'deposit'],
      default: 'payment',
      index: true
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },

    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
      trim: true,
      immutable: true,
      maxlength: [100, 'Transaction ID is too long']
    },

    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      trim: true,
      immutable: true,
      maxlength: [200, 'Idempotency key is too long']
    },

    targaNo: {
      type: String,
      trim: true,
      set: normalizePlateNumber,
      default: ''
    },

    passengerSnapshot: {
      name: {
        type: String,
        required: [true, 'Passenger name snapshot is required'],
        trim: true,
        maxlength: 100
      },

      phone: {
        type: String,
        required: [true, 'Passenger phone snapshot is required'],
        set: normalizePhone
      }
    },

    seats: {
      type: [Number],
      required: [true, 'At least one seat is required'],
      set: normalizeSeatNumbers,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one valid seat is required.'
      }
    },

    completedAt: {
      type: Date,
      default: null,
      index: true
    },

    failedAt: {
      type: Date,
      default: null
    },

    refundedAt: {
      type: Date,
      default: null
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    strict: 'throw'
  }
);

transactionSchema.pre(
  'validate',
  async function validateTransaction() {
    const uniqueSeats = new Set(this.seats || []);

    if (uniqueSeats.size !== (this.seats || []).length) {
      throw new Error(
        'Transaction contains duplicate seat numbers.'
      );
    }

    if (
      this.status === 'completed' &&
      !this.completedAt
    ) {
      this.completedAt = new Date();
    }

    if (
      this.status === 'failed' &&
      !this.failedAt
    ) {
      this.failedAt = new Date();
    }

    if (
      this.status === 'refunded' &&
      !this.refundedAt
    ) {
      this.refundedAt = new Date();
    }
  }
);

transactionSchema.index({
  driver: 1,
  createdAt: -1
});

transactionSchema.index({
  user: 1,
  createdAt: -1
});

transactionSchema.index({
  trip: 1,
  status: 1,
  createdAt: -1
});

transactionSchema.index({
  status: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  'Transaction',
  transactionSchema
);