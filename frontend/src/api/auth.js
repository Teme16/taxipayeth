import api from './client';

export const register = (data) =>
    api.post(
        '/auth/register',
        data
    );

export const login = (data) =>
    api.post(
        '/auth/login',
        data
    );

export const getMe = () =>
    api.get('/auth/me');

export const logout = () =>
    api.post('/auth/logout');

export const requestVerification = (
    phone
) =>
    api.post(
        '/auth/request-telegram-verification',
        { phone }
    );

export const checkVerification = (
    phone,
    code
) =>
    api.post(
        '/auth/check-telegram-verification',
        {
            phone,
            code
        }
    );