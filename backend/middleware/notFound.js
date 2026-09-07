'use strict';

const notFound = (
    req,
    res,
    next
) => {
    res.status(404).json({
        success: false,
        message: 'Requested resource was not found.',
        requestId: req.requestId
    });
};

module.exports = notFound;