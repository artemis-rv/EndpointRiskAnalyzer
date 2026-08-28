/**
 * components/common/SessionExpiredNotice.tsx
 * ──────────────────────────────────────────
 * Banner shown after a session ends on its own.
 *
 * Expiry is silent otherwise: requests simply start failing, which reads as the
 * site being broken. Saying plainly that the session ended, and offering the
 * way back, turns a confusing failure into an ordinary one.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { AlertIcon, XIcon } from './Icons';

export function SessionExpiredNotice() {
  const { sessionExpired, dismissSessionExpired } = useAuth();

  if (!sessionExpired) return null;

  return (
    <div className="border-b border-warning-200 bg-warning-50" role="alert">
      <div className="container-page flex items-center gap-3 py-3">
        <AlertIcon className="h-5 w-5 shrink-0 text-warning-600" />
        <p className="flex-1 text-sm text-warning-700">
          Your session ended and you have been signed out.{' '}
          <Link to={ROUTES.login} className="font-semibold underline underline-offset-2">
            Sign in again
          </Link>{' '}
          to pick up where you left off.
        </p>
        <button
          type="button"
          onClick={dismissSessionExpired}
          className="rounded-lg p-1.5 text-warning-700 transition-colors hover:bg-warning-100"
          aria-label="Dismiss session notice"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
