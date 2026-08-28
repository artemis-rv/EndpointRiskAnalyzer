/**
 * hooks/usePagination.ts
 * ──────────────────────
 * Page state kept in the URL query string.
 *
 * Putting it in the URL rather than component state means a paginated view can
 * be linked to and survives a back-navigation. Only the page number goes in the
 * URL — never an identifier that would leak into history or a referrer header.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const DEFAULT_PAGE_SIZE = 20;

export function usePagination(pageSize: number = DEFAULT_PAGE_SIZE) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => {
    const raw = Number.parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(raw) && raw >= 1 ? raw : 1;
  }, [searchParams]);

  const setPage = useCallback(
    (next: number) => {
      const safe = Math.max(1, Math.floor(next));
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (safe === 1) params.delete('page');
          else params.set('page', String(safe));
          return params;
        },
        { replace: false },
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams],
  );

  return { page, pageSize, setPage };
}
