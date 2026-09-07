'use strict';

const rateLimit =
    require('express-rate-limit');

const createLimiter = ({
    windowMs,
    limit,
    message
}) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,

        handler(req, res) {
            return res.status(429).json({
                success: false,
                message,
                requestId: req.requestId
            });
        }
    });

const generalLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message:
        'Too many requests. Please try again later.'
});

const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message:
        'Too many authentication attempts. Please try again later.'
});

const verificationLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    message:
        'Too many verification requests. Please wait before trying again.'
});

const paymentLimiter = createLimiter({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    message:
        'Too many payment requests. Please try again later.'
});

const pollingLimiter = createLimiter({
    windowMs: 1 * 60 * 1000,
    limit: 60,
    message:
        'Too many requests. Please slow down.'
});

module.exports = {
    generalLimiter,
    authLimiter,
    verificationLimiter,
    paymentLimiter,
    pollingLimiter
};