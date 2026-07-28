import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (failureCount >= 1 || error instanceof DOMException && error.name === 'AbortError') return false;
        return !(error instanceof ApiError) || error.status >= 500;
      },
      gcTime: 5 * 60 * 1000,
    },
    mutations: { retry: false },
  },
});
