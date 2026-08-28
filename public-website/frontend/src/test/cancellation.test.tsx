/**
 * test/cancellation.test.tsx
 * ──────────────────────────
 * Regression cover for the interaction between request cancellation and the
 * query cache, using the real production query client rather than the relaxed
 * test one.
 *
 * The failure this guards against: a request that is cancelled and then fails
 * must still end up reported as a failure. If the cancellation is retried, or
 * the rejection is attributed to a query the cache has already abandoned, the
 * page is left with no data and no error and renders "there is nothing here"
 * for a request that in fact failed.
 */

import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '@/services/queryClient';
import { AuthProvider } from '@/context/AuthProvider';
import { DownloadPage } from '@/pages/public/DownloadPage';
import { tokenStore } from '@/api/client/tokenStore';
import { jsonResponse } from '@/test/utils';

function renderProduction(route = '/download') {
  const queryClient = createQueryClient();
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <DownloadPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe('a failing request under StrictMode double-mounting', () => {
  it('reports the failure instead of claiming there is nothing to show', async () => {
    tokenStore.clear();

    // Every attempt fails the way the live backend does when the release query
    // cannot run: a 503 from the endpoint's own guard.
    global.fetch = vi.fn(async () =>
      jsonResponse(
        { success: false, error: 'Releases data is temporarily unavailable.' },
        503,
      ),
    ) as unknown as typeof fetch;

    renderProduction();

    await waitFor(
      () => expect(screen.getByText(/unable to load releases/i)).toBeInTheDocument(),
      { timeout: 10_000 },
    );

    // The critical assertion: it must never say the list is empty.
    expect(screen.queryByText(/no releases are available yet/i)).not.toBeInTheDocument();
  }, 15_000);

  it('shows the empty state only when the server really answers with no rows', async () => {
    tokenStore.clear();

    global.fetch = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: [],
        total: 0,
        page: 1,
        page_size: 10,
        has_next: false,
        has_prev: false,
      }),
    ) as unknown as typeof fetch;

    renderProduction();

    expect(
      await screen.findByText(/no releases are available yet/i, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
  }, 15_000);
});
