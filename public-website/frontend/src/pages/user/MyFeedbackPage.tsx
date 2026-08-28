/**
 * pages/user/MyFeedbackPage.tsx
 * ─────────────────────────────
 * Submit feedback and follow what has already been submitted.
 *
 * Titles and descriptions are text the person wrote and the server stored. They
 * are rendered as text nodes; nothing on this page parses or injects HTML.
 */

import { PageMeta } from '@/components/seo/PageMeta';
import { useMyFeedback } from '@/hooks/useMyActivity';
import { usePagination } from '@/hooks/usePagination';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { CardSection } from '@/components/common/Card';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonList } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge, FeedbackStatusBadge } from '@/components/common/Badge';
import { ChatIcon, StarIcon } from '@/components/common/Icons';
import { FEEDBACK_TYPE_LABELS } from '@/constants/content';
import { formatDateTime, isoDateAttr } from '@/utils/format';

function RatingDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          filled={star <= rating}
          className={`h-4 w-4 ${star <= rating ? 'text-warning-500' : 'text-ink-300'}`}
        />
      ))}
      {/* The stars are decorative; this is the value that is actually read. */}
      <span className="sr-only">{rating} out of 5</span>
    </span>
  );
}

export function MyFeedbackPage() {
  const { page, pageSize, setPage } = usePagination(10);
  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useMyFeedback(
    page,
    pageSize,
  );

  const items = data?.data ?? [];

  return (
    <>
      <PageMeta title="Your feedback" noIndex />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <CardSection
          title="Share feedback"
          description="Report a bug, request a feature, or tell us how it is going."
          headingLevel={2}
        >
          <FeedbackForm />
        </CardSection>

        <section className="card" aria-labelledby="feedback-history">
          <header className="border-b border-ink-100 px-5 py-4 sm:px-6">
            <h2 id="feedback-history" className="heading-3">
              What you have submitted
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Statuses update as the team works through each item.
            </p>
          </header>

          <div className="p-5 sm:p-6">
            {isLoading ? (
              <SkeletonList rows={3} />
            ) : isError ? (
              <ErrorState
                error={error}
                title="Unable to load your feedback"
                onRetry={() => void refetch()}
              />
            ) : isStalled(fetchStatus, data !== undefined) ? (
              <PausedState onRetry={() => void refetch()} />
            ) : data !== undefined && items.length === 0 ? (
              <EmptyState
                icon={<ChatIcon className="h-6 w-6" />}
                title="No feedback yet"
                description="Anything you submit will appear here so you can follow its progress."
              />
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.feedback_id}>
                    <article className="rounded-lg border border-ink-200 p-4">
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-ink-900">{item.title}</h3>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            <span>{FEEDBACK_TYPE_LABELS[item.type] ?? item.type}</span>
                            <span aria-hidden="true">&middot;</span>
                            <time dateTime={isoDateAttr(item.created_at)}>
                              {formatDateTime(item.created_at)}
                            </time>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.featured ? <Badge tone="brand">Featured</Badge> : null}
                          <FeedbackStatusBadge status={item.status} />
                        </div>
                      </header>

                      {item.rating !== null ? (
                        <div className="mt-3">
                          <RatingDisplay rating={item.rating} />
                        </div>
                      ) : null}

                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                        {item.description}
                      </p>

                      {item.resolved_at ? (
                        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                          Resolved{' '}
                          <time dateTime={isoDateAttr(item.resolved_at)}>
                            {formatDateTime(item.resolved_at)}
                          </time>
                        </p>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data && items.length > 0 ? (
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              hasNext={data.has_next}
              hasPrev={data.has_prev}
              onPageChange={setPage}
              busy={isFetching}
              itemLabel="submissions"
            />
          ) : null}
        </section>
      </div>
    </>
  );
}
