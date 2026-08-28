/**
 * pages/admin/AdminDownloadsPage.tsx
 * ──────────────────────────────────
 * Download activity across all accounts.
 *
 * Backed by `GET /api/v1/admin/downloads`, added in Phase 6.12 and guarded by
 * `require_admin` server-side.
 *
 * The rows use `DownloadResponse` — the same schema an account sees for its own
 * history. The address and user agent stored on each record are collected for
 * abuse investigation and are deliberately not returned here either: a wider
 * audience is not a reason for a wider disclosure.
 */

import { PageMeta } from '@/components/seo/PageMeta';
import { useAdminDownloads } from '@/hooks/useAdmin';
import { usePagination } from '@/hooks/usePagination';
import {
  AdminPageHeader,
  EndpointUnavailable,
} from '@/components/admin/AdminPrimitives';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonTableRows } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge } from '@/components/common/Badge';
import { ChartIcon } from '@/components/common/Icons';
import { formatDateTime, isoDateAttr, shortId } from '@/utils/format';

export function AdminDownloadsPage() {
  const { page, pageSize, setPage } = usePagination(20);
  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch, endpointMissing } =
    useAdminDownloads(page, pageSize);

  const downloads = data?.data ?? [];

  return (
    <>
      <PageMeta title="Download activity" noIndex />

      <AdminPageHeader
        title="Downloads"
        description="Which releases have been obtained, by whom, and when."
      />

      {endpointMissing ? (
        <EndpointUnavailable
          path="/api/v1/admin/downloads"
          purpose="This backend build does not serve the administrative downloads endpoint. It was added in Phase 6.12, so a current backend will populate this table."
          expectedShape="PaginatedResponse[DownloadResponse] across all users — the same item schema as GET /api/v1/downloads/me, without the per-user restriction"
        />
      ) : isError ? (
        <div className="card">
          <ErrorState
            error={error}
            title="Unable to load download activity"
            onRetry={() => void refetch()}
          />
        </div>
      ) : isStalled(fetchStatus, data !== undefined) ? (
        <div className="card">
          <PausedState onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="card">
          {data !== undefined && downloads.length === 0 ? (
            <EmptyState
              icon={<ChartIcon className="h-6 w-6" />}
              title="No downloads recorded"
              description="Once accounts start downloading releases, the activity will appear here."
            />
          ) : (
            <>
              <div className="table-wrap !border-0">
                <table className="table">
                  <caption className="sr-only">
                    Download records showing the account, the release and when it was recorded.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Release</th>
                      <th scope="col">Recorded</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <SkeletonTableRows rows={6} columns={4} />
                    ) : (
                      downloads.map((download) => (
                        <tr key={download.download_id}>
                          <td>
                            <span className="font-mono text-xs" title={download.user_id}>
                              {shortId(download.user_id)}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-xs" title={download.release_id}>
                              {shortId(download.release_id)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap">
                            <time dateTime={isoDateAttr(download.downloaded_at)}>
                              {formatDateTime(download.downloaded_at)}
                            </time>
                          </td>
                          <td>
                            <Badge tone="neutral">{download.download_source}</Badge>
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
                  itemLabel="downloads"
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}
