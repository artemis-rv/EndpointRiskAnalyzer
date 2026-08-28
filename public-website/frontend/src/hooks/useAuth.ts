/**
 * hooks/useAuth.ts
 * ────────────────
 * Access the authentication context.
 * Throws when used outside the provider, which turns a wiring mistake into an
 * immediate, obvious failure instead of a silent null.
 */

import { useContext } from 'react';
import { AuthContext } from '@/context/authContext';
import type { AuthContextValue } from '@/context/authContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return context;
}
