/**
 * api/client/tokenStore.test.ts
 * ─────────────────────────────
 * The security properties of the token store, asserted rather than assumed.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { subscribeToTokenChanges, tokenStore } from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    tokenStore.clear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('never writes the access token to any persistent storage', () => {
    tokenStore.setTokens('access-token-value', 'refresh-token-value', 900);

    const allLocal = JSON.stringify(localStorage);
    const allSession = JSON.stringify(sessionStorage);

    expect(allLocal).not.toContain('access-token-value');
    expect(allSession).not.toContain('access-token-value');
    // It is available in memory for the request that needs it.
    expect(tokenStore.getAccessToken()).toBe('access-token-value');
  });

  it('never writes anything to localStorage', () => {
    tokenStore.setTokens('access', 'refresh', 900);
    expect(localStorage.length).toBe(0);
  });

  it('keeps the refresh token in sessionStorage so a reload can restore', () => {
    tokenStore.setTokens('access', 'refresh-value', 900);
    expect(tokenStore.getRefreshToken()).toBe('refresh-value');
    expect(sessionStorage.length).toBeGreaterThan(0);
  });

  it('reports a token as stale once its lifetime has passed', () => {
    tokenStore.setTokens('access', 'refresh', 900);
    expect(tokenStore.hasFreshAccessToken()).toBe(true);

    // Expiring in 5 seconds is inside the default 15 second skew.
    tokenStore.setTokens('access', 'refresh', 5);
    expect(tokenStore.hasFreshAccessToken()).toBe(false);
  });

  it('reports no fresh token when there is none at all', () => {
    expect(tokenStore.hasFreshAccessToken()).toBe(false);
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('removes every trace of the session on clear', () => {
    tokenStore.setTokens('access', 'refresh', 900);
    tokenStore.clear();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('notifies subscribers when tokens are set and cleared', () => {
    let notifications = 0;
    const unsubscribe = subscribeToTokenChanges(() => {
      notifications += 1;
    });

    tokenStore.setTokens('a', 'b', 900);
    tokenStore.clear();

    expect(notifications).toBe(2);
    unsubscribe();
  });
});
