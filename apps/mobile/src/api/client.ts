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
    if (error.code === 'TIMEOUT') return 'The server took too long to answer. Check your connection and try again.';
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
/**
 * React Native's HTTP client never times out on its own: a connection that drops mid-request
 * leaves the promise (and any spinner waiting on it) pending forever.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/** fetch() that fails with a TIMEOUT ApiError after `timeoutMs`; a caller's own abort still throws AbortError. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/** 403 codes after which the session is over (an admin blocked or disabled the account). */
const ACCOUNT_CLOSED_CODES = new Set(['ACCOUNT_BLOCKED', 'ACCOUNT_DISABLED']);

/**
 * What the app does when any request reports that the session changed. Kept as
 * injected callbacks so this module doesn't import the session actions (cycle).
 */
interface SessionHandlers {
  /** sign out and show `message` on the sign-in screen */
  onAccountClosed: (message: string) => void;
  /** an admin reset the password: refetch /users/me so the forced change screen shows */
  onPasswordChangeRequired: () => void;
  /** the access token was revoked (e.g. password changed elsewhere) and refresh failed */
  onSessionEnded: (message: string) => void;
}

let sessionHandlers: Partial<SessionHandlers> = {};

export function registerSessionHandlers(handlers: SessionHandlers): void {
  sessionHandlers = handlers;
}

function reportSessionError(error: ApiError): void {
  if (error.status !== 403) return;
  if (ACCOUNT_CLOSED_CODES.has(error.code)) sessionHandlers.onAccountClosed?.(error.message);
  else if (error.code === 'PASSWORD_CHANGE_REQUIRED') sessionHandlers.onPasswordChangeRequired?.();
}

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
      const response = await fetchWithTimeout(
        `${API_URL}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        REQUEST_TIMEOUT_MS,
      );
      if (response.status === 401) {
        await secureStorage.clear();
        useSession.getState().setSignedOut();
        return null;
      }
      if (!response.ok) {
        const error = await toApiError(response);
        if (error.status === 403 && ACCOUNT_CLOSED_CODES.has(error.code)) {
          sessionHandlers.onAccountClosed?.(error.message);
          return null;
        }
        throw error;
      }
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

  const send = (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchWithTimeout(
      `${API_URL}${path}`,
      { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) },
      form ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
      signal,
    );
  };

  let token = auth ? await validAccessToken() : null;
  if (auth && !token) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in again');

  let response = await send(token);
  if (auth && response.status === 401) {
    const rejected = await toApiError(response);
    token = await refreshAccessToken();
    if (!token) {
      // "Your password changed. Please sign in again." — worth showing on the sign-in screen.
      if (rejected.code === 'ACCESS_TOKEN_INVALID') sessionHandlers.onSessionEnded?.(rejected.message);
      throw new ApiError(401, 'AUTH_REQUIRED', rejected.code === 'ACCESS_TOKEN_INVALID' ? rejected.message : 'Please sign in again');
    }
    response = await send(token);
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (auth) reportSessionError(error);
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
