/**
 * pages/public/DownloadPage.tsx
 * ─────────────────────────────
 * Public release listing.
 *
 * Reads `GET /releases` (published releases only, paginated). All four states
 * are handled, and the pager is driven by the backend envelope rather than a
 * locally computed page count.
 *
 * The `?release=<id>` query parameter expands one release in place. It holds an
 * identifier that is already public, and nothing sensitive is ever put in a URL.
 */

import { useSearchParams } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { useReleases } from '@/hooks/useReleases';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/hooks/useAuth';
import { ReleaseCard } from '@/components/releases/ReleaseCard';
import { Pagination } from '@/components/common/Pagination';
import { AsyncBoundary, EmptyState, SkeletonList } from '@/components/common/States';
import { Alert } from '@/components/common/Alert';
import { PackageIcon } from '@/components/common/Icons';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

export function DownloadPage() {
  const { page, pageSize, setPage } = usePagination(10);
  const [searchParams] = useSearchParams();
  const expandedId = searchParams.get('release');
  const { isAuthenticated, isEmailVerified } = useAuth();

  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } =
    useReleases(page, pageSize);
  const releases = data?.data ?? [];

  return (
    <>
      <PageMeta
        title="Download"
        description="Download RiskIntel. Every release is published with its version, release notes, file size and SHA-256 checksum."
        canonicalPath="/download"
      />

      {/* Header */}
      <section className="border-b border-ink-200 bg-ink-50">
        <div className="container-page py-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Downloads</p>
            <h1 className="heading-1 mt-3">Get RiskIntel</h1>
            <p className="lede mt-4">
              Every published release below carries its full notes and a SHA-256 checksum. Verify
              the file you receive against the checksum before you run it.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          {/* Requirements, stated before anyone clicks. */}
          {!isAuthenticated ? (
            <Alert tone="info" title="An account is needed to download" className="mb-8">
              <p>
                Release details are public. Recording a download needs a signed-in account with a
                verified email address, which keeps an auditable record of who obtained each build.
              </p>
              <p className="mt-3 flex flex-wrap gap-3">
                <Link to={ROUTES.login} state={{ from: ROUTES.download }} className="btn-primary btn-sm">
                  Sign in
                </Link>
                <Link to={ROUTES.register} className="btn-secondary btn-sm">
                  Create an account
                </Link>
              </p>
            </Alert>
          ) : !isEmailVerified ? (
            <Alert tone="warning" title="Verify your email to download" className="mb-8">
              <p>
                Your account is signed in but the email address is not verified yet. Open the
                verification link we sent you, then come back to this page.
              </p>
            </Alert>
          ) : null}

          <AsyncBoundary
            isLoading={isLoading}
            isError={isError}
            error={error}
            // "Empty" is only claimed once the server has actually answered.
            hasLoaded={data !== undefined}
            isPaused={fetchStatus === 'paused'}
            isEmpty={releases.length === 0}
            onRetry={() => void refetch()}
            errorTitle="Unable to load releases"
            loadingFallback={<SkeletonList rows={3} />}
            emptyFallback={
              <div className="card">
                <EmptyState
                  icon={<PackageIcon className="h-6 w-6" />}
                  title="No releases are available yet"
                  description="Nothing has been published so far. Check back soon, or contact us to be told when the first build lands."
                  action={
                    <Link to={ROUTES.contact} className="btn-secondary btn-sm">
                      Contact us
                    </Link>
                  }
                />
              </div>
            }
          >
            <div className="space-y-6">
              {releases.map((release) => (
                <ReleaseCard
                  key={release.release_id}
                  release={release}
                  expanded={expandedId === release.release_id}
                />
              ))}
            </div>

            {data ? (
              <div className="mt-6 rounded-card border border-ink-200 bg-white">
                <Pagination
                  page={data.page}
                  pageSize={data.page_size}
                  total={data.total}
                  hasNext={data.has_next}
                  hasPrev={data.has_prev}
                  onPageChange={setPage}
                  busy={isFetching}
                  itemLabel="releases"
                />
              </div>
            ) : null}
          </AsyncBoundary>

          {/* Verification guidance */}
          <div className="mt-12 panel">
            <h2 className="heading-3">Verifying your download</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-600">
              Compute the checksum of the file you received and compare it, character for
              character, with the value shown on the release. If they differ, do not run the file.
            </p>
            <ul className="mt-4 space-y-2 font-mono text-xs text-ink-700">
              <li className="break-anywhere">
                <span className="font-sans font-semibold text-ink-500">Windows: </span>
                certutil -hashfile riskintel-setup.exe SHA256
              </li>
              <li className="break-anywhere">
                <span className="font-sans font-semibold text-ink-500">Linux: </span>
                sha256sum riskintel-setup.tar.gz
              </li>
              <li className="break-anywhere">
                <span className="font-sans font-semibold text-ink-500">macOS: </span>
                shasum -a 256 riskintel-setup.pkg
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
