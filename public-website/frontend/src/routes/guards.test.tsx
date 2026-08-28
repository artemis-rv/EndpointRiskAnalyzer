/**
 * routes/guards.test.tsx
 * ──────────────────────
 * Security-oriented tests for the route guards.
 *
 * These assert the UX contract — an unauthenticated visitor is sent to sign in,
 * a signed-in non-admin is refused the admin area. They do NOT assert that the
 * application is secure: the server is what enforces access, and these guards
 * only decide what gets drawn.
 */

import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute } from './guards';
import { tokenStore } from '@/api/client/tokenStore';
import { jsonResponse, makeUser, renderWithProviders } from '@/test/utils';

function TestApp() {
  return (
    <Routes>
      <Route path="/login" element={<p>Sign in page</p>} />
      <Route path="/403" element={<p>Access denied page</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<p>Profile page</p>} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<p>Admin overview</p>} />
      </Route>
    </Routes>
  );
}

/** Arrange a restored session for the given user. */
function givenSignedInAs(user: ReturnType<typeof makeUser>) {
  tokenStore.setTokens('access', 'refresh', 900);
  global.fetch = vi.fn().mockResolvedValue(jsonResponse(user)) as unknown as typeof fetch;
}

describe('ProtectedRoute', () => {
  it('sends an unauthenticated visitor to the sign-in page', async () => {
    tokenStore.clear();
    renderWithProviders(<TestApp />, { route: '/profile' });

    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Profile page')).not.toBeInTheDocument();
  });

  it('lets a signed-in account through', async () => {
    givenSignedInAs(makeUser());
    renderWithProviders(<TestApp />, { route: '/profile' });

    expect(await screen.findByText('Profile page')).toBeInTheDocument();
  });

  it('shows a restoring state rather than flashing the sign-in page on reload', async () => {
    tokenStore.setTokens('access', 'refresh', 900);
    // A profile fetch that never settles keeps the guard in `initialising`.
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    renderWithProviders(<TestApp />, { route: '/profile' });

    expect(await screen.findByText(/restoring your session/i)).toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('refuses a normal user and shows the access denied page', async () => {
    givenSignedInAs(makeUser({ role: 'USER' }));
    renderWithProviders(<TestApp />, { route: '/admin' });

    expect(await screen.findByText('Access denied page')).toBeInTheDocument();
    expect(screen.queryByText('Admin overview')).not.toBeInTheDocument();
  });

  it('admits an ADMIN account', async () => {
    givenSignedInAs(makeUser({ role: 'ADMIN' }));
    renderWithProviders(<TestApp />, { route: '/admin' });

    expect(await screen.findByText('Admin overview')).toBeInTheDocument();
  });

  it('admits a SUPER_ADMIN through the same admin area, not a separate one', async () => {
    givenSignedInAs(makeUser({ role: 'SUPER_ADMIN' }));
    renderWithProviders(<TestApp />, { route: '/admin' });

    expect(await screen.findByText('Admin overview')).toBeInTheDocument();
  });

  it('sends an unauthenticated visitor to sign in rather than to 403', async () => {
    tokenStore.clear();
    renderWithProviders(<TestApp />, { route: '/admin' });

    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
  });

  it('drops the session when the stored refresh token is rejected', async () => {
    tokenStore.setTokens('access', 'stale-refresh', 900);
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: false, error: 'Unauthorized.' }, 401)) as never;

    renderWithProviders(<TestApp />, { route: '/profile' });

    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
    await waitFor(() => expect(tokenStore.getRefreshToken()).toBeNull());
  });
});
