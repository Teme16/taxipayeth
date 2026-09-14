'use strict';

const express = require('express');
const router = express.Router();
const { getActiveTariffs } = require('../controllers/tariffController');
const { protect } = require('../middleware/auth');

router.get('/active', protect, getActiveTariffs);

module.exports = router;
