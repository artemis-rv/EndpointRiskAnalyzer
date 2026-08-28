/**
 * components/common/Pagination.tsx
 * ────────────────────────────────
 * Pager driven by the backend envelope fields (`total`, `page`, `page_size`,
 * `has_next`, `has_prev`) rather than a locally guessed page count.
 *
 * Rendered as a <nav> with a label so it is reachable as a landmark, and the
 * current position is announced politely when it changes.
 */

import { Button } from './Button';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  /** Disables both controls while a fetch is in flight. */
  busy?: boolean;
  /** Plural noun for the summary line, e.g. "releases". */
  itemLabel?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  hasNext,
  hasPrev,
  onPageChange,
  busy = false,
  itemLabel = 'items',
}: PaginationProps) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      className="flex flex-col gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <p className="text-xs text-ink-500" aria-live="polite">
        Showing <span className="font-semibold text-ink-700">{first}</span> to{' '}
        <span className="font-semibold text-ink-700">{last}</span> of{' '}
        <span className="font-semibold text-ink-700">{total}</span> {itemLabel}
        <span className="hidden sm:inline">
          {' '}
          &middot; page {page} of {totalPages}
        </span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || busy}
          leadingIcon={<ChevronLeftIcon className="h-4 w-4" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || busy}
          trailingIcon={<ChevronRightIcon className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
