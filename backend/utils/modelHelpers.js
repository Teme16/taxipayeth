'use strict';

const ETHIOPIA_COUNTRY_CODE = '251';

const normalizeWhitespace = (value) =>
    String(value || '')
        .trim()
        .replace(/\s+/g, ' ');

const normalizePhone = (value) => {
    if (value === undefined || value === null || value === '') {
        return '';
    }

    let digits = String(value).replace(/\D/g, '');

    if (digits.startsWith('0')) {
        digits = `${ETHIOPIA_COUNTRY_CODE}${digits.slice(1)}`;
    } else if (
        digits.startsWith(ETHIOPIA_COUNTRY_CODE) &&
        digits.length === 12
    ) {
        // Already normalized.
    } else if (digits.length === 9 && digits.startsWith('9')) {
        digits = `${ETHIOPIA_COUNTRY_CODE}${digits}`;
    }

    if (!/^2519\d{8}$/.test(digits)) {
        throw new Error(
            'Phone number must be a valid Ethiopian mobile number.'
        );
    }

    return `+${digits}`;
};

const normalizePlateNumber = (value) => {
    if (!value) {
        return '';
    }

    return String(value)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
};

const normalizeSeatNumbers = (seats) => {
    if (!Array.isArray(seats)) {
        return [];
    }

    return [
        ...new Set(
            seats
                .map((seat) => Number(seat))
                .filter(
                    (seat) =>
                        Number.isInteger(seat) &&
                        seat > 0 &&
                        seat <= 100
                )
        )
    ].sort((a, b) => a - b);
};

module.exports = {
    normalizeWhitespace,
    normalizePhone,
    normalizePlateNumber,
    normalizeSeatNumbers
};