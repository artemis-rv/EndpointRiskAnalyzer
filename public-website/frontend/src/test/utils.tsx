/**
 * test/utils.tsx
 * ──────────────
 * Helpers shared by the test suite: a render that supplies the router, query
 * client and auth provider, and a small fetch-response builder.
 */

import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthProvider';
import type { User } from '@/types/api';

/** Retries off and caching off, so tests are deterministic and fast. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  queryClient?: QueryClient;
  /** Skip the auth provider for tests that only need routing. */
  withAuth?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    queryClient = makeTestQueryClient(),
    withAuth = true,
    ...options
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const inner = withAuth ? <AuthProvider>{children}</AuthProvider> : children;
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{inner}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Build a Response-like object for a stubbed fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** A Response with no body, as returned by a 204. */
export function emptyResponse(status = 204): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => null,
    text: async () => '',
  } as unknown as Response;
}

/** A representative user record matching UserPublicResponse. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: '11111111-1111-4111-8111-111111111111',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    country_code: 'GB',
    company_name: 'Analytical Engines',
    role: 'USER',
    email_verified: true,
    email_verified_at: '2026-01-05T10:00:00Z',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-05T10:00:00Z',
    last_login_at: '2026-02-01T09:30:00Z',
    is_active: true,
    ...overrides,
  };
}

/** A paginated envelope matching PaginatedResponse. */
export function paginated<T>(items: T[], overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: items,
    total: items.length,
    page: 1,
    page_size: 20,
    has_next: false,
    has_prev: false,
    ...overrides,
  };
}
