/**
 * context/AuthProvider.tsx
 * ────────────────────────
 * Owns authentication state for the whole app.
 *
 * This is the only global state in the application. Server data lives in the
 * query cache, form state lives in the form, and UI state lives in the
 * component — none of it belongs here.
 *
 * WHAT THIS IS NOT: an authorisation mechanism. `isAdmin` decides which links
 * to draw. The API decides what a caller may actually do, on every request.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { usersApi } from '@/api/users';
import { onSessionExpired } from '@/api/client/http';
import { tokenStore } from '@/api/client/tokenStore';
import { ApiError } from '@/api/client/errors';
import { UserRole } from '@/types/api';
import type { LoginPayload, UpdateProfilePayload, User } from '@/types/api';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initialising');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  // Guards against a state update after unmount during the bootstrap fetch.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Drop every cached server response on sign-out or expiry.
   * Without this, the next person to sign in on the same tab could be shown the
   * previous account's cached lists before their own data arrives.
   */
  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // ── Bootstrap: restore a session from the stored refresh token ────────────
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.getRefreshToken()) {
        if (!cancelled) setStatus('anonymous');
        return;
      }

      try {
        // The HTTP layer exchanges the refresh token for an access token before
        // this call goes out, so a single request restores the whole session.
        const profile = await usersApi.getMe();
        if (cancelled || !mounted.current) return;
        setUser(profile);
        setStatus('authenticated');
      } catch {
        if (cancelled || !mounted.current) return;
        // A stale or revoked refresh token is a normal condition, not an error
        // worth showing: the person simply is not signed in.
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── React to a refresh failure raised deep inside the HTTP layer ──────────
  useEffect(
    () =>
      onSessionExpired(() => {
        if (!mounted.current) return;
        // Only announce an expiry to someone who believed they were signed in.
        setSessionExpired((wasExpired) => wasExpired || status === 'authenticated');
        clearSession();
      }),
    [clearSession, status],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      setSessionExpired(false);
      await authApi.login(payload);
      // Fetch the profile before flipping to authenticated, so a guard never
      // sees `authenticated` with a null user.
      const profile = await usersApi.getMe();
      queryClient.clear();
      setUser(profile);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Revocation may fail if the session was already gone server-side. The
      // local session is cleared either way, which is the part that matters.
      if (!(error instanceof ApiError)) throw error;
    } finally {
      clearSession();
      setSessionExpired(false);
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.getRefreshToken() && !tokenStore.getAccessToken()) return;
    try {
      const profile = await usersApi.getMe();
      if (!mounted.current) return;
      setUser(profile);
      setStatus('authenticated');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearSession();
    }
  }, [clearSession]);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const updated = await usersApi.updateMe(payload);
    if (mounted.current) setUser(updated);
    return updated;
  }, []);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated' && user !== null,
      // SUPER_ADMIN sits above ADMIN in the backend role hierarchy, so it also
      // reaches the admin area. There is no separate super-admin surface.
      isAdmin:
        user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN,
      isEmailVerified: user?.email_verified === true,
      sessionExpired,
      dismissSessionExpired,
      login,
      logout,
      refreshUser,
      updateProfile,
    }),
    [status, user, sessionExpired, dismissSessionExpired, login, logout, refreshUser, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
