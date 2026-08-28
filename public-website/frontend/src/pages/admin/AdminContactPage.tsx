/**
 * pages/admin/AdminContactPage.tsx
 * ────────────────────────────────
 * Work through contact requests: take one on, mark it responded, close it.
 *
 * Two notes on what "respond" means here. The backend models a reply as a
 * status change plus an assignee (`AdminUpdateContactRequest` accepts `status`
 * and `handled_by_user_id`, nothing else) — there is no endpoint that sends
 * message text back to the person. So this screen tracks the handling of a
 * request and the actual reply goes out by email, which is exactly what the
 * API supports. Claiming otherwise in the interface would be a lie.
 *
 * Closing is irreversible in the backend state machine (CLOSED has no outward
 * transitions), so it is confirmed before it happens.
 */

import { useState } from 'react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useAdminContact, useUpdateContactRequest } from '@/hooks/useAdmin';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/hooks/useAuth';
import { CONTACT_TRANSITIONS } from '@/api/admin';
import { ApiError } from '@/api/client/errors';
import { ContactStatus } from '@/types/api';
import type { ContactRequest } from '@/types/api';
import { CONTACT_CATEGORY_LABELS, CONTACT_STATUS_LABELS } from '@/constants/content';
import { AdminPageHeader, StatusFilter } from '@/components/admin/AdminPrimitives';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonList } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge, ContactStatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { ConfirmDialog } from '@/components/common/Modal';
import { InboxIcon } from '@/components/common/Icons';
import { formatDateTime, isoDateAttr, shortId } from '@/utils/format';

const STATUS_OPTIONS = Object.values(ContactStatus).map((value) => ({
  value,
  label: CONTACT_STATUS_LABELS[value],
}));

export function AdminContactPage() {
  const { page, pageSize, setPage } = usePagination(10);
  const [status, setStatus] = useState<ContactStatus | undefined>();
  const { user } = useAuth();

  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useAdminContact(
    page,
    pageSize,
    status,
  );
  const updateRequest = useUpdateContactRequest();

  const [pendingClose, setPendingClose] = useState<ContactRequest | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requests = data?.data ?? [];

  async function changeStatus(request: ContactRequest, next: ContactStatus) {
    setBusyId(request.contact_request_id);
    try {
      await updateRequest.mutateAsync({
        id: request.contact_request_id,
        payload: {
          status: next,
          // Taking a request on assigns it to the admin doing so, unless it
          // already has an owner.
          ...(next === ContactStatus.IN_PROGRESS && !request.handled_by_user_id && user
            ? { handled_by_user_id: user.user_id }
            : {}),
        },
      });
      setBanner({ tone: 'success', text: `Moved to ${CONTACT_STATUS_LABELS[next]}.` });
    } catch (caught) {
      setBanner({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'The status could not be changed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmClose() {
    if (!pendingClose) return;
    const request = pendingClose;
    setPendingClose(null);
    await changeStatus(request, ContactStatus.CLOSED);
  }

  return (
    <>
      <PageMeta title="Contact requests" noIndex />

      <AdminPageHeader
        title="Contact requests"
        description="Take requests on, record that you have responded, and close them out."
      />

      <Alert tone="info" className="mb-5">
        <p className="text-sm leading-relaxed">
          This screen tracks how a request is handled. The API stores a status and an assignee, not
          reply text, so the reply itself goes out by email and is recorded here by moving the
          request to <span className="font-semibold">Responded</span>.
        </p>
      </Alert>

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
            title="Unable to load contact requests"
            onRetry={() => void refetch()}
          />
        </div>
      ) : isStalled(fetchStatus, data !== undefined) ? (
        <div className="card">
          <PausedState onRetry={() => void refetch()} />
        </div>
      ) : data !== undefined && requests.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<InboxIcon className="h-6 w-6" />}
            title={
              status ? `No requests in ${CONTACT_STATUS_LABELS[status]}` : 'No contact requests yet'
            }
            description={
              status
                ? 'Try a different status filter, or clear it to see everything.'
                : 'Requests sent through the contact form will appear here.'
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
            {requests.map((request) => {
              const allowed = CONTACT_TRANSITIONS[request.status] ?? [];
              const isBusy = busyId === request.contact_request_id;

              return (
                <li key={request.contact_request_id}>
                  <article className="card">
                    <div className="card-body">
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-semibold text-ink-900">
                            {request.subject}
                          </h2>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                            <span>
                              {CONTACT_CATEGORY_LABELS[request.category] ?? request.category}
                            </span>
                            <span aria-hidden="true">&middot;</span>
                            <time dateTime={isoDateAttr(request.created_at)}>
                              {formatDateTime(request.created_at)}
                            </time>
                            <span aria-hidden="true">&middot;</span>
                            <span title={`User ${request.user_id}`}>
                              user {shortId(request.user_id)}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {request.handled_by_user_id ? (
                            <Badge tone="neutral">
                              Assigned to {shortId(request.handled_by_user_id)}
                            </Badge>
                          ) : null}
                          <ContactStatusBadge status={request.status} />
                        </div>
                      </header>

                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                        {request.message}
                      </p>

                      {request.closed_at ? (
                        <p className="mt-3 text-xs text-ink-500">
                          Closed{' '}
                          <time dateTime={isoDateAttr(request.closed_at)}>
                            {formatDateTime(request.closed_at)}
                          </time>
                        </p>
                      ) : null}

                      <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
                        {allowed.length > 0 ? (
                          <>
                            <span className="text-xs font-semibold text-ink-500">Move to:</span>
                            {allowed.map((next) =>
                              next === ContactStatus.CLOSED ? (
                                <Button
                                  key={next}
                                  size="sm"
                                  variant="secondary"
                                  disabled={isBusy}
                                  onClick={() => setPendingClose(request)}
                                >
                                  Close
                                </Button>
                              ) : (
                                <Button
                                  key={next}
                                  size="sm"
                                  variant={next === ContactStatus.IN_PROGRESS ? 'admin' : 'secondary'}
                                  disabled={isBusy}
                                  onClick={() => void changeStatus(request, next)}
                                >
                                  {next === ContactStatus.IN_PROGRESS
                                    ? 'Take this on'
                                    : CONTACT_STATUS_LABELS[next]}
                                </Button>
                              ),
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-ink-500">
                            This request is closed and cannot be reopened from here.
                          </span>
                        )}
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
                itemLabel="requests"
              />
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pendingClose !== null}
        onCancel={() => setPendingClose(null)}
        onConfirm={confirmClose}
        busy={updateRequest.isPending}
        destructive
        title="Close this request?"
        message={
          pendingClose
            ? `"${pendingClose.subject}" will be marked closed. Closed requests cannot be reopened from this interface, so make sure the person has had their answer first.`
            : ''
        }
        confirmLabel="Close request"
      />
    </>
  );
}
