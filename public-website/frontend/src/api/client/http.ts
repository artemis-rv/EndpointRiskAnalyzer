/**
 * api/client/http.ts
 * ──────────────────
 * The single HTTP client. Every network call in the application goes through
 * `request()`; no component ever calls `fetch` directly.
 *
 * Responsibilities kept here so they exist exactly once:
 *   - base URL and versioned prefix resolution
 *   - JSON encoding/decoding
 *   - Authorization header injection
 *   - request timeouts via AbortController
 *   - transparent access-token refresh on 401, de-duplicated across callers
 *   - normalising every failure into an ApiError
 *
 * Never logs tokens, request bodies, or response bodies.
 */

import { apiUrl, config } from '@/constants/config';
import { ApiError, apiErrorFromResponse, networkError, timeoutError } from './errors';
import { tokenStore } from './tokenStore';

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Serialised as JSON. Never logged. */
  body?: unknown;
  /** Appended as a query string; undefined and null entries are dropped. */
  query?: Record<string, QueryValue>;
  /** Attach the bearer token and retry once after refreshing. Default: false. */
  auth?: boolean;
  /** Caller-supplied abort signal, combined with the internal timeout. */
  signal?: AbortSignal;
  /** Override the default timeout for a single call. */
  timeoutMs?: number;
}

// ── Session expiry notification ─────────────────────────────────────────────

type SessionExpiredHandler = () => void;
const sessionExpiredHandlers = new Set<SessionExpiredHandler>();

/**
 * Registered by the auth context. Fires when a refresh attempt fails and the
 * session cannot be recovered, so the UI can send the user to sign in.
 */
export function onSessionExpired(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandlers.add(handler);
  return () => sessionExpiredHandlers.delete(handler);
}

function emitSessionExpired(): void {
  sessionExpiredHandlers.forEach((handler) => handler());
}

// ── URL building ────────────────────────────────────────────────────────────

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = apiUrl(path);
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ── Response parsing ────────────────────────────────────────────────────────

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    // Anything non-JSON is treated as opaque. We never render it.
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ── Token refresh, de-duplicated ────────────────────────────────────────────

/**
 * Concurrent 401s must not each fire their own refresh: the backend rotates
 * refresh tokens, so a second concurrent attempt would present an already-spent
 * token and destroy the session. All callers await the same in-flight promise.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        tokenStore.clear();
        return false;
      }

      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!body.access_token || !body.refresh_token) {
        tokenStore.clear();
        return false;
      }

      tokenStore.setTokens(body.access_token, body.refresh_token, body.expires_in ?? 900);
      return true;
    } catch {
      // Network failure during refresh: keep the stored token so a later
      // attempt can still succeed once connectivity returns.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Ensure a usable access token before an authenticated call. Prevents the
 * predictable 401 round-trip when we already know the token has expired.
 */
async function ensureAccessToken(): Promise<void> {
  if (tokenStore.hasFreshAccessToken()) return;
  if (tokenStore.getRefreshToken()) {
    await refreshAccessToken();
  }
}

/**
 * Public form of the above, for the one caller that cannot go through
 * `request()`: the artefact download needs the raw Response to read
 * Content-Disposition and stream a Blob, but it still must not send a stale
 * token and provoke a needless 401.
 */
export async function ensureAuthenticated(): Promise<void> {
  await ensureAccessToken();
}

// ── Core request ────────────────────────────────────────────────────────────

/**
 * A cancellation is not a failure.
 *
 * Two very different things abort a request: our own timeout, and the caller
 * withdrawing interest (a component unmounting, a route change, React
 * StrictMode remounting in development, or the query layer superseding a
 * fetch). They must not be reported the same way.
 *
 * Reporting a cancellation as a timeout is worse than cosmetic: the query layer
 * treats the rejection as a real result for a request it has already cancelled,
 * discards it, and leaves the query with no data and no error. The page then
 * reads that as "the server returned nothing" and renders an empty state for
 * what was actually a failed request. So a caller-driven abort is rethrown
 * unchanged, and only our own timer produces a timeout error.
 */
class RequestCancelled extends Error {
  constructor() {
    super('Request cancelled.');
    this.name = 'AbortError';
  }
}

interface FetchOutcome {
  response: Response;
}

async function performFetch(
  url: string,
  options: RequestOptions,
  withAuth: boolean,
): Promise<FetchOutcome> {
  const timeoutMs = options.timeoutMs ?? config.apiTimeoutMs;
  const controller = new AbortController();

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) {
    clearTimeout(timer);
    throw new RequestCancelled();
  }
  options.signal?.addEventListener('abort', abortFromCaller);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (withAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      // No cookies are used by this backend; sending none also removes any
      // chance of a cross-site request riding on ambient credentials.
      credentials: 'omit',
      mode: 'cors',
      redirect: 'follow',
    });
    return { response };
  } catch (error) {
    const wasAbort = error instanceof DOMException && error.name === 'AbortError';
    if (wasAbort && timedOut) throw timeoutError();
    if (wasAbort) throw new RequestCancelled();
    throw networkError();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * Issue an API request and return the decoded body.
 * Throws {@link ApiError} for every failure mode, including network and timeout.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth === true;
  const url = buildUrl(path, options.query);

  if (withAuth) {
    await ensureAccessToken();
  }

  // performFetch already classifies transport failures; a RequestCancelled or
  // ApiError thrown here propagates unchanged so the caller can tell a
  // cancellation from a genuine failure.
  let { response } = await performFetch(url, options, withAuth);

  // One transparent retry after refreshing, for the case where the token
  // expired between our freshness check and the server validating it.
  if (response.status === 401 && withAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      ({ response } = await performFetch(url, options, true));
    }

    if (response.status === 401) {
      tokenStore.clear();
      emitSessionExpired();
      throw apiErrorFromResponse(401, await parseBody(response));
    }
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw apiErrorFromResponse(response.status, body);
  }

  return body as T;
}

/** Convenience wrappers so call sites read as verbs. */
export const http = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export { ApiError };
