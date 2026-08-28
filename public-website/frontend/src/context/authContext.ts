/**
 * context/authContext.ts
 * ──────────────────────
 * The auth context object and its type.
 *
 * Kept apart from the provider component so the module exports no components,
 * which keeps fast-refresh boundaries clean and lets the hook import the
 * context without pulling the provider in with it.
 */

import { createContext } from 'react';
import type { LoginPayload, UpdateProfilePayload, User } from '@/types/api';

/**
 * `initialising` is a distinct state on purpose. Without it, a guard cannot tell
 * "no session" from "we have not checked yet", and every protected route would
 * flash the sign-in page on reload before the session is restored.
 */
export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;

  /** Convenience flags. All of these are UI hints, never authorisation. */
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;

  /** True when the previous session ended because the token could not be renewed. */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
