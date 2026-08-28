/**
 * components/forms/ContactForm.tsx
 * ────────────────────────────────
 * Contact request form, shared by the public contact page and the account
 * requests page.
 *
 * `POST /api/v1/contact` requires an authenticated caller, so the form is only
 * rendered for a signed-in account. Field limits mirror the backend schema
 * (subject 255, message 10000, category from the ContactCategory enum) purely
 * so someone is told before the round trip, not because the client decides.
 */

import { useState } from 'react';
import { useSubmitContactRequest } from '@/hooks/useMyActivity';
import { ApiError } from '@/api/client/errors';
import { CONTACT_CATEGORY_LABELS } from '@/constants/content';
import { ContactCategory } from '@/types/api';
import type { FieldErrors } from '@/utils/validation';
import { isClean, maxLength, required } from '@/utils/validation';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { FormError, SelectField, TextAreaField, TextField } from './Fields';

interface ContactFormValues {
  subject: string;
  message: string;
  category: string;
}

const CATEGORY_OPTIONS = Object.values(ContactCategory).map((value) => ({
  value,
  label: CONTACT_CATEGORY_LABELS[value],
}));

const EMPTY: ContactFormValues = { subject: '', message: '', category: '' };

export function ContactForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [values, setValues] = useState<ContactFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<ContactFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = useSubmitContactRequest();

  function validate(next: ContactFormValues): FieldErrors<ContactFormValues> {
    return {
      subject: required(next.subject, 'Subject') ?? maxLength(next.subject.trim(), 255, 'Subject'),
      message:
        required(next.message, 'Message') ?? maxLength(next.message.trim(), 10000, 'Message'),
      category: required(next.category, 'Category'),
    };
  }

  function update<K extends keyof ContactFormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear a field error as soon as the person starts fixing it.
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    try {
      await submit.mutateAsync({
        subject: values.subject.trim(),
        message: values.message.trim(),
        category: values.category as ContactCategory,
      });
      setValues(EMPTY);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      if (error instanceof ApiError) {
        // Map server-side field errors back onto the inputs where they belong.
        const fieldErrors = error.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as FieldErrors<ContactFormValues>);
          setFormError('Please correct the highlighted fields.');
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  if (submitted) {
    return (
      <Alert tone="success" title="Message sent">
        <p>
          Your request has been logged and a person will reply. You can follow its status from your
          requests page.
        </p>
        <p className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setSubmitted(false)}>
            Send another message
          </Button>
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormError message={formError} />

      <SelectField
        label="Category"
        required
        placeholder="Choose a category"
        options={CATEGORY_OPTIONS}
        value={values.category}
        onChange={(event) => update('category', event.target.value)}
        error={errors.category}
        hint="Picking the right category gets your message to the right queue faster."
        disabled={submit.isPending}
      />

      <TextField
        label="Subject"
        required
        value={values.subject}
        onChange={(event) => update('subject', event.target.value)}
        error={errors.subject}
        maxLength={255}
        autoComplete="off"
        placeholder="A short summary of your question"
        disabled={submit.isPending}
      />

      <TextAreaField
        label="Message"
        required
        value={values.message}
        onChange={(event) => update('message', event.target.value)}
        error={errors.message}
        maxChars={10000}
        rows={8}
        placeholder="Tell us what you need. Include version numbers and what you have already tried, if that is relevant."
        disabled={submit.isPending}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={submit.isPending}
          loadingLabel="Sending"
        >
          Send message
        </Button>
        <p className="text-xs text-ink-500">
          Sent from your account, so you can track the reply.
        </p>
      </div>
    </form>
  );
}
