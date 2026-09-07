'use strict';

const config = require('../config/env');

const errorHandler = (
    err,
    req,
    res,
    next
) => {
    console.error({
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        error: err.stack || err.message
    });

    if (
        err.name === 'ValidationError'
    ) {
        return res.status(422).json({
            success: false,
            message: 'Database validation failed.',
            errors: Object.values(
                err.errors
            ).map((error) => ({
                field: error.path,
                message: error.message
            })),
            requestId: req.requestId
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid resource identifier.',
            requestId: req.requestId
        });
    }

    if (err.code === 11000) {
        const fields = Object.keys(
            err.keyPattern || {}
        );

        return res.status(409).json({
            success: false,
            message: 'A duplicate resource already exists.',
            fields,
            requestId: req.requestId
        });
    }

    if (
        err.name === 'JsonWebTokenError' ||
        err.name === 'TokenExpiredError'
    ) {
        return res.status(401).json({
            success: false,
            message: 'Authentication token is invalid or expired.',
            requestId: req.requestId
        });
    }

    const statusCode =
        Number.isInteger(err.statusCode)
            ? err.statusCode
            : 500;

    const message =
        config.NODE_ENV === 'production' &&
            statusCode >= 500
            ? 'Internal server error.'
            : err.message ||
            'Internal server error.';

    return res.status(statusCode).json({
        success: false,
        message,
        requestId: req.requestId
    });
};

module.exports = errorHandler;