'use strict';

const mongoose = require('mongoose');

const {
  normalizePhone,
  normalizePlateNumber,
  normalizeWhitespace
} = require('../utils/modelHelpers');

const driverDocumentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
      default: ''
    },

    uploadedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false,
    strict: true
  }
);

const DriverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver user is required'],
      unique: true,
      index: true
    },

    driverId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: ''
    },

    targaNo: {
      type: String,
      required: [true, 'Vehicle plate number is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      set: normalizePlateNumber,
      minlength: [3, 'Vehicle plate number is too short'],
      maxlength: [50, 'Vehicle plate number is too long']
    },

    mobileNumber: {
      type: String,
      default: '',
      set(value) {
        if (!value) {
          return '';
        }

        return normalizePhone(value);
      }
    },

    birthDate: {
      type: Date,
      default: null
    },

    licenseNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [100, 'License number cannot exceed 100 characters'],
      default: ''
    },

    emergencyContact: {
      type: String,
      default: '',
      set(value) {
        if (!value) {
          return '';
        }

        return normalizePhone(value);
      }
    },

    address: {
      type: String,
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters'],
      set: normalizeWhitespace,
      default: ''
    },

    profilePic: {
      type: String,
      trim: true,
      default: ''
    },

    digitalIdDocument: {
      type: driverDocumentSchema,
      default: () => ({})
    },

    isProfileCompleted: {
      type: Boolean,
      default: false,
      index: true
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: [0, 'Total earnings cannot be negative']
    },

    lastTripResetAt: {
      type: Date,
      default: Date.now
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

DriverSchema.index({
  isActive: 1,
  isProfileCompleted: 1
});

DriverSchema.index({
  createdAt: -1
});

module.exports = mongoose.model('Driver', DriverSchema);