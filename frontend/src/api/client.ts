import axios from 'axios';
import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Track start time for performance logging
  (config as any).metadata = { startTime: new Date() };
  return config;
});

// Handle authentication errors and log responses
api.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any).metadata.startTime;
    const duration = new Date().getTime() - startTime.getTime();
    logger.info(response.config.method?.toUpperCase() + ' ' + response.config.url + ' ' + response.status + ' (' + duration + 'ms)', 'API');
    return response;
  },
  (error) => {
    const duration = error.config?.metadata ? new Date().getTime() - error.config.metadata.startTime.getTime() : 0;
    const status = error.response?.status || 'Error';
    const msg = error.config?.method?.toUpperCase() + ' ' + error.config?.url + ' ' + status + ' (' + duration + 'ms)';

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      
      const url = error.config?.url || '';
      const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register');
      const isAlreadyOnAuthPage = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register');

      if (!isAuthRequest && !isAlreadyOnAuthPage) {
        logger.warn(msg + ': Unauthorized, logging out', 'API');
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      } else {
        logger.warn(msg + ': Unauthorized request (auth page or auth endpoint), bypassing redirect', 'API');
      }
    } else {
      logger.error(msg, 'API', error);
    }
    return Promise.reject(error);
  }
);
