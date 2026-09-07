'use strict';

const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Log action is required'],
      trim: true,
      maxlength: [150, 'Action cannot exceed 150 characters']
    },

    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'security'],
      default: 'info'
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    details: {
      type: String,
      trim: true,
      maxlength: [2000, 'Details cannot exceed 2000 characters'],
      default: ''
    },

    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map()
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: 64,
      default: ''
    },

    requestId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    }
  },
  {
    timestamps: true,
    strict: 'throw'
  }
);

// Optimize Query Indexes
SystemLogSchema.index({ createdAt: -1 });
SystemLogSchema.index({ performedBy: 1, createdAt: -1 });
SystemLogSchema.index({ level: 1, createdAt: -1 });
SystemLogSchema.index({ action: 1, createdAt: -1 });

// Automatic Purge Policy: Expire log records after 90 days
SystemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Static Helper for Standardized System Logging
SystemLogSchema.statics.logEvent = async function ({
  action,
  level = 'info',
  performedBy = null,
  targetUser = null,
  details = '',
  metadata = {},
  req = null
}) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    const requestId = req ? (req.headers['x-request-id'] || '') : '';

    return await this.create({
      action,
      level,
      performedBy,
      targetUser,
      details,
      metadata,
      ipAddress,
      requestId
    });
  } catch (err) {
    console.error('Failed to persist SystemLog:', err);
    return null;
  }
};

// Guard against OverwriteModelError during hot reloading or multiple calls
module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);