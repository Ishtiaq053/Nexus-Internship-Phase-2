/**
 * Small API client module that wraps fetch calls to the backend.
 * Uses the base URL from environment variable VITE_API_URL or defaults to http://localhost:5000.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Generic fetch wrapper with error handling and JSON parsing.
 */
async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Append URL query params if provided
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // If body is an object and not already a string, stringify it
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    // Try to parse JSON response
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = (typeof data === 'object' && data?.message) || response.statusText || 'API Request Failed';
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Handle network errors (e.g. backend offline)
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred while connecting to backend.',
      0
    );
  }
}

export const api = {
  get: <T>(endpoint: string, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Health check test call to verify frontend-backend connection.
 */
export async function checkBackendHealth(): Promise<{ status: string }> {
  return api.get<{ status: string }>('/api/health');
}
