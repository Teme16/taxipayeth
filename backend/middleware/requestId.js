'use strict';

const crypto = require('crypto');

const requestId = (req, res, next) => {
    const id =
        req.headers['x-request-id'] ||
        crypto.randomUUID();

    req.requestId = String(id);

    res.setHeader(
        'X-Request-ID',
        req.requestId
    );

    next();
};

module.exports = requestId;