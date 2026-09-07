'use strict';

const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: true,
      min: [1, 'Seat number must be at least 1'],
      max: [100, 'Seat number cannot exceed 100']
    },

    status: {
      type: String,
      enum: ['available', 'reserved', 'paid'],
      default: 'available',
      index: true
    },

    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    reservationExpiresAt: {
      type: Date,
      default: null
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    }
  },
  {
    _id: false,
    strict: 'throw'
  }
);

const TripSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver is required'],
      index: true
    },

    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: [true, 'Route is required'],
      index: true
    },

    fare: {
      type: Number,
      required: [true, 'Trip fare is required'],
      min: [0, 'Fare cannot be negative'],
      validate: {
        validator(value) {
          return Number.isFinite(value) && value <= 1000000;
        },
        message: 'Fare must be a valid amount.'
      }
    },

    currency: {
      type: String,
      enum: ['ETB'],
      default: 'ETB',
      immutable: true
    },

    seats: {
      type: [seatSchema],
      default: []
    },

    totalSeats: {
      type: Number,
      required: [true, 'Total seat count is required'],
      min: [1, 'At least one seat is required'],
      max: [100, 'Total seat count cannot exceed 100']
    },

    status: {
      type: String,
      enum: ['requested', 'ongoing', 'completed', 'cancelled'],
      default: 'requested',
      index: true
    },

    startTime: {
      type: Date,
      default: Date.now,
      index: true
    },

    endTime: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    strict: 'throw'
  }
);

TripSchema.pre('validate', async function validateTripSeats() {
  if (!Array.isArray(this.seats)) {
    throw new Error('Seats must be an array.');
  }

  const seatNumbers = this.seats.map((seat) => seat.number);
  const uniqueSeatNumbers = new Set(seatNumbers);

  if (seatNumbers.length !== uniqueSeatNumbers.size) {
    throw new Error('Trip contains duplicate seat numbers.');
  }

  if (
    this.seats.length > 0 &&
    this.seats.length !== this.totalSeats
  ) {
    throw new Error(
      'The number of seat definitions must match totalSeats.'
    );
  }

  for (const seat of this.seats) {
    if (seat.status === 'available') {
      seat.passenger = null;
      seat.reservationExpiresAt = null;
      seat.transaction = null;
    }

    if (
      seat.status === 'reserved' &&
      !seat.reservationExpiresAt
    ) {
      throw new Error(
        `Reserved seat ${seat.number} must have a reservation expiration time.`
      );
    }

    if (
      seat.status === 'paid' &&
      (!seat.passenger || !seat.transaction)
    ) {
      throw new Error(
        `Paid seat ${seat.number} must have a passenger and transaction.`
      );
    }
  }
});

TripSchema.index({
  driver: 1,
  status: 1,
  startTime: -1
});

TripSchema.index({
  route: 1,
  status: 1
});

TripSchema.index({
  passenger: 1,
  createdAt: -1
});

TripSchema.index({
  status: 1,
  startTime: -1
});

module.exports = mongoose.model('Trip', TripSchema);