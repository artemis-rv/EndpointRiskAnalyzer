/**
 * utils/queryState.ts
 * ───────────────────
 * Small predicates over query state.
 *
 * Kept out of the component file so that module exports only components, which
 * keeps fast refresh working during development.
 */

/**
 * True when a query is parked with nothing to show.
 *
 * `fetchStatus === 'paused'` with no data means the request is neither running
 * nor finished, so neither the loading nor the error state is reachable on its
 * own. Without treating this as its own case, the page shows a spinner that
 * never resolves and offers no way to recover.
 */
export function isStalled(fetchStatus: string, hasData: boolean): boolean {
  return fetchStatus === 'paused' && !hasData;
}
