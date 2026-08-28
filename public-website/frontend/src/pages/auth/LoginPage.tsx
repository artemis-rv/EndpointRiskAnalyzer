/**
 * pages/auth/LoginPage.tsx
 * ────────────────────────
 * Sign in.
 *
 * The backend answers a bad email and a bad password identically, and so does
 * this page: the failure message never distinguishes the two, because doing so
 * would hand an attacker a way to discover which addresses have accounts.
 *
 * The password is held in component state only for as long as the form is
 * mounted, is sent once, and is never written anywhere else.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { AuthShell } from './AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/api/client/errors';
import { Button } from '@/components/common/Button';
import { FormError, TextField } from '@/components/forms/Fields';
import { isClean, required, validateEmail } from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

interface LoginValues {
  email: string;
  password: string;
}

/** Only paths inside this app are honoured, so an open redirect is impossible. */
function safeRedirect(target: unknown): string {
  if (typeof target !== 'string') return ROUTES.profile;
  if (!target.startsWith('/') || target.startsWith('//')) return ROUTES.profile;
  return target;
}

export function LoginPage() {
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = safeRedirect((location.state as { from?: unknown } | null)?.from);

  function update<K extends keyof LoginValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors<LoginValues> = {
      email: validateEmail(values.email),
      password: required(values.password, 'Password'),
    };
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
      // Clear the password from state before leaving the page.
      setValues((current) => ({ ...current, password: '' }));
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setFormError('Too many sign-in attempts. Please wait a minute and try again.');
        } else if (error.status === 401 || error.status === 400) {
          // Deliberately uniform: never reveal whether the account exists.
          setFormError('That email address and password do not match an account.');
        } else if (error.status === 403) {
          setFormError(error.message);
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

  return (
    <>
      <PageMeta
        title="Sign in"
        description="Sign in to your RiskIntel account to download releases and track your requests."
        canonicalPath="/login"
      />

      <AuthShell
        title="Sign in"
        subtitle="Access your downloads, feedback and contact requests."
        footer={
          <>
            No account yet?{' '}
            <Link to={ROUTES.register} className="link">
              Create one
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
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            error={errors.email}
            placeholder="you@company.com"
            disabled={submitting}
          />

          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            error={errors.password}
            disabled={submitting}
            labelAside={
              <Link to={ROUTES.forgotPassword} className="link text-xs">
                Forgot password?
              </Link>
            }
          />

          <Button type="submit" fullWidth loading={submitting} loadingLabel="Signing in">
            Sign in
          </Button>
        </form>
      </AuthShell>
    </>
  );
}
