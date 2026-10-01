import type { ApiErrorBody, AuthTokens } from '@card-trader/shared';
import { API_URL } from '../config';
import { secureStorage } from '../stores/secureStorage';
import { useSession } from '../stores/session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return "Can't reach the server. Check your connection.";
    if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.details) && error.details.length > 0) {
      return String(error.details[0]);
    }
    return error.message;
  }
  return 'Something went wrong';
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  /** Set false for public endpoints (login/register/refresh). */
  auth?: boolean;
  signal?: AbortSignal;
}

const REFRESH_MARGIN_MS = 30_000;
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the stored refresh token for a new access token. Single-flight:
 * concurrent callers share one request, because the server treats reuse of a
 * rotated refresh token as theft and revokes the whole session.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) return null;
      let response: Response;
      try {
        response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
      }
      if (response.status === 401) {
        await secureStorage.clear();
        useSession.getState().setSignedOut();
        return null;
      }
      if (!response.ok) throw await toApiError(response);
      const tokens = (await response.json()) as AuthTokens;
      await secureStorage.setRefreshToken(tokens.refreshToken);
      useSession.getState().setAccessToken(tokens);
      return tokens.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function validAccessToken(): Promise<string | null> {
  const { accessToken, accessTokenExpiresAt } = useSession.getState();
  if (accessToken && accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS) return accessToken;
  return refreshAccessToken();
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return new ApiError(response.status, body.code ?? 'HTTP_ERROR', body.message ?? 'Request failed', body.details);
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', 'Request failed');
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, auth = true, signal } = options;

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
    }
  };

  let token = auth ? await validAccessToken() : null;
  if (auth && !token) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in again');

  let response = await send(token);
  if (auth && response.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in again');
    response = await send(token);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
