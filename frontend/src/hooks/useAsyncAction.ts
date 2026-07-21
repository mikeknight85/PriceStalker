import { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

interface UseAsyncActionOptions {
  onSuccessMessage?: string;
  onErrorMessage?: string;
  onErrorFallback?: string;
  throwError?: boolean;
}

export function useAsyncAction(initialLoadingState = false) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(initialLoadingState);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T,>(
    action: () => Promise<T>,
    options?: UseAsyncActionOptions
  ): Promise<T | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await action();
      if (options?.onSuccessMessage) {
        showToast(options.onSuccessMessage, 'success');
      }
      return result;
    } catch (err: any) {
      const errorStr = err.response?.data?.error || err.message;
      const msg = options?.onErrorMessage 
        ? `${options.onErrorMessage}: ${errorStr}`
        : (options?.onErrorFallback || 'An error occurred');
      
      setError(msg);

      if (options?.onErrorMessage || options?.onErrorFallback) {
        showToast(msg, 'error');
      }

      if (options?.throwError) {
        throw err;
      }
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  return { execute, isLoading, setIsLoading, error, setError };
}
