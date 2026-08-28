/**
 * api/client/tokenStore.ts
 * ────────────────────────
 * The only module in the application that holds authentication material.
 *
 * WHY THIS SHAPE
 * The backend contract (`app/schemas/auth.py :: TokenResponse`) returns bearer
 * tokens in the JSON body. It does not set HTTP-only cookies, so a cookie-only
 * design is not available to us without changing the backend. Given that
 * constraint, this is the least-exposure arrangement that still works:
 *
 *   access token  — in memory only. Never persisted anywhere. It dies with the
 *                   tab, and it is the token attached to every request.
 *   refresh token — sessionStorage. Persisting it is what lets a page reload
 *                   keep you signed in. sessionStorage is chosen over
 *                   localStorage deliberately: it is scoped to a single tab,
 *                   is cleared when the tab closes, and is never shared with
 *                   other tabs or windows. The backend rotates refresh tokens
 *                   on every use, so a stale copy is single-use at worst.
 *
 * ACCEPTED RISK: any script running on this origin can read sessionStorage.
 * The mitigations are that no third-party scripts are loaded, the app never
 * renders raw HTML from any source, and the token is single-use because the
 * server rotates it. This trade-off is documented in the README.
 *
 * Tokens are never logged, never placed in a URL, and never included in an
 * error message.
 */

const REFRESH_TOKEN_KEY = 'riskintel.rt';

/** Held in a module-scoped variable: never persisted, never serialised. */
let accessToken: string | null = null;
let accessTokenExpiresAt: number | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to token clears so the auth context can react to expiry. */
export function subscribeToTokenChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function safeSessionStorage(): Storage | null {
  // Private-mode browsers and some embedded webviews throw on access.
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  /**
   * True when an access token exists and has not passed its advertised expiry.
   * A small skew is subtracted so we refresh slightly early rather than racing
   * the server clock.
   */
  hasFreshAccessToken(skewSeconds = 15): boolean {
    if (!accessToken || accessTokenExpiresAt === null) return false;
    return Date.now() < accessTokenExpiresAt - skewSeconds * 1000;
  },

  getRefreshToken(): string | null {
    try {
      return safeSessionStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  },

  /** Persist a fresh token pair after login or refresh. */
  setTokens(access: string, refresh: string, expiresInSeconds: number): void {
    accessToken = access;
    accessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    try {
      safeSessionStorage()?.setItem(REFRESH_TOKEN_KEY, refresh);
    } catch {
      // Storage unavailable: the session simply will not survive a reload.
    }
    notify();
  },

  /** Wipe every trace of the session. Called on logout and on hard 401s. */
  clear(): void {
    accessToken = null;
    accessTokenExpiresAt = null;
    try {
      safeSessionStorage()?.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Nothing further we can do; the in-memory token is already gone.
    }
    notify();
  },
};
