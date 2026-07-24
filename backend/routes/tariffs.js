const express = require('express');
const router = express.Router();
const Tariff = require('../models/Tariff');
const { getFallbackStore } = require('../utils/fallbackStore');

const fallbackStore = getFallbackStore();

const isMongoUnavailableError = (error) => {
    return !error || error.name === 'ValidationError' || error.name === 'MongooseServerSelectionError' || error.name === 'MongoServerSelectionError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('Topology') || error.message?.includes('connect ECONNREFUSED') || error.message?.includes('Cast to ObjectId');
};

// 1. GET ALL AVAILABLE TARIFFS
router.get('/', async (req, res) => {
    try {
        const tariffs = await Tariff.find();
        return res.status(200).json({ success: true, count: tariffs.length, data: tariffs });
    } catch (error) {
        if (isMongoUnavailableError(error)) {
            const tariffs = fallbackStore.getTariffs();
            return res.status(200).json({ success: true, count: tariffs.length, data: tariffs });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. SEARCH TARIFFS BY FROM/TO PARAMETERS
router.get('/search', async (req, res) => {
    const { from, to } = req.query;
    try {
        let query = {};
        if (from) query.fromLocation = new RegExp(from, 'i'); // Case-insensitive matching
        if (to) query.toLocation = new RegExp(to, 'i');

        const routesFound = await Tariff.find(query);
        return res.status(200).json({ success: true, data: routesFound });
    } catch (error) {
        if (isMongoUnavailableError(error)) {
            const routesFound = fallbackStore.searchTariffs(from, to);
            return res.status(200).json({ success: true, data: routesFound });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;