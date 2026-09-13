'use strict';

const path = require('path');

/*
 * Load .env from the backend root directory.
 *
 * dotenv.config() is idempotent — calling it
 * multiple times is safe.
 */
require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env')
});

const parseCommaSeparatedList = (value) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const config = Object.freeze({
  /* ---- Core ---- */
  NODE_ENV:
    process.env.NODE_ENV || 'development',

  PORT:
    Number(process.env.PORT) || 10000,

  /* ---- MongoDB ---- */
  MONGO_URI:
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/taxipay',

  MONGO_MAX_POOL_SIZE:
    Number(process.env.MONGO_MAX_POOL_SIZE) || 20,

  MONGO_MIN_POOL_SIZE:
    Number(process.env.MONGO_MIN_POOL_SIZE) || 2,

  /* ---- JWT ---- */
  JWT_SECRET:
    process.env.JWT_SECRET || '',

  JWT_EXPIRES_IN:
    process.env.JWT_EXPIRES_IN || '1d',

  /* ---- Session ---- */
  SESSION_SECRET:
    process.env.SESSION_SECRET || '',

  SESSION_COOKIE_NAME:
    process.env.SESSION_COOKIE_NAME ||
    'taxipay.sid',

  SESSION_TTL_MS:
    Number(process.env.SESSION_TTL_MS) ||
    604800000,

  /* ---- CORS ---- */
  CLIENT_ORIGINS:
    parseCommaSeparatedList(
      process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN
    ),

  /* ---- Request Limits ---- */
  REQUEST_BODY_LIMIT:
    process.env.REQUEST_BODY_LIMIT || '1mb',

  /* ---- Telegram ---- */
  TELEGRAM_BOT_TOKEN:
    process.env.TELEGRAM_BOT_TOKEN || '',

  TELEGRAM_BOT_USERNAME:
    process.env.TELEGRAM_BOT_USERNAME || '',

  TELEGRAM_WEBHOOK_URL:
    process.env.TELEGRAM_WEBHOOK_URL || ''
});

module.exports = config;
