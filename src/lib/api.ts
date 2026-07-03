/**
 * API client module – wraps fetch calls to the backend.
 * Bearer token is injected via the `withAuth` helper and stored in memory (not localStorage).
 * Base URL is read from VITE_API_URL at build time.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── In-memory token store ────────────────────────────────────────────────────
// The token lives only in JS heap – invisible to XSS scripts targeting localStorage.
let _token: string | null = null;

export const tokenStore = {
  set: (t: string | null) => { _token = t; },
  get: () => _token,
  clear: () => { _token = null; },
};

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const authHeaders: Record<string, string> = {};
  if (_token) {
    authHeaders['Authorization'] = `Bearer ${_token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const msg = (typeof data === 'object' && data?.message) || response.statusText || 'Request failed';
      throw new ApiError(msg, response.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error – is the backend running?',
      0
    );
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export const api = {
  get:    <T>(endpoint: string, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post:   <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'POST', body }),
  put:    <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'PUT', body }),
  patch:  <T>(endpoint: string, body?: any, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: ApiOptions) => apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ─── Named API calls ──────────────────────────────────────────────────────────

export function checkBackendHealth() {
  return api.get<{ status: string }>('/api/health');
}

export function apiRegister(name: string, email: string, password: string, role: string) {
  return api.post<{ token: string; user: any }>('/api/auth/register', { name, email, password, role });
}

export function apiLogin(email: string, password: string) {
  return api.post<{ token: string; user: any }>('/api/auth/login', { email, password });
}

export function apiGetMe() {
  return api.get<{ user: any }>('/api/users/me');
}

export function apiUpdateMe(updates: Record<string, any>) {
  return api.put<{ user: any }>('/api/users/me', updates);
}
