/**
 * pages/admin/AdminOverviewPage.tsx
 * ─────────────────────────────────
 * Admin landing page.
 *
 * Every figure shown is a real `total` returned by a real endpoint. Where a
 * count cannot be read the tile shows a dash rather than a zero, because
 * "unknown" and "none" must not look the same on a dashboard.
 */

import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { useAdminOverview } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { AdminPageHeader, StatTile } from '@/components/admin/AdminPrimitives';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { displayName } from '@/utils/format';
import {
  ChartIcon,
  ChatIcon,
  InboxIcon,
  PackageIcon,
  UsersIcon,
} from '@/components/common/Icons';

export function AdminOverviewPage() {
  const { user } = useAuth();
  const { totals, isLoading, isError, refetch } = useAdminOverview();

  return (
    <>
      <PageMeta title="Admin overview" noIndex />

      <AdminPageHeader
        title={`Welcome back, ${user ? displayName(user) : 'admin'}`}
        description="Everything below is read live from the API."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {isError ? (
        <Alert tone="danger" title="Some figures could not be loaded" className="mb-6">
          <p>
            One or more requests failed. The tiles below show what did load; anything missing is
            marked with a dash.
          </p>
          <p className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </p>
        </Alert>
      ) : null}

      {/* Live figures */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Releases"
          value={totals.releases}
          hint="All statuses, including drafts"
          to={ROUTES.adminReleases}
          loading={isLoading}
          icon={<PackageIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Feedback awaiting triage"
          value={totals.feedbackNew}
          hint={
            totals.feedback === null ? undefined : `${totals.feedback.toLocaleString()} in total`
          }
          to={ROUTES.adminFeedback}
          loading={isLoading}
          icon={<ChatIcon className="h-4 w-4" />}
          tone={totals.feedbackNew && totals.feedbackNew > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="New contact requests"
          value={totals.contactNew}
          hint={totals.contact === null ? undefined : `${totals.contact.toLocaleString()} in total`}
          to={ROUTES.adminContact}
          loading={isLoading}
          icon={<InboxIcon className="h-4 w-4" />}
          tone={totals.contactNew && totals.contactNew > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="Downloads recorded"
          value={totals.downloads}
          hint="Across every account"
          to={ROUTES.adminDownloads}
          loading={isLoading}
          icon={<ChartIcon className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Registered accounts"
          value={totals.users}
          hint="All roles"
          to={ROUTES.adminUsers}
          loading={isLoading}
          icon={<UsersIcon className="h-4 w-4" />}
        />
      </div>

      {/* What needs attention */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-body">
            <h2 className="heading-3">Where to start</h2>
            <p className="mt-1 text-sm text-ink-500">
              Queues that have items waiting on a decision.
            </p>

            <ul className="mt-5 space-y-3">
              <li className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">Feedback triage</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {isLoading
                      ? 'Checking…'
                      : totals.feedbackNew === null
                        ? 'Count unavailable'
                        : totals.feedbackNew === 0
                          ? 'Nothing waiting'
                          : `${totals.feedbackNew.toLocaleString()} item${
                              totals.feedbackNew === 1 ? '' : 's'
                            } in NEW`}
                  </p>
                </div>
                <Link to={ROUTES.adminFeedback} className="btn-secondary btn-sm shrink-0">
                  Open
                </Link>
              </li>

              <li className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">Contact requests</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {isLoading
                      ? 'Checking…'
                      : totals.contactNew === null
                        ? 'Count unavailable'
                        : totals.contactNew === 0
                          ? 'Nothing waiting'
                          : `${totals.contactNew.toLocaleString()} request${
                              totals.contactNew === 1 ? '' : 's'
                            } in NEW`}
                  </p>
                </div>
                <Link to={ROUTES.adminContact} className="btn-secondary btn-sm shrink-0">
                  Open
                </Link>
              </li>

              <li className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">Releases</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Create, publish and archive builds
                  </p>
                </div>
                <Link to={ROUTES.adminReleases} className="btn-secondary btn-sm shrink-0">
                  Open
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="heading-3">Sections</h2>
            <p className="mt-1 text-sm text-ink-500">Everything this area can do.</p>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { to: ROUTES.adminUsers, label: 'Users', Icon: UsersIcon },
                { to: ROUTES.adminReleases, label: 'Releases', Icon: PackageIcon },
                { to: ROUTES.adminDownloads, label: 'Downloads', Icon: ChartIcon },
                { to: ROUTES.adminFeedback, label: 'Feedback', Icon: ChatIcon },
                { to: ROUTES.adminContact, label: 'Contact requests', Icon: InboxIcon },
              ].map(({ to, label, Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="flex items-center gap-3 rounded-lg border border-ink-200 p-3 text-sm font-medium text-ink-800 transition-colors hover:border-admin-200 hover:bg-admin-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-admin-50 text-admin-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <Alert tone="info" className="mt-6">
              <p className="text-xs leading-relaxed">
                Every figure on this page is a live total from the API. Where a count cannot be
                read it shows a dash rather than a zero, because "unknown" and "none" are not the
                same thing.
              </p>
            </Alert>
          </div>
        </div>
      </section>
    </>
  );
}
