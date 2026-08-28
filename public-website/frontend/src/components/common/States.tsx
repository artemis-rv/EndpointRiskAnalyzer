/**
 * components/common/States.tsx
 * ────────────────────────────
 * The four states every API-driven view must be able to show.
 *
 * Having them as components rather than ad-hoc markup is what stops a page
 * shipping with three of the four handled. `AsyncBoundary` composes them so a
 * list view can express all four in a single expression.
 */

import type { ReactNode } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { AlertIcon, InboxIcon } from './Icons';
import { toUserMessage } from '@/api/client/errors';

// ── Loading ─────────────────────────────────────────────────────────────────

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-7 w-7 text-brand-600" />
      <p className="text-sm text-ink-500">{label}…</p>
    </div>
  );
}

/** Layout-preserving placeholder for content-shaped regions. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card">
          <div className="card-body space-y-3">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex}>
              <div className="skeleton h-3.5 w-full max-w-[10rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty ───────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? <InboxIcon className="h-6 w-6" />}
      </span>
      <div>
        <p className="font-semibold text-ink-800">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ── Error ───────────────────────────────────────────────────────────────────

export interface ErrorStateProps {
  /** The thrown value. Converted to a safe sentence; never rendered raw. */
  error?: unknown;
  title?: string;
  /** Overrides the derived message entirely. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const text = message ?? toUserMessage(error);

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
      role="alert"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertIcon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-ink-800">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{text}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Shown when the query layer has parked a request instead of running it,
 * because it believes there is no connection.
 *
 * This state exists so that a parked request can never present as an endless
 * spinner. A person is told what is happening and given a way to act on it.
 */
export function PausedState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="No connection to the server"
      message="This request is waiting for a connection. Check that you are online, then try again."
      onRetry={onRetry}
    />
  );
}

// ── Composition ─────────────────────────────────────────────────────────────

export interface AsyncBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  /**
   * Whether the server has actually answered. Emptiness is only claimed when
   * this is true — see the note in the component.
   */
  hasLoaded: boolean;
  /**
   * The request is parked rather than in flight — the query layer is holding it
   * because it believes there is no connection. Without surfacing this, the
   * page shows a spinner that never resolves.
   */
  isPaused?: boolean;
  /** True when the request succeeded but returned no rows. */
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  errorTitle?: string;
  children: ReactNode;
}

/**
 * Renders exactly one of loading / error / empty / content.
 *
 * Two rules that are easy to get wrong:
 *
 *  1. An error wins over emptiness. A failed request has no rows, but "the
 *     request failed" and "there is nothing here" are different things and the
 *     person needs to be told which.
 *
 *  2. Emptiness is only ever claimed when the server has actually answered.
 *     Inferring "empty" from the absence of data means any request that has not
 *     resolved — or was cancelled and left the cache with neither data nor
 *     error — gets reported as "nothing exists". That is a confident statement
 *     of something we do not know, and it is the worst of the four states to
 *     get wrong: it looks like a normal, successful, reassuring answer.
 */
export function AsyncBoundary({
  isLoading,
  isError,
  error,
  hasLoaded,
  isPaused = false,
  isEmpty = false,
  onRetry,
  loadingFallback,
  emptyFallback,
  errorTitle,
  children,
}: AsyncBoundaryProps) {
  if (isError) return <ErrorState error={error} onRetry={onRetry} title={errorTitle} />;

  // A parked request is not loading and never will be until something changes.
  // Saying so, with a way to retry, is the difference between a recoverable
  // situation and a spinner that never resolves.
  if (isPaused && !hasLoaded) {
    return (
      <ErrorState
        title="No connection to the server"
        message="The request is waiting for a connection. Check that you are online, then try again."
        onRetry={onRetry}
      />
    );
  }

  if (isLoading || !hasLoaded) return <>{loadingFallback ?? <LoadingState />}</>;
  if (isEmpty) return <>{emptyFallback ?? <EmptyState title="Nothing to show yet" />}</>;
  return <>{children}</>;
}
