/**
 * services/queryClient.ts
 * ───────────────────────
 * Query cache configuration.
 *
 * Caching policy is deliberately conservative:
 *   - reads are de-duplicated and reused for a short window, which is what
 *     removes repeat requests when several components need the same release
 *   - a 401/403/404 is never retried, because retrying cannot change the answer
 *     and a retry loop on an expired session is just noise
 *   - nothing is persisted to disk or storage, so no cached response outlives
 *     the tab
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiError, isCancellation } from '@/api/client/errors';

/** Statuses where another attempt is pointless. */
const NON_RETRYABLE = new Set([400, 401, 403, 404, 409, 422, 429]);

/**
 * Shared retry policy.
 *
 * The cancellation check has to come first, and it matters more than it looks.
 * A cancelled request is not a failed one — the caller withdrew interest — and
 * retrying it keeps a query alive that the cache has already marked cancelled.
 * The eventual answer then arrives for a query nobody is tracking, so it is
 * discarded: no data, and no error either. A page reading that state sees an
 * empty result and renders an empty state for a request that in fact failed.
 * StrictMode makes this happen on every mount in development, so it is not a
 * rare edge case.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isCancellation(error)) return false;
  if (error instanceof ApiError && NON_RETRYABLE.has(error.status)) return false;
  return failureCount < 2;
}

/**
 * Attempt requests regardless of what the browser claims about connectivity.
 *
 * By default the query layer gates fetching on `navigator.onLine`: when that
 * reads false it parks the query in a `paused` state instead of failing it.
 * A paused query has no data and no error, so a page waiting on it shows a
 * loading state that never resolves and offers no way to recover — a failure
 * that is invisible and unrecoverable at the same time.
 *
 * `navigator.onLine` is not trustworthy for this decision. It reports a guess
 * about internet reachability, not about whether *our API* is reachable, and it
 * reads false in plenty of situations where the backend is perfectly available:
 * a machine on a LAN with no route to the internet, an air-gapped deployment,
 * a container network, an embedded webview. This product is expected to be
 * deployed inside private networks, which is exactly where that guess is wrong.
 *
 * With `always`, requests are attempted and genuine failures surface as errors
 * the person can see and retry. A real network outage then shows the network
 * error state, which is honest and actionable, rather than an endless spinner.
 */
const NETWORK_MODE = 'always' as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough to de-duplicate a burst of mounts, short enough that a
        // freshly published release shows up without a hard reload.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        networkMode: NETWORK_MODE,
      },
      mutations: {
        // A mutation is a side effect. Retrying one automatically risks doing
        // it twice, so the person decides whether to try again.
        retry: false,
        networkMode: NETWORK_MODE,
      },
    },
  });
}
