/**
 * pages/user/MyDownloadsPage.tsx
 * ──────────────────────────────
 * The signed-in account's download history.
 *
 * `DownloadResponse` carries only `release_id`, not the version or title. To
 * show something readable, one page of public releases is fetched and used as a
 * lookup table — a single extra request, rather than one request per row. A
 * download whose release is no longer listed still renders, identified by its
 * release id, instead of vanishing from the person's own history.
 *
 * The network address and browser recorded server-side are not returned by the
 * API and so cannot appear here, which is the intended privacy behaviour.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { useMyDownloads } from '@/hooks/useMyActivity';
import { useReleases } from '@/hooks/useReleases';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonTableRows } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge } from '@/components/common/Badge';
import { DownloadIcon } from '@/components/common/Icons';
import { formatDateTime, isoDateAttr, shortId } from '@/utils/format';

export function MyDownloadsPage() {
  const { page, pageSize, setPage } = usePagination(20);
  const { isEmailVerified } = useAuth();

  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useMyDownloads(
    page,
    pageSize,
    // The endpoint requires a verified address; asking without one would only
    // produce a 403 we would then have to explain away.
    isEmailVerified,
  );

  // One request, used as a lookup table for every row on the page.
  const { data: releasesPage } = useReleases(1, 100);

  const releaseLookup = useMemo(() => {
    const map = new Map<string, { version: string; title: string }>();
    for (const release of releasesPage?.data ?? []) {
      map.set(release.release_id, { version: release.version, title: release.title });
    }
    return map;
  }, [releasesPage]);

  const downloads = data?.data ?? [];

  if (!isEmailVerified) {
    return (
      <>
        <PageMeta title="Your downloads" noIndex />
        <div className="card">
          <EmptyState
            icon={<DownloadIcon className="h-6 w-6" />}
            title="Verify your email to see your downloads"
            description="Download history becomes available once your email address is verified. Open the verification link we emailed you."
            action={
              <Link to={ROUTES.download} className="btn-secondary btn-sm">
                Browse releases
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Your downloads" noIndex />

      <section className="card" aria-labelledby="downloads-heading">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="downloads-heading" className="heading-3">
              Download history
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Every release recorded against your account, newest first.
            </p>
          </div>
          <Link to={ROUTES.download} className="btn-primary btn-sm">
            <DownloadIcon className="h-4 w-4" />
            Get a release
          </Link>
        </header>

        {isError ? (
          <ErrorState
            error={error}
            title="Unable to load your downloads"
            onRetry={() => void refetch()}
          />
        ) : isStalled(fetchStatus, data !== undefined) ? (
          <PausedState onRetry={() => void refetch()} />
        ) : data !== undefined && downloads.length === 0 ? (
          <EmptyState
            icon={<DownloadIcon className="h-6 w-6" />}
            title="You have not downloaded anything yet"
            description="When you download a release it will appear here, with the date it was recorded."
            action={
              <Link to={ROUTES.download} className="btn-primary btn-sm">
                Browse releases
              </Link>
            }
          />
        ) : (
          <>
            <div className="table-wrap !rounded-none !border-x-0 !border-t-0">
              <table className="table">
                <caption className="sr-only">
                  Your download history, showing the release, when it was recorded and where the
                  download came from.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Release</th>
                    <th scope="col">Downloaded</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonTableRows rows={5} columns={3} />
                  ) : (
                    downloads.map((download) => {
                      const release = releaseLookup.get(download.release_id);
                      return (
                        <tr key={download.download_id}>
                          <td>
                            {release ? (
                              <>
                                <span className="font-medium text-ink-900">{release.title}</span>
                                <span className="mt-0.5 block font-mono text-xs text-ink-500">
                                  v{release.version}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-ink-900">
                                  Release {shortId(download.release_id)}
                                </span>
                                <span className="mt-0.5 block text-xs text-ink-500">
                                  No longer listed publicly
                                </span>
                              </>
                            )}
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
                      );
                    })
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
      </section>
    </>
  );
}
