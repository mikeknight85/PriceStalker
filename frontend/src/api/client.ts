import { logger } from '../utils/logger';
import { queryClient } from './queryClient';
import { ApiError } from './error';

export { ApiError, isApiError } from './error';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type QueryParams = Record<string, string | number | boolean | null | undefined>;
export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  params?: QueryParams;
  signal?: AbortSignal;
}

function requestUrl(path: string, params?: QueryParams): string {
  const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : `${window.location.origin}${API_BASE_URL}`;
  const url = new URL(`${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return API_BASE_URL.startsWith('http') ? url.toString() : url.pathname + url.search;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const candidate = body as { error?: unknown; message?: unknown };
    if (typeof candidate.error === 'string') return candidate.error;
    if (typeof candidate.message === 'string') return candidate.message;
  }
  return `Request failed (${status})`;
}

function isAuthRequest(path: string): boolean {
  return path.includes('/auth/login') || path.includes('/auth/register');
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...init } = options;
  const url = requestUrl(path, params);
  const started = performance.now();
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    ...init,
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const duration = Math.round(performance.now() - started);
  const responseBody = await parseBody(response);
  const message = `${method} ${url} ${response.status} (${duration}ms)`;

  if (!response.ok) {
    const error = new ApiError(errorMessage(responseBody, response.status), response.status, responseBody, method, url);
    if (response.status === 401 && !isAuthRequest(path)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      queryClient.clear();
      const onAuthPage = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register');
      if (!onAuthPage) {
        logger.warn(`${message}: Unauthorized, logging out`, 'API');
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    } else {
      logger.error(message, 'API', error);
    }
    throw error;
  }

  logger.info(message, 'API');
  return responseBody as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: RequestOptions & { data?: unknown }) => {
    const { data, ...requestOptions } = options ?? {};
    return request<T>('DELETE', path, data, requestOptions);
  },
};
