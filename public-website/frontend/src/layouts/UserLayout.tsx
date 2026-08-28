/**
 * layouts/UserLayout.tsx
 * ──────────────────────
 * Shell for the signed-in account area.
 *
 * Keeps the public navbar so the site still feels like one product, and adds a
 * secondary account navigation plus the verification banner. The account nav is
 * a scrollable tab strip on narrow screens rather than a second hamburger.
 */

import { useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/navigation/Footer';
import { SessionExpiredNotice } from '@/components/common/SessionExpiredNotice';
import { VerificationBanner } from '@/components/common/VerificationBanner';
import { useRouteFocus } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { displayName } from '@/utils/format';
import { ChatIcon, DownloadIcon, InboxIcon, UserIcon } from '@/components/common/Icons';

const ACCOUNT_NAV = [
  { to: ROUTES.profile, label: 'Profile', Icon: UserIcon },
  { to: ROUTES.myDownloads, label: 'Downloads', Icon: DownloadIcon },
  { to: ROUTES.myFeedback, label: 'Feedback', Icon: ChatIcon },
  { to: ROUTES.myRequests, label: 'Requests', Icon: InboxIcon },
];

export function UserLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteFocus(mainRef);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-ink-50/50">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Navbar />
      <SessionExpiredNotice />

      {/* Account header + secondary navigation */}
      <div className="border-b border-ink-200 bg-white">
        <div className="container-page pt-6">
          <p className="eyebrow">Your account</p>
          <h1 className="heading-2 mt-1">{user ? displayName(user) : 'Account'}</h1>
          {user ? <p className="mt-1 text-sm text-ink-500">{user.email}</p> : null}

          <nav
            className="-mb-px mt-5 flex gap-1 overflow-x-auto"
            aria-label="Account sections"
          >
            {ACCOUNT_NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 focus:outline-none"
      >
        <div className="container-page py-8">
          <VerificationBanner />
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
