import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production (e.g. static host or served by backend), fall back to origin/relative path
  if (import.meta.env.PROD) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleAuthFailure = () => {
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('auth:logout'));
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/auth' &&
    window.location.pathname !== '/'
  ) {
    window.location.href = '/auth';
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network or connection error without a server response
    if (!error || !error.response) {
      return Promise.reject(error);
    }

    // Skip token refresh for auth endpoints where 401 is expected (e.g., wrong password)
    if (
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/signup') ||
      originalRequest?.url?.includes('/api/auth/google') ||
      originalRequest?.url?.includes('/api/auth/refresh')
    ) {
      if (
        originalRequest?.url?.includes('/api/auth/refresh') &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        handleAuthFailure();
      }
      return Promise.reject(error);
    }

    if (error.response.status === 401) {
      if (originalRequest._retry) {
        // Retried request failed with 401 again -> clear session & redirect
        handleAuthFailure();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch((err) => {
            handleAuthFailure();
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const { token } = res.data;
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
        originalRequest.headers['Authorization'] = 'Bearer ' + token;

        processQueue(null, token);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        handleAuthFailure();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response.status === 403) {
      handleAuthFailure();
    }

    return Promise.reject(error);
  },
);

export default api;
