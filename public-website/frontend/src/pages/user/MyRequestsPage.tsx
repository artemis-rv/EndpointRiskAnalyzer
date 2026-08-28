/**
 * pages/user/MyRequestsPage.tsx
 * ─────────────────────────────
 * File a contact request and follow the ones already open.
 *
 * The request body is text the person wrote. It is rendered as a text node with
 * line breaks preserved, never as markup.
 */

import { PageMeta } from '@/components/seo/PageMeta';
import { useMyContactRequests } from '@/hooks/useMyActivity';
import { usePagination } from '@/hooks/usePagination';
import { ContactForm } from '@/components/forms/ContactForm';
import { CardSection } from '@/components/common/Card';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonList } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { ContactStatusBadge } from '@/components/common/Badge';
import { InboxIcon } from '@/components/common/Icons';
import { CONTACT_CATEGORY_LABELS } from '@/constants/content';
import { formatDateTime, isoDateAttr } from '@/utils/format';

export function MyRequestsPage() {
  const { page, pageSize, setPage } = usePagination(10);
  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useMyContactRequests(
    page,
    pageSize,
  );

  const requests = data?.data ?? [];

  return (
    <>
      <PageMeta title="Your contact requests" noIndex />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <CardSection
          title="Send a request"
          description="Pick the category that fits so it reaches the right queue."
          headingLevel={2}
        >
          <ContactForm />
        </CardSection>

        <section className="card" aria-labelledby="requests-history">
          <header className="border-b border-ink-100 px-5 py-4 sm:px-6">
            <h2 id="requests-history" className="heading-3">
              Your requests
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              A request stays open until the team closes it.
            </p>
          </header>

          <div className="p-5 sm:p-6">
            {isLoading ? (
              <SkeletonList rows={3} />
            ) : isError ? (
              <ErrorState
                error={error}
                title="Unable to load your requests"
                onRetry={() => void refetch()}
              />
            ) : isStalled(fetchStatus, data !== undefined) ? (
              <PausedState onRetry={() => void refetch()} />
            ) : data !== undefined && requests.length === 0 ? (
              <EmptyState
                icon={<InboxIcon className="h-6 w-6" />}
                title="No requests yet"
                description="Anything you send will appear here with its current status."
              />
            ) : (
              <ul className="space-y-4">
                {requests.map((request) => (
                  <li key={request.contact_request_id}>
                    <article className="rounded-lg border border-ink-200 p-4">
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-ink-900">
                            {request.subject}
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            <span>
                              {CONTACT_CATEGORY_LABELS[request.category] ?? request.category}
                            </span>
                            <span aria-hidden="true">&middot;</span>
                            <time dateTime={isoDateAttr(request.created_at)}>
                              {formatDateTime(request.created_at)}
                            </time>
                          </p>
                        </div>
                        <ContactStatusBadge status={request.status} />
                      </header>

                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                        {request.message}
                      </p>

                      {request.closed_at ? (
                        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                          Closed{' '}
                          <time dateTime={isoDateAttr(request.closed_at)}>
                            {formatDateTime(request.closed_at)}
                          </time>
                        </p>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data && requests.length > 0 ? (
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              hasNext={data.has_next}
              hasPrev={data.has_prev}
              onPageChange={setPage}
              busy={isFetching}
              itemLabel="requests"
            />
          ) : null}
        </section>
      </div>
    </>
  );
}
