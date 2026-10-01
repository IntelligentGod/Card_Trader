import {
  isAdminRole,
  isTwoFactorChallenge,
  type ApiErrorBody,
  type AuthResponse,
  type AuthTokens,
  type ChangePasswordRequest,
  type LoginResponse,
  type MeResponse,
  type TwoFactorVerifyRequest,
} from '@card-trader/shared';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');

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
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

// ───────────── Session (sessionStorage-backed, observable) ─────────────

export interface Session {
  tokens: AuthTokens;
  user: MeResponse;
}

const STORAGE_KEY = 'card-trader-admin.session';
type Listener = () => void;
const listeners = new Set<Listener>();

function readStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let session: Session | null = readStoredSession();
/** Shown on the login page after the session ends unexpectedly. */
let notice: string | null = null;

function setSession(next: Session | null, nextNotice: string | null = null): void {
  session = next;
  notice = nextNotice;
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the in-memory session still works.
  }
  listeners.forEach((l) => l());
}

export function getSession(): Session | null {
  return session;
}

/** Keeps the top bar in sync after an admin edits their own profile. */
export function patchSessionUser(patch: Partial<MeResponse>): void {
  if (session) setSession({ ...session, user: { ...session.user, ...patch } });
}

export function getNotice(): string | null {
  return notice;
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ───────────── HTTP ─────────────

type AuthMode = 'none' | 'attach' | 'full';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** none: no token; attach: bearer only; full: bearer + refresh-and-retry on 401 */
  auth?: AuthMode;
  signal?: AbortSignal;
}

async function send(path: string, opts: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', `Can't reach the API at ${API_URL}`);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    // non-JSON error body
  }
  const message =
    (typeof body?.message === 'string' && body.message) ||
    (Array.isArray(body?.message) ? (body.message as string[]).join(', ') : '') ||
    `Request failed (${res.status} ${res.statusText})`;
  return new ApiError(res.status, body?.code ?? `HTTP_${res.status}`, message, body?.details);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Refresh outcome: new tokens, or the reason the session is dead. */
type RefreshResult = { tokens: AuthTokens } | { error: ApiError | null };

let refreshInFlight: Promise<RefreshResult> | null = null;

/** Rotates the refresh token. Concurrent callers share one request. */
function refreshTokens(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  const current = session;
  if (!current) return Promise.resolve({ error: null });
  refreshInFlight = (async (): Promise<RefreshResult> => {
    try {
      const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.tokens.refreshToken } }, null);
      if (!res.ok) {
        const err = await toApiError(res);
        if (res.status === 400 || res.status === 401 || res.status === 403) return { error: err };
        throw err;
      }
      const tokens = await parse<AuthTokens>(res);
      // Only keep the result if nobody logged out / in while we were waiting.
      if (session === current) setSession({ ...current, tokens });
      return { tokens };
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

const SESSION_EXPIRED = 'Your session expired. Please sign in again.';
/** Errors that end the session; their server message is shown on the login page. */
const SIGN_OUT_CODES = new Set(['ACCOUNT_BLOCKED', 'ACCOUNT_DISABLED']);

function endSession(cause: ApiError | null): ApiError {
  // ACCESS_TOKEN_INVALID carries a useful message ("Your password changed. Please sign in again.").
  const useServerMessage = cause && (SIGN_OUT_CODES.has(cause.code) || cause.code === 'ACCESS_TOKEN_INVALID');
  const message = useServerMessage ? cause.message : SESSION_EXPIRED;
  setSession(null, message);
  return cause && useServerMessage ? cause : new ApiError(401, 'SESSION_EXPIRED', message);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const mode = opts.auth ?? 'full';
  const usedToken = mode === 'none' ? null : (session?.tokens.accessToken ?? null);
  let res = await send(path, opts, usedToken);

  if (res.status === 401 && mode === 'full' && usedToken) {
    const firstError = await toApiError(res);
    // Another request may already have refreshed; reuse that token instead of rotating again.
    const latest = session?.tokens.accessToken;
    let nextToken: string | null = null;
    if (latest && latest !== usedToken) {
      nextToken = latest;
    } else {
      const result = await refreshTokens();
      if ('tokens' in result) nextToken = result.tokens.accessToken;
      else throw endSession(result.error && SIGN_OUT_CODES.has(result.error.code) ? result.error : firstError);
    }
    res = await send(path, opts, nextToken);
    if (res.status === 401) throw endSession(await toApiError(res));
  }

  if (!res.ok) {
    const err = await toApiError(res);
    if (mode === 'full' && session) {
      if (err.code === 'ADMIN_ONLY') setSession(null, 'This account is not an admin.');
      else if (SIGN_OUT_CODES.has(err.code)) setSession(null, err.message);
      else if (err.code === 'PASSWORD_CHANGE_REQUIRED') patchSessionUser({ mustChangePassword: true });
    }
    throw err;
  }
  return parse<T>(res);
}

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ───────────── Auth actions ─────────────

export type LoginStep = { kind: 'done' } | { kind: 'twoFactor'; challengeToken: string; expiresIn: number };

/** Admin console accepts ADMIN and SUPER_ADMIN only. */
async function finishSignIn(res: AuthResponse): Promise<void> {
  if (!isAdminRole(res.user.role)) {
    // Revoke the session we just created; ignore failures.
    await send('/auth/logout', { method: 'POST', body: { refreshToken: res.tokens.refreshToken } }, res.tokens.accessToken).catch(
      () => undefined,
    );
    throw new ApiError(403, 'ADMIN_ONLY', 'This account is not an admin.');
  }
  setSession({ user: res.user, tokens: res.tokens });
}

export async function login(email: string, password: string): Promise<LoginStep> {
  const res = await request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: 'none' });
  if (isTwoFactorChallenge(res)) {
    return { kind: 'twoFactor', challengeToken: res.challengeToken, expiresIn: res.expiresIn };
  }
  await finishSignIn(res);
  return { kind: 'done' };
}

export async function verifyTwoFactor(challengeToken: string, proof: { code: string } | { recoveryCode: string }): Promise<void> {
  const body: TwoFactorVerifyRequest = { challengeToken, ...proof };
  const res = await request<AuthResponse>('/auth/2fa/verify', { method: 'POST', body, auth: 'none' });
  await finishSignIn(res);
}

/** Forced change after an admin reset: no current password needed. Stores the new tokens. */
export async function changePassword(newPassword: string): Promise<void> {
  const body: ChangePasswordRequest = { newPassword };
  const res = await request<AuthResponse>('/auth/change-password', { method: 'POST', body });
  setSession({ user: res.user, tokens: res.tokens });
}

export async function logout(): Promise<void> {
  const current = session;
  setSession(null);
  if (!current) return;
  try {
    await send('/auth/logout', { method: 'POST', body: { refreshToken: current.tokens.refreshToken } }, current.tokens.accessToken);
  } catch {
    // Local session is already cleared; the refresh token will simply expire.
  }
}
