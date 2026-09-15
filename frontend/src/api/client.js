import axios from 'axios';

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_BASE_URL ||
        'https://taxipayeth.onrender.com/api',

    timeout: 15000,

    headers: {
        'Content-Type':
            'application/json'
    }
});

api.interceptors.request.use(
    (config) => {
        const token =
            localStorage.getItem(
                'taxipay_token'
            );

        if (token) {
            config.headers.Authorization =
                `Bearer ${token}`;
        }

        return config;
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        let message =
            error.response?.data?.message ||
            error.message ||
            'Network request failed.';

        if (error.response?.status === 422 && error.response?.data?.errors) {
            const validationErrors = error.response.data.errors
                .map((err) => err.message)
                .join(' ');
            message = `${message} ${validationErrors}`;
        }

        return Promise.reject(
            new Error(message)
        );
    }
);

export default api;
