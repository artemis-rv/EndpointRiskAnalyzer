/**
 * pages/user/ProfilePage.tsx
 * ──────────────────────────
 * View and edit the signed-in profile.
 *
 * Only the four fields `PATCH /users/me` accepts are editable. Email, role and
 * verification state are shown read-only because the server does not accept
 * them here — rendering them as inputs would promise something the API refuses.
 *
 * The server identifies the subject from the bearer token, so there is no user
 * id in the request and no way for this page to address another account.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/api/client/errors';
import { CardSection } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { FormError, TextField } from '@/components/forms/Fields';
import { formatDateTime } from '@/utils/format';
import {
  isClean,
  maxLength,
  validateCountryCode,
  validateName,
} from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

interface ProfileValues {
  first_name: string;
  last_name: string;
  country_code: string;
  company_name: string;
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [values, setValues] = useState<ProfileValues>({
    first_name: '',
    last_name: '',
    country_code: '',
    company_name: '',
  });
  const [errors, setErrors] = useState<FieldErrors<ProfileValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Seed the form from the profile, and re-seed after a save changes it.
   * Done during render rather than in an effect so the inputs are never painted
   * empty for a frame before the profile arrives.
   */
  const seedKey = user ? `${user.user_id}:${user.updated_at}` : null;
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (user && seedKey !== seededFrom) {
    setSeededFrom(seedKey);
    setValues({
      first_name: user.first_name,
      last_name: user.last_name,
      country_code: user.country_code,
      company_name: user.company_name ?? '',
    });
  }

  if (!user) return null;

  const isDirty =
    values.first_name !== user.first_name ||
    values.last_name !== user.last_name ||
    values.country_code !== user.country_code ||
    values.company_name !== (user.company_name ?? '');

  function update<K extends keyof ProfileValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    const nextErrors: FieldErrors<ProfileValues> = {
      first_name: validateName(values.first_name, 'First name'),
      last_name: validateName(values.last_name, 'Last name'),
      country_code: validateCountryCode(values.country_code),
      company_name: maxLength(values.company_name.trim(), 255, 'Company name'),
    };
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    setSubmitting(true);
    try {
      await updateProfile({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        country_code: values.country_code.trim().toUpperCase(),
        company_name: values.company_name.trim() || null,
      });
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as FieldErrors<ProfileValues>);
          setFormError('Please correct the highlighted fields.');
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

  function handleReset() {
    if (!user) return;
    setValues({
      first_name: user.first_name,
      last_name: user.last_name,
      country_code: user.country_code,
      company_name: user.company_name ?? '',
    });
    setErrors({});
    setFormError(null);
    setSaved(false);
  }

  return (
    <>
      <PageMeta title="Your profile" noIndex />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Editable details */}
        <CardSection
          title="Your details"
          description="These appear on your account and on anything you submit to us."
          headingLevel={2}
        >
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormError message={formError} />

            {saved ? (
              <Alert tone="success">
                <p>Your profile has been updated.</p>
              </Alert>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="First name"
                required
                autoComplete="given-name"
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

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Country code"
                required
                autoComplete="country"
                value={values.country_code}
                onChange={(event) => update('country_code', event.target.value.toUpperCase())}
                error={errors.country_code}
                hint="Two letters, for example GB."
                maxLength={10}
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

            <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-5">
              <Button
                type="submit"
                loading={submitting}
                loadingLabel="Saving"
                disabled={!isDirty}
              >
                Save changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                disabled={!isDirty || submitting}
              >
                Discard changes
              </Button>
            </div>
          </form>
        </CardSection>

        {/* Read-only account facts */}
        <div className="space-y-6">
          <CardSection
            title="Account"
            description="Managed for you and not editable here."
            headingLevel={2}
          >
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Email address
                </dt>
                <dd className="mt-1 break-anywhere text-ink-800">{user.email}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Verification
                </dt>
                <dd className="mt-1">
                  {user.email_verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Not verified</Badge>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Role
                </dt>
                <dd className="mt-1">
                  <Badge tone={user.role === 'USER' ? 'neutral' : 'brand'}>{user.role}</Badge>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Member since
                </dt>
                <dd className="mt-1 text-ink-800">{formatDateTime(user.created_at)}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Last sign-in
                </dt>
                <dd className="mt-1 text-ink-800">{formatDateTime(user.last_login_at)}</dd>
              </div>
            </dl>
          </CardSection>

          <CardSection title="Security" headingLevel={2}>
            <p className="text-sm leading-relaxed text-ink-600">
              To change your password, use the reset flow. It sends a one-time link to your email
              address, so a password can never be changed from a session alone.
            </p>
            <Link to={ROUTES.forgotPassword} className="btn-secondary btn-sm mt-4">
              Change password
            </Link>
          </CardSection>
        </div>
      </div>
    </>
  );
}
