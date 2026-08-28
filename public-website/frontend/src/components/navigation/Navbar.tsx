/**
 * components/navigation/Navbar.tsx
 * ────────────────────────────────
 * Primary site navigation for the public and authenticated user areas.
 *
 * Responsive behaviour: a horizontal bar from `lg` up, and a disclosure panel
 * below that. The mobile panel is a real button-controlled region with
 * aria-expanded, and it closes on navigation and on Escape.
 *
 * Administrative links never appear here. The admin area has its own shell, and
 * mixing the two would invite someone to treat this menu as the thing that
 * decides who is an admin.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { PRODUCT } from '@/constants/content';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import {
  ChevronDownIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
  XIcon,
} from '@/components/common/Icons';
import { displayName, initials } from '@/utils/format';

const PUBLIC_LINKS = [
  { to: ROUTES.features, label: 'Features' },
  { to: ROUTES.download, label: 'Download' },
  { to: ROUTES.docs, label: 'Docs' },
  { to: ROUTES.faq, label: 'FAQ' },
  { to: ROUTES.contact, label: 'Contact' },
];

const ACCOUNT_LINKS = [
  { to: ROUTES.profile, label: 'Profile' },
  { to: ROUTES.myDownloads, label: 'Downloads' },
  { to: ROUTES.myFeedback, label: 'Feedback' },
  { to: ROUTES.myRequests, label: 'Requests' },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  ].join(' ');
}

export function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const accountRef = useRef<HTMLDivElement>(null);

  // Any navigation closes both menus. Adjusted during render rather than in an
  // effect: the menus are derived from the current route, so resetting them
  // here avoids a second render pass and the flash of a menu left open.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileOpen(false);
    setAccountOpen(false);
  }

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  async function handleSignOut() {
    setAccountOpen(false);
    setMobileOpen(false);
    await logout();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to={ROUTES.home}
            className="flex shrink-0 items-center gap-2 rounded-lg text-ink-950"
            aria-label={`${PRODUCT.name} home`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <span className="text-base font-bold tracking-tight">{PRODUCT.name}</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-1" aria-label="Main">
            {PUBLIC_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop account area */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {isAuthenticated && user ? (
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  aria-controls="account-menu"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
                    aria-hidden="true"
                  >
                    {initials(user)}
                  </span>
                  <span className="max-w-[10rem] truncate">{displayName(user)}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-ink-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {accountOpen ? (
                  <div
                    id="account-menu"
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-60 animate-fade-in overflow-hidden rounded-card border border-ink-200 bg-white shadow-popover"
                  >
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {displayName(user)}
                      </p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                      {!user.email_verified ? (
                        <p className="mt-1.5 text-xs font-medium text-warning-700">
                          Email not verified
                        </p>
                      ) : null}
                    </div>

                    <div className="py-1">
                      {ACCOUNT_LINKS.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          role="menuitem"
                          className="block px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-50"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {/* Rendered for admins only as a convenience. The server,
                          not this condition, is what enforces admin access. */}
                      {isAdmin ? (
                        <Link
                          to={ROUTES.admin}
                          role="menuitem"
                          className="block border-t border-ink-100 px-4 py-2 text-sm font-medium text-admin-700 transition-colors hover:bg-admin-50"
                        >
                          Admin panel
                        </Link>
                      ) : null}
                    </div>

                    <div className="border-t border-ink-100 p-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <Link to={ROUTES.login} className="btn-ghost">
                  Sign in
                </Link>
                <Link to={ROUTES.register} className="btn-primary">
                  Create account
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
          >
            {mobileOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        hidden={!mobileOpen}
        className="border-t border-ink-200 bg-white lg:hidden"
      >
        <nav className="container-page space-y-1 py-4" aria-label="Main">
          {PUBLIC_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <div className="!mt-4 border-t border-ink-100 pt-4">
            {isAuthenticated && user ? (
              <>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {displayName(user)}
                </p>
                {ACCOUNT_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-3 text-sm font-medium ${
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                {isAdmin ? (
                  <NavLink
                    to={ROUTES.admin}
                    className="block rounded-lg px-3 py-3 text-sm font-semibold text-admin-700 hover:bg-admin-50"
                  >
                    Admin panel
                  </NavLink>
                ) : null}
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-2"
                  onClick={handleSignOut}
                  leadingIcon={<LogoutIcon className="h-4 w-4" />}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to={ROUTES.login} className="btn-secondary w-full">
                  Sign in
                </Link>
                <Link to={ROUTES.register} className="btn-primary w-full">
                  Create account
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
