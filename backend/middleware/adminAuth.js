'use strict';

const {
  protect,
  authorize
} = require('./auth');

const adminAuth = [
  protect,
  authorize('admin')
];

module.exports = adminAuth;