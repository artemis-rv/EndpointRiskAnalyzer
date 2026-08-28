/**
 * components/feedback/FeedbackForm.tsx
 * ────────────────────────────────────
 * Submit feedback.
 *
 * One backend rule shapes this form: `CreateFeedbackRequest` requires a rating
 * when the type is RATING and rejects one for every other type. The rating
 * field therefore appears and disappears with the type selection, so the form
 * cannot be filled in a shape the server would refuse.
 */

import { useState } from 'react';
import { useSubmitFeedback } from '@/hooks/useMyActivity';
import { ApiError } from '@/api/client/errors';
import { FEEDBACK_TYPE_LABELS } from '@/constants/content';
import { FeedbackType } from '@/types/api';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import {
  FormError,
  RatingField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/Fields';
import { isClean, maxLength, required, validateRating } from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

interface FeedbackValues {
  type: string;
  title: string;
  description: string;
  rating: number | null;
}

const TYPE_OPTIONS = Object.values(FeedbackType).map((value) => ({
  value,
  label: FEEDBACK_TYPE_LABELS[value],
}));

const EMPTY: FeedbackValues = { type: '', title: '', description: '', rating: null };

export function FeedbackForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [values, setValues] = useState<FeedbackValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<FeedbackValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = useSubmitFeedback();
  const isRating = values.type === FeedbackType.RATING;

  function update<K extends keyof FeedbackValues>(key: K, value: FeedbackValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      // Changing away from RATING must drop the rating, because the server
      // rejects a rating on any other type.
      if (key === 'type' && value !== FeedbackType.RATING) next.rating = null;
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors<FeedbackValues> = {
      type: required(values.type, 'Feedback type'),
      title: required(values.title, 'Title') ?? maxLength(values.title.trim(), 255, 'Title'),
      description:
        required(values.description, 'Description') ??
        maxLength(values.description.trim(), 10000, 'Description'),
      rating: isRating ? validateRating(values.rating) : undefined,
    };
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    try {
      await submit.mutateAsync({
        type: values.type as FeedbackType,
        title: values.title.trim(),
        description: values.description.trim(),
        // Omitted entirely unless the type is RATING.
        ...(isRating ? { rating: values.rating } : {}),
      });
      setValues(EMPTY);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as FieldErrors<FeedbackValues>);
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
      <Alert tone="success" title="Thank you">
        <p>
          Your feedback has been recorded and will be reviewed by the team. You can follow its
          status in the list below.
        </p>
        <p className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setSubmitted(false)}>
            Submit more feedback
          </Button>
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormError message={formError} />

      <SelectField
        label="Type of feedback"
        required
        placeholder="Choose a type"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={(event) => update('type', event.target.value)}
        error={errors.type}
        disabled={submit.isPending}
      />

      {isRating ? (
        <RatingField
          label="Your rating"
          required
          value={values.rating}
          onChange={(rating) => update('rating', rating)}
          error={errors.rating}
          hint="1 is poor, 5 is excellent."
          disabled={submit.isPending}
        />
      ) : null}

      <TextField
        label="Title"
        required
        value={values.title}
        onChange={(event) => update('title', event.target.value)}
        error={errors.title}
        maxLength={255}
        placeholder="A one-line summary"
        disabled={submit.isPending}
      />

      <TextAreaField
        label="Description"
        required
        value={values.description}
        onChange={(event) => update('description', event.target.value)}
        error={errors.description}
        maxChars={10000}
        rows={7}
        placeholder="For a bug, tell us what you expected, what happened instead, and which version you are running."
        disabled={submit.isPending}
      />

      <Button type="submit" loading={submit.isPending} loadingLabel="Submitting">
        Submit feedback
      </Button>
    </form>
  );
}
