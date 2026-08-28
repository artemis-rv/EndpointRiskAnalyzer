/**
 * hooks/useDocumentTitle.ts
 * ─────────────────────────
 * Announce route changes to assistive technology.
 *
 * A single-page app does not reload, so a screen reader is not told the page
 * changed. Moving focus to the main region on every navigation restores the
 * behaviour someone would get from a normal page load.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useRouteFocus(mainRef: React.RefObject<HTMLElement | null>) {
  const location = useLocation();

  useEffect(() => {
    // Skip the very first render: focusing on load would fight the browser's
    // own restoration and read the page out unprompted.
    if (location.key === 'default') return;
    const main = mainRef.current;
    if (!main) return;
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.key, location.pathname, mainRef]);
}
