import api from './client';

const createIdempotencyKey = () =>
    crypto.randomUUID();

export const checkout = ({
    tripId,
    seats,
    password
}) =>
    api.post(
        '/payments/checkout',
        {
            tripId,
            seats,
            password
        },
        {
            headers: {
                'Idempotency-Key':
                    createIdempotencyKey()
            }
        }
    );