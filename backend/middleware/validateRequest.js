'use strict';

const {
    validationResult
} = require('express-validator');

const validateRequest = (
    req,
    res,
    next
) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Validation Errors:", errors.array());
    }

    if (errors.isEmpty()) {
        return next();
    }

    return res.status(422).json({
        success: false,
        message: 'Request validation failed.',
        errors: errors.array().map((error) => ({
            field:
                error.path ||
                error.param ||
                'request',
            message: error.msg
        })),
        requestId: req.requestId
    });
};

module.exports = validateRequest;