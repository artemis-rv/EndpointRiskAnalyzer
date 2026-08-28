/**
 * pages/auth/RegisterPage.tsx
 * ───────────────────────────
 * Create an account.
 *
 * The password policy is shown as a live checklist rather than a paragraph of
 * rules, so someone can see what is still missing while they type instead of
 * being told after they submit. The checklist mirrors
 * `validate_password_strength` on the server, which remains the authority.
 *
 * On success the page switches to a "check your email" state: the backend has
 * sent a verification link and the account cannot download until it is used.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { AuthShell } from './AuthShell';
import { authApi } from '@/api/auth';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/api/client/errors';
import { Button } from '@/components/common/Button';
import { FormError, TextField } from '@/components/forms/Fields';
import { CheckIcon, MailIcon, XIcon } from '@/components/common/Icons';
import {
  isClean,
  maxLength,
  passwordChecks,
  validateCountryCode,
  validateEmail,
  validateName,
  validatePassword,
} from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

interface RegisterValues {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  company_name: string;
  password: string;
  confirm_password: string;
}

const EMPTY: RegisterValues = {
  first_name: '',
  last_name: '',
  email: '',
  country_code: '',
  company_name: '',
  password: '',
  confirm_password: '',
};

function PasswordChecklist({ password }: { password: string }) {
  const checks = passwordChecks(password);

  return (
    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Password requirements">
      {checks.map((check) => (
        <li key={check.id} className="flex items-center gap-1.5 text-xs">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
              check.passed ? 'bg-success-100 text-success-700' : 'bg-ink-100 text-ink-400'
            }`}
            aria-hidden="true"
          >
            {check.passed ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
          </span>
          <span className={check.passed ? 'text-success-700' : 'text-ink-500'}>
            {check.label}
          </span>
          {/* Text equivalent so the state is not conveyed by colour alone. */}
          <span className="sr-only">{check.passed ? ' — met' : ' — not met yet'}</span>
        </li>
      ))}
    </ul>
  );
}

export function RegisterPage() {
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<RegisterValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  function update<K extends keyof RegisterValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): FieldErrors<RegisterValues> {
    return {
      first_name: validateName(values.first_name, 'First name'),
      last_name: validateName(values.last_name, 'Last name'),
      email: validateEmail(values.email),
      country_code: validateCountryCode(values.country_code),
      company_name: maxLength(values.company_name.trim(), 255, 'Company name'),
      password: validatePassword(values.password),
      confirm_password:
        values.confirm_password !== values.password ? 'Passwords do not match.' : undefined,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    setSubmitting(true);
    try {
      await authApi.register({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        country_code: values.country_code.trim().toUpperCase(),
        password: values.password,
        company_name: values.company_name.trim() || null,
      });

      const email = values.email.trim();
      // Drop every credential from memory now that the request has been sent.
      setValues(EMPTY);
      setRegisteredEmail(email);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as FieldErrors<RegisterValues>);
          setFormError('Please correct the highlighted fields.');
        } else if (error.status === 409) {
          setFormError('That email address is already registered. Try signing in instead.');
        } else if (error.status === 429) {
          setFormError('Too many attempts. Please wait a minute and try again.');
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

  // ── Success state ─────────────────────────────────────────────────────────
  if (registeredEmail) {
    return (
      <>
        <PageMeta title="Check your email" noIndex />
        <AuthShell title="Check your email">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <MailIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              We sent a verification link to{' '}
              <span className="break-anywhere font-semibold text-ink-900">{registeredEmail}</span>.
              Open it to finish setting up your account.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              You can sign in straight away, but downloads cannot be recorded until the address is
              verified. Links expire, so use the newest email you received.
            </p>
            <Link to={ROUTES.login} className="btn-primary mt-6 w-full">
              Go to sign in
            </Link>
          </div>
        </AuthShell>
      </>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta
        title="Create an account"
        description="Create a RiskIntel account to download releases and track your requests."
        canonicalPath="/register"
      />

      <AuthShell
        wide
        title="Create your account"
        subtitle="You will need a verified email address before you can record downloads."
        footer={
          <>
            Already have an account?{' '}
            <Link to={ROUTES.login} className="link">
              Sign in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormError message={formError} />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="First name"
              required
              autoComplete="given-name"
              autoFocus
              value={values.first_name}
              onChange={(event) => update('first_name', event.target.value)}
              error={errors.first_name}
              maxLength={100}
              disabled={submitting}
            />
            <TextField
              label="Last name"
              required
              autoComplete="family-name"
              value={values.last_name}
              onChange={(event) => update('last_name', event.target.value)}
              error={errors.last_name}
              maxLength={100}
              disabled={submitting}
            />
          </div>

          <TextField
            label="Work email address"
            type="email"
            required
            autoComplete="email"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            error={errors.email}
            placeholder="you@company.com"
            disabled={submitting}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Country code"
              required
              autoComplete="country"
              value={values.country_code}
              onChange={(event) => update('country_code', event.target.value.toUpperCase())}
              error={errors.country_code}
              hint="Two letters, for example GB, IN or US."
              maxLength={10}
              placeholder="GB"
              disabled={submitting}
            />
            <TextField
              label="Company name"
              autoComplete="organization"
              value={values.company_name}
              onChange={(event) => update('company_name', event.target.value)}
              error={errors.company_name}
              maxLength={255}
              disabled={submitting}
            />
          </div>

          <div>
            <TextField
              label="Password"
              type="password"
              required
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => update('password', event.target.value)}
              error={errors.password}
              disabled={submitting}
            />
            <PasswordChecklist password={values.password} />
          </div>

          <TextField
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={values.confirm_password}
            onChange={(event) => update('confirm_password', event.target.value)}
            error={errors.confirm_password}
            disabled={submitting}
          />

          <Button type="submit" fullWidth loading={submitting} loadingLabel="Creating account">
            Create account
          </Button>

          <p className="text-center text-xs leading-relaxed text-ink-500">
            By creating an account you agree to our{' '}
            <Link to={ROUTES.terms} className="link">
              terms
            </Link>{' '}
            and{' '}
            <Link to={ROUTES.privacy} className="link">
              privacy policy
            </Link>
            .
          </p>
        </form>
      </AuthShell>
    </>
  );
}
