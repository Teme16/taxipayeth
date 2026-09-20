'use strict';

const express = require('express');
const { getActiveRoutes } = require('../controllers/routeController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getActiveRoutes);

module.exports = router;
