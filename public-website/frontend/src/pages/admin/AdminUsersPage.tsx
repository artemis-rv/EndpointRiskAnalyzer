/**
 * pages/admin/AdminUsersPage.tsx
 * ──────────────────────────────
 * User management.
 *
 * Backed by `GET /api/v1/admin/users`, added in Phase 6.12 and guarded by
 * `require_admin` server-side.
 *
 * The unavailable state is retained for the case of an older backend that does
 * not serve the route: a labelled explanation is more useful than a bare 404.
 * The response is `UserPublicResponse`, which carries no password hash and no
 * session material, so an admin sees no more about an account than the account
 * holder does.
 */

import { PageMeta } from '@/components/seo/PageMeta';
import { useAdminUsers } from '@/hooks/useAdmin';
import { usePagination } from '@/hooks/usePagination';
import {
  AdminPageHeader,
  EndpointUnavailable,
} from '@/components/admin/AdminPrimitives';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonTableRows } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge } from '@/components/common/Badge';
import { UsersIcon } from '@/components/common/Icons';
import { displayName, formatDate, formatDateTime, isoDateAttr } from '@/utils/format';

export function AdminUsersPage() {
  const { page, pageSize, setPage } = usePagination(20);
  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch, endpointMissing } =
    useAdminUsers(
    page,
    pageSize,
  );

  const users = data?.data ?? [];

  return (
    <>
      <PageMeta title="Manage users" noIndex />

      <AdminPageHeader
        title="Users"
        description="Registered accounts, their roles and their verification state."
      />

      {endpointMissing ? (
        <EndpointUnavailable
          path="/api/v1/admin/users"
          purpose="This backend build does not serve the administrative users endpoint. It was added in Phase 6.12, so a current backend will populate this table."
          expectedShape="PaginatedResponse[UserPublicResponse] — the same envelope and item schema already returned by GET /api/v1/users/me"
        />
      ) : isError ? (
        <div className="card">
          <ErrorState error={error} title="Unable to load users" onRetry={() => void refetch()} />
        </div>
      ) : isStalled(fetchStatus, data !== undefined) ? (
        <div className="card">
          <PausedState onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="card">
          {data !== undefined && users.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-6 w-6" />}
              title="No accounts to show"
              description="No registered accounts were returned."
            />
          ) : (
            <>
              <div className="table-wrap !border-0">
                <table className="table">
                  <caption className="sr-only">
                    Registered accounts with role, verification status and activity dates.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Role</th>
                      <th scope="col">Verified</th>
                      <th scope="col">Country</th>
                      <th scope="col">Registered</th>
                      <th scope="col">Last sign-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <SkeletonTableRows rows={6} columns={6} />
                    ) : (
                      users.map((account) => (
                        <tr key={account.user_id}>
                          <td>
                            <span className="block font-medium text-ink-900">
                              {displayName(account)}
                            </span>
                            <span className="mt-0.5 block break-anywhere text-xs text-ink-500">
                              {account.email}
                            </span>
                            {account.company_name ? (
                              <span className="mt-0.5 block text-xs text-ink-400">
                                {account.company_name}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <Badge tone={account.role === 'USER' ? 'neutral' : 'brand'}>
                              {account.role}
                            </Badge>
                          </td>
                          <td>
                            {account.email_verified ? (
                              <Badge tone="success">Verified</Badge>
                            ) : (
                              <Badge tone="warning">Pending</Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap">{account.country_code}</td>
                          <td className="whitespace-nowrap">
                            <time dateTime={isoDateAttr(account.created_at)}>
                              {formatDate(account.created_at)}
                            </time>
                          </td>
                          <td className="whitespace-nowrap">
                            {account.last_login_at ? (
                              <time dateTime={isoDateAttr(account.last_login_at)}>
                                {formatDateTime(account.last_login_at)}
                              </time>
                            ) : (
                              <span className="text-ink-400">Never</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {data ? (
                <Pagination
                  page={data.page}
                  pageSize={data.page_size}
                  total={data.total}
                  hasNext={data.has_next}
                  hasPrev={data.has_prev}
                  onPageChange={setPage}
                  busy={isFetching}
                  itemLabel="accounts"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}
