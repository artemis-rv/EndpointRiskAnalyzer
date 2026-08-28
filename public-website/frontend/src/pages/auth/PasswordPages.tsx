/**
 * pages/auth/PasswordPages.tsx
 * ────────────────────────────
 * Forgot password, reset password, and email verification.
 *
 * The reset request page shows the same confirmation whatever the outcome. That
 * is not vagueness for its own sake: the backend answers identically for a
 * known and an unknown address specifically so nobody can use this form to
 * discover which addresses have accounts, and branching on the response here
 * would give that back.
 *
 * The reset and verification links arrive by email carrying `user_id` and
 * `token` in the query string, which is the format the backend generates
 * (`app/utils/email.py`). Those values are read once, submitted, and never
 * logged or stored.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { AuthShell } from './AuthShell';
import { authApi } from '@/api/auth';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/api/client/errors';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { FormError, TextField } from '@/components/forms/Fields';
import { CheckCircleIcon, MailIcon } from '@/components/common/Icons';
import { isClean, passwordChecks, validateEmail, validatePassword } from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

// ── Forgot password ─────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const error = validateEmail(email);
    setFieldError(error);
    if (error) return;

    setSubmitting(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      // Rate limiting is the one thing worth surfacing: it tells someone to
      // wait rather than hammer the form. Everything else resolves to the same
      // neutral confirmation, to keep the anti-enumeration property intact.
      if (error instanceof ApiError && error.status === 429) {
        setFormError('Too many requests. Please wait a minute and try again.');
      } else {
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <PageMeta title="Check your email" noIndex />
        <AuthShell title="Check your email">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <MailIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              If an account with that email exists, a reset link has been sent. Open it to choose a
              new password.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Reset links expire after a short time. If yours has, request another.
            </p>
            <Link to={ROUTES.login} className="btn-secondary mt-6 w-full">
              Back to sign in
            </Link>
          </div>
        </AuthShell>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title="Reset your password"
        description="Request a password reset link for your RiskIntel account."
        canonicalPath="/forgot-password"
      />
      <AuthShell
        title="Reset your password"
        subtitle="Enter the email address on your account and we will send a reset link."
        footer={
          <>
            Remembered it?{' '}
            <Link to={ROUTES.login} className="link">
              Sign in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormError message={formError} />

          <TextField
            label="Email address"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(undefined);
            }}
            error={fieldError}
            placeholder="you@company.com"
            disabled={submitting}
          />

          <Button type="submit" fullWidth loading={submitting} loadingLabel="Sending">
            Send reset link
          </Button>
        </form>
      </AuthShell>
    </>
  );
}

// ── Reset password ──────────────────────────────────────────────────────────

interface ResetValues {
  new_password: string;
  confirm_password: string;
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('user_id') ?? '';
  const token = searchParams.get('token') ?? '';
  const linkIsComplete = userId !== '' && token !== '';

  const [values, setValues] = useState<ResetValues>({ new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState<FieldErrors<ResetValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors<ResetValues> = {
      new_password: validatePassword(values.new_password),
      confirm_password:
        values.confirm_password !== values.new_password ? 'Passwords do not match.' : undefined,
    };
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        user_id: userId,
        token,
        new_password: values.new_password,
      });
      setValues({ new_password: '', confirm_password: '' });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 || error.status === 401 || error.status === 404) {
          setFormError(
            'That reset link is not valid or has expired. Request a new one and try again.',
          );
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!linkIsComplete) {
    return (
      <>
        <PageMeta title="Reset link incomplete" noIndex />
        <AuthShell title="This reset link is incomplete">
          <Alert tone="warning">
            <p>
              The link you followed is missing information it needs. Copy it from your email again,
              or request a fresh one.
            </p>
          </Alert>
          <Link to={ROUTES.forgotPassword} className="btn-primary mt-6 w-full">
            Request a new link
          </Link>
        </AuthShell>
      </>
    );
  }

  if (done) {
    return (
      <>
        <PageMeta title="Password updated" noIndex />
        <AuthShell title="Password updated">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-700">
              <CheckCircleIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              Your password has been changed. Sign in with the new one.
            </p>
            <Button
              className="mt-6"
              fullWidth
              onClick={() => navigate(ROUTES.login, { replace: true })}
            >
              Go to sign in
            </Button>
          </div>
        </AuthShell>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Choose a new password" noIndex />
      <AuthShell title="Choose a new password" subtitle="Pick something you have not used before.">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormError message={formError} />

          <div>
            <TextField
              label="New password"
              type="password"
              required
              autoComplete="new-password"
              autoFocus
              value={values.new_password}
              onChange={(event) => {
                setValues((current) => ({ ...current, new_password: event.target.value }));
                setErrors((current) => ({ ...current, new_password: undefined }));
              }}
              error={errors.new_password}
              disabled={submitting}
            />
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Password requirements">
              {passwordChecks(values.new_password).map((check) => (
                <li
                  key={check.id}
                  className={`text-xs ${check.passed ? 'text-success-700' : 'text-ink-500'}`}
                >
                  {check.passed ? '✓' : '•'} {check.label}
                </li>
              ))}
            </ul>
          </div>

          <TextField
            label="Confirm new password"
            type="password"
            required
            autoComplete="new-password"
            value={values.confirm_password}
            onChange={(event) => {
              setValues((current) => ({ ...current, confirm_password: event.target.value }));
              setErrors((current) => ({ ...current, confirm_password: undefined }));
            }}
            error={errors.confirm_password}
            disabled={submitting}
          />

          <Button type="submit" fullWidth loading={submitting} loadingLabel="Updating">
            Update password
          </Button>
        </form>
      </AuthShell>
    </>
  );
}

// ── Email verification ──────────────────────────────────────────────────────

type VerifyState = 'verifying' | 'success' | 'invalid' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id') ?? '';
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<VerifyState>(
    userId && token ? 'verifying' : 'invalid',
  );
  const [message, setMessage] = useState<string>('');

  // React runs effects twice in development StrictMode. Verification tokens are
  // single-use, so a second call would report a spurious failure.
  const attempted = useRef(false);

  useEffect(() => {
    if (!userId || !token) return;
    if (attempted.current) return;
    attempted.current = true;

    let cancelled = false;

    void (async () => {
      try {
        await authApi.verifyEmail({ user_id: userId, token });
        if (!cancelled) setState('success');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && [400, 401, 404, 422].includes(error.status)) {
          setState('invalid');
        } else {
          setState('error');
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again shortly.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  return (
    <>
      <PageMeta title="Verify your email" noIndex />
      <AuthShell title="Email verification">
        {state === 'verifying' ? (
          <div
            className="flex flex-col items-center gap-3 py-6 text-center"
            role="status"
            aria-live="polite"
          >
            <Spinner className="h-7 w-7 text-brand-600" />
            <p className="text-sm text-ink-600">Verifying your email address…</p>
          </div>
        ) : null}

        {state === 'success' ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-700">
              <CheckCircleIcon className="h-6 w-6" />
            </span>
            <h2 className="heading-3 mt-4">Your email is verified</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Your account is fully set up. You can now sign in and download releases.
            </p>
            <Link to={ROUTES.login} className="btn-primary mt-6 w-full">
              Go to sign in
            </Link>
          </div>
        ) : null}

        {state === 'invalid' ? (
          <div>
            <Alert tone="warning" title="This link is no longer valid">
              <p>
                Verification links expire, and each one can only be used once. If you have a newer
                verification email, use the link in that one instead.
              </p>
            </Alert>
            <div className="mt-6 flex flex-col gap-3">
              <Link to={ROUTES.login} className="btn-primary w-full">
                Go to sign in
              </Link>
              <Link to={ROUTES.contact} className="btn-secondary w-full">
                Contact support
              </Link>
            </div>
          </div>
        ) : null}

        {state === 'error' ? (
          <div>
            <Alert tone="danger" title="We could not verify your email">
              <p>{message}</p>
            </Alert>
            <Link to={ROUTES.home} className="btn-secondary mt-6 w-full">
              Back to the homepage
            </Link>
          </div>
        ) : null}
      </AuthShell>
    </>
  );
}
