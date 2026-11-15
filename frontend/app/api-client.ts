export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Petal API request failed with status ${status}.`);
    this.name = 'ApiError';
  }
}

export async function requestApiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session has expired. Sign in again to continue.';
  }
  return fallback;
}
