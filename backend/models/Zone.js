'use strict';

const mongoose = require('mongoose');

const ZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      trim: true,
      unique: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    area: {
      type: {
        type: String,
        enum: ['Polygon'],
        required: true
      },
      coordinates: {
        type: [[[Number]]], // Array of arrays of arrays of numbers: [ [ [lng, lat], ... ] ]
        required: true
      }
    }
  },
  {
    timestamps: true
  }
);

ZoneSchema.index({ area: '2dsphere' });

module.exports = mongoose.model('Zone', ZoneSchema);
