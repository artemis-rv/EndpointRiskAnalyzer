/**
 * layouts/GuestLayout.tsx
 * ───────────────────────
 * Shell for the public marketing and authentication pages.
 *
 * Structure: Navbar → main → Footer, with a skip link ahead of the navigation
 * and a focusable <main> so route changes move focus the way a page load would.
 */

import { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/navigation/Footer';
import { SessionExpiredNotice } from '@/components/common/SessionExpiredNotice';
import { useRouteFocus } from '@/hooks/useDocumentTitle';

export function GuestLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteFocus(mainRef);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Navbar />
      <SessionExpiredNotice />

      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
