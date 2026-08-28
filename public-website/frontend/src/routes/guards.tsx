/**
 * routes/guards.tsx
 * ─────────────────
 * Route guards.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE TRUSTING ANYTHING IN THIS FILE
 *
 * These guards are a usability feature. They stop someone landing on a screen
 * that cannot work for them and send them somewhere that can. They are NOT a
 * security boundary and must never be treated as one:
 *
 *   - the bundle is public, so anyone can read what routes exist
 *   - client state can be edited in a debugger
 *   - a determined visitor can render any component they like
 *
 * What actually protects data is that every request carries a bearer token the
 * server validates, and every protected endpoint re-checks the caller through
 * `get_current_user` / `require_verified` / `require_admin`. A non-admin who
 * forces their way to /admin/users sees the admin shell and a column of 403s,
 * because the server refuses them. That is the design working, not failing.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { Spinner } from '@/components/common/Spinner';

/** Shown while the session is being restored, before any redirect decision. */
function SessionLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm text-ink-500">Restoring your session…</p>
    </div>
  );
}

/**
 * Requires a signed-in account.
 * On refusal it remembers where the person was headed, so signing in returns
 * them there instead of dumping them on the homepage.
 */
export function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'initialising') return <SessionLoading />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        // Passed through router state, not the query string: the intended path
        // never lands in browser history or a Referer header.
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

/**
 * Requires the ADMIN (or SUPER_ADMIN) role.
 * A signed-in non-admin gets the 403 page rather than the sign-in page: they
 * are authenticated, just not entitled, and saying so is clearer than a
 * redirect loop through login.
 */
export function AdminRoute() {
  const { status, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (status === 'initialising') return <SessionLoading />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!isAdmin) return <Navigate to={ROUTES.forbidden} replace />;

  return <Outlet />;
}

/**
 * For sign-in and registration: someone already signed in has no business on
 * them, so send them to their profile instead of showing a form that would
 * only confuse.
 */
export function GuestOnlyRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'initialising') return <SessionLoading />;
  if (isAuthenticated) return <Navigate to={ROUTES.profile} replace />;

  return <Outlet />;
}
