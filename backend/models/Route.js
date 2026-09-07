'use strict';

const mongoose = require('mongoose');

const { normalizeWhitespace } = require('../utils/modelHelpers');

const RouteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true,
      minlength: [3, 'Route name must contain at least 3 characters'],
      maxlength: [150, 'Route name cannot exceed 150 characters'],
      set: normalizeWhitespace
    },

    origin: {
      type: String,
      required: [true, 'Route origin is required'],
      trim: true,
      minlength: [2, 'Route origin is too short'],
      maxlength: [100, 'Route origin cannot exceed 100 characters'],
      set: normalizeWhitespace
    },

    destination: {
      type: String,
      required: [true, 'Route destination is required'],
      trim: true,
      minlength: [2, 'Route destination is too short'],
      maxlength: [100, 'Route destination cannot exceed 100 characters'],
      set: normalizeWhitespace
    },

    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
      min: [0, 'Base fare cannot be negative'],
      validate: {
        validator(value) {
          return Number.isFinite(value) && value <= 1000000;
        },
        message: 'Base fare must be a valid amount.'
      }
    },

    distance: {
      type: Number,
      required: [true, 'Distance is required'],
      min: [0, 'Distance cannot be negative'],
      validate: {
        validator(value) {
          return Number.isFinite(value) && value <= 100000;
        },
        message: 'Distance must be valid.'
      }
    },

    currency: {
      type: String,
      enum: ['ETB'],
      default: 'ETB',
      immutable: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    strict: 'throw'
  }
);

RouteSchema.index(
  {
    origin: 1,
    destination: 1
  },
  {
    unique: true
  }
);

RouteSchema.index({
  isActive: 1,
  name: 1
});

module.exports = mongoose.model('Route', RouteSchema);