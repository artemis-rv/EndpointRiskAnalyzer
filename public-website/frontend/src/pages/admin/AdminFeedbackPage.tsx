/**
 * pages/admin/AdminFeedbackPage.tsx
 * ─────────────────────────────────
 * Review feedback, move it through its statuses, and mark testimonials as
 * featured.
 *
 * The status control offers only the transitions the backend will accept,
 * mirrored from `_VALID_TRANSITIONS` in feedback_service.py. That mirror is a
 * convenience so an admin is not shown a move that will fail — the server still
 * validates every transition and answers 422 for an illegal one.
 *
 * Titles and descriptions are text written by users. They are rendered as text.
 */

import { useState } from 'react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useAdminFeedback, useUpdateFeedback } from '@/hooks/useAdmin';
import { usePagination } from '@/hooks/usePagination';
import { FEEDBACK_TRANSITIONS } from '@/api/admin';
import { ApiError } from '@/api/client/errors';
import { FeedbackStatus } from '@/types/api';
import type { Feedback } from '@/types/api';
import { FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS } from '@/constants/content';
import { AdminPageHeader, StatusFilter } from '@/components/admin/AdminPrimitives';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonList } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge, FeedbackStatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { ConfirmDialog } from '@/components/common/Modal';
import { ChatIcon, StarIcon } from '@/components/common/Icons';
import { formatDateTime, isoDateAttr, shortId } from '@/utils/format';

const STATUS_OPTIONS = Object.values(FeedbackStatus).map((value) => ({
  value,
  label: FEEDBACK_STATUS_LABELS[value],
}));

/** A featured item is shown publicly, so the change is confirmed first. */
interface PendingFeature {
  feedback: Feedback;
  next: boolean;
}

export function AdminFeedbackPage() {
  const { page, pageSize, setPage } = usePagination(10);
  const [status, setStatus] = useState<FeedbackStatus | undefined>();

  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useAdminFeedback(
    page,
    pageSize,
    status,
  );
  const updateFeedback = useUpdateFeedback();

  const [pendingFeature, setPendingFeature] = useState<PendingFeature | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = data?.data ?? [];

  async function changeStatus(item: Feedback, next: FeedbackStatus) {
    setBusyId(item.feedback_id);
    try {
      await updateFeedback.mutateAsync({ id: item.feedback_id, payload: { status: next } });
      setBanner({
        tone: 'success',
        text: `Moved to ${FEEDBACK_STATUS_LABELS[next]}.`,
      });
    } catch (caught) {
      setBanner({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'The status could not be changed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function applyFeature() {
    if (!pendingFeature) return;
    const { feedback, next } = pendingFeature;
    setBusyId(feedback.feedback_id);
    try {
      await updateFeedback.mutateAsync({
        id: feedback.feedback_id,
        payload: { featured: next },
      });
      setBanner({
        tone: 'success',
        text: next
          ? 'Approved for public display.'
          : 'Removed from public display.',
      });
    } catch (caught) {
      setBanner({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'The change could not be applied.',
      });
    } finally {
      setBusyId(null);
      setPendingFeature(null);
    }
  }

  return (
    <>
      <PageMeta title="Review feedback" noIndex />

      <AdminPageHeader
        title="Feedback"
        description="Triage what people have sent, move it through review, and approve testimonials."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <StatusFilter
          label="Filter by status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          disabled={isFetching}
        />
        {data ? (
          <p className="text-xs text-ink-500" aria-live="polite">
            {data.total.toLocaleString()} matching
          </p>
        ) : null}
      </div>

      {banner ? (
        <Alert tone={banner.tone} className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <p>{banner.text}</p>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="shrink-0 text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <div className="card">
          <ErrorState
            error={error}
            title="Unable to load feedback"
            onRetry={() => void refetch()}
          />
        </div>
      ) : isStalled(fetchStatus, data !== undefined) ? (
        <div className="card">
          <PausedState onRetry={() => void refetch()} />
        </div>
      ) : data !== undefined && items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ChatIcon className="h-6 w-6" />}
            title={status ? `No feedback in ${FEEDBACK_STATUS_LABELS[status]}` : 'No feedback yet'}
            description={
              status
                ? 'Try a different status filter, or clear it to see everything.'
                : 'Feedback submitted by users will appear here for review.'
            }
            action={
              status ? (
                <Button variant="secondary" size="sm" onClick={() => setStatus(undefined)}>
                  Clear filter
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {items.map((item) => {
              const allowed = FEEDBACK_TRANSITIONS[item.status] ?? [];
              const isBusy = busyId === item.feedback_id;

              return (
                <li key={item.feedback_id}>
                  <article className="card">
                    <div className="card-body">
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-semibold text-ink-900">
                            {item.title}
                          </h2>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                            <span>{FEEDBACK_TYPE_LABELS[item.type] ?? item.type}</span>
                            <span aria-hidden="true">&middot;</span>
                            <time dateTime={isoDateAttr(item.created_at)}>
                              {formatDateTime(item.created_at)}
                            </time>
                            <span aria-hidden="true">&middot;</span>
                            <span title={`User ${item.user_id}`}>
                              user {shortId(item.user_id)}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {item.featured ? <Badge tone="brand">Featured</Badge> : null}
                          <FeedbackStatusBadge status={item.status} />
                        </div>
                      </header>

                      {item.rating !== null ? (
                        <p className="mt-3 inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <StarIcon
                              key={star}
                              filled={star <= (item.rating ?? 0)}
                              className={`h-4 w-4 ${
                                star <= (item.rating ?? 0) ? 'text-warning-500' : 'text-ink-300'
                              }`}
                            />
                          ))}
                          <span className="sr-only">{item.rating} out of 5</span>
                        </p>
                      ) : null}

                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                        {item.description}
                      </p>

                      <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
                        {allowed.length > 0 ? (
                          <>
                            <span className="text-xs font-semibold text-ink-500">Move to:</span>
                            {allowed.map((next) => (
                              <Button
                                key={next}
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={() => void changeStatus(item, next)}
                              >
                                {FEEDBACK_STATUS_LABELS[next]}
                              </Button>
                            ))}
                          </>
                        ) : (
                          <span className="text-xs text-ink-500">
                            This item is in a final status and cannot be moved again.
                          </span>
                        )}

                        <span className="ml-auto">
                          <Button
                            size="sm"
                            variant={item.featured ? 'secondary' : 'admin'}
                            disabled={isBusy}
                            onClick={() =>
                              setPendingFeature({ feedback: item, next: !item.featured })
                            }
                          >
                            {item.featured ? 'Remove from public' : 'Approve for public display'}
                          </Button>
                        </span>
                      </footer>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          {data ? (
            <div className="mt-6 card">
              <Pagination
                page={data.page}
                pageSize={data.page_size}
                total={data.total}
                hasNext={data.has_next}
                hasPrev={data.has_prev}
                onPageChange={setPage}
                busy={isFetching}
                itemLabel="items"
              />
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pendingFeature !== null}
        onCancel={() => setPendingFeature(null)}
        onConfirm={applyFeature}
        busy={updateFeedback.isPending}
        title={
          pendingFeature?.next ? 'Approve for public display?' : 'Remove from public display?'
        }
        message={
          pendingFeature?.next
            ? 'This marks the submission as featured, which flags it for public display. Read it once more and check it contains nothing the author would not want shown publicly.'
            : 'This clears the featured flag so the submission is no longer marked for public display.'
        }
        confirmLabel={pendingFeature?.next ? 'Approve' : 'Remove'}
        destructive={pendingFeature?.next === false}
      />
    </>
  );
}
