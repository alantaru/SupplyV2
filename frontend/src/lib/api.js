import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL === '/api' || !import.meta.env.VITE_API_URL) 
        ? (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api')
        : import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Inject active contract_id (but skip for /admin routes to avoid 400s)
    const activeContract = localStorage.getItem('active_contract');
    if (activeContract && !config.url.startsWith('/admin')) {
        config.params = config.params || {};
        if (!config.params.contract_id) {
            config.params.contract_id = activeContract;
        }
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Optional: Clear token
            localStorage.removeItem('token');
            // Redirect to login if not already there
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
