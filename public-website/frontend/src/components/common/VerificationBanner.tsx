/**
 * components/common/VerificationBanner.tsx
 * ────────────────────────────────────────
 * Tells an unverified account why downloads are refused before they try.
 *
 * The backend refuses `GET /downloads/{id}/file` with 403 for an unverified
 * address. Saying so up front is better than letting someone click and be
 * turned away.
 *
 * The resend control repeats the server's response verbatim and does not branch
 * on it: the backend answers identically whether or not the address belongs to
 * an unverified account, precisely so this form cannot be used to discover which
 * addresses exist.
 */

import { useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client/errors';

export function VerificationBanner() {
  const { user, isAuthenticated } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (!isAuthenticated || !user || user.email_verified) return null;

  async function handleResend() {
    if (!user) return;
    setSending(true);
    setFailed(false);
    try {
      const response = await authApi.resendVerification(user.email);
      setMessage(response.message);
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof ApiError && error.status === 429
          ? 'Too many requests. Please wait a minute and try again.'
          : 'We could not send that just now. Please try again shortly.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Alert tone="warning" title="Verify your email address" className="mb-6">
      <p>
        We sent a verification link to <span className="font-medium">{user.email}</span>. Open it
        to finish setting up your account. Until then you can browse releases, but downloads
        cannot be recorded against this account.
      </p>
      <p className="mt-2 text-xs">
        Links expire, so use the most recent email you received.
      </p>

      {message ? (
        <p
          className={`mt-3 text-xs font-medium ${failed ? 'text-danger-700' : 'text-success-700'}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <p className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleResend()}
          loading={sending}
          loadingLabel="Sending"
        >
          Send a new link
        </Button>
      </p>
    </Alert>
  );
}
