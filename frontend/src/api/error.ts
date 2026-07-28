export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly method: string,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (isApiError(error)) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}
