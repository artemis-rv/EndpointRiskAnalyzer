/**
 * api/client/http.test.ts
 * ───────────────────────
 * Tests for the HTTP layer: error mapping, auth header handling, the
 * refresh-and-retry path, and the guarantee that raw backend text never
 * reaches the user.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, onSessionExpired } from './http';
import { tokenStore } from './tokenStore';
import { ApiError } from './errors';
import { jsonResponse } from '@/test/utils';

function stubFetch(...responses: Response[]) {
  const mock = vi.fn();
  responses.forEach((response) => mock.mockResolvedValueOnce(response));
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('http client', () => {
  beforeEach(() => {
    tokenStore.clear();
  });

  it('returns the decoded body on success', async () => {
    stubFetch(jsonResponse({ message: 'ok' }));
    await expect(http.get('/health')).resolves.toEqual({ message: 'ok' });
  });

  it('does not send an Authorization header on public calls', async () => {
    tokenStore.setTokens('secret-access', 'secret-refresh', 900);
    const mock = stubFetch(jsonResponse({ data: [] }));

    await http.get('/releases');

    const headers = mock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends the bearer token on authenticated calls', async () => {
    tokenStore.setTokens('access-abc', 'refresh-abc', 900);
    const mock = stubFetch(jsonResponse({ user_id: '1' }));

    await http.get('/users/me', { auth: true });

    const headers = mock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-abc');
  });

  it('maps status codes to error kinds', async () => {
    const cases: [number, string][] = [
      [400, 'bad_request'],
      [403, 'forbidden'],
      [404, 'not_found'],
      [409, 'conflict'],
      [422, 'validation'],
      [429, 'rate_limited'],
      [500, 'server'],
      [503, 'unavailable'],
    ];

    for (const [status, kind] of cases) {
      stubFetch(jsonResponse({ success: false, error: 'Nope.' }, status));
      const error = await http.get('/thing').catch((caught) => caught);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe(kind);
    }
  });

  it('never surfaces a driver error or stack trace to the user', async () => {
    stubFetch(
      jsonResponse(
        {
          success: false,
          error:
            'psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "User_email_key"',
        },
        409,
      ),
    );

    const error = (await http.post('/auth/register', {}).catch((caught) => caught)) as ApiError;

    expect(error.message).not.toContain('psycopg2');
    expect(error.message).not.toContain('constraint');
    expect(error.message).toBe('That conflicts with something that already exists.');
  });

  it('surfaces a backend message when it reads as prose for a person', async () => {
    stubFetch(
      jsonResponse({ success: false, error: 'Email verification required.' }, 403),
    );

    const error = (await http.get('/downloads/me', { auth: true }).catch((c) => c)) as ApiError;
    expect(error.message).toBe('Email verification required.');
  });

  it('exposes 422 field errors for wiring back into a form', async () => {
    stubFetch(
      jsonResponse(
        {
          success: false,
          error: 'Validation failed.',
          details: [{ field: 'body.email', message: 'Not a valid email address.' }],
        },
        422,
      ),
    );

    const error = (await http.post('/auth/register', {}).catch((c) => c)) as ApiError;
    expect(error.fieldErrors.email).toBe('Not a valid email address.');
  });

  it('refreshes once on 401 and retries the original request', async () => {
    tokenStore.setTokens('expired-token', 'refresh-1', 900);

    const mock = vi.fn();
    // 1: original request rejected
    mock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Expired.' }, 401));
    // 2: refresh succeeds
    mock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 900 }),
    );
    // 3: retry succeeds
    mock.mockResolvedValueOnce(jsonResponse({ user_id: 'abc' }));
    global.fetch = mock as unknown as typeof fetch;

    await expect(http.get('/users/me', { auth: true })).resolves.toEqual({ user_id: 'abc' });

    expect(mock).toHaveBeenCalledTimes(3);
    // The retry carries the new token, not the expired one.
    const retryHeaders = mock.mock.calls[2][1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer fresh');
  });

  it('clears the session and notifies when the refresh is rejected', async () => {
    tokenStore.setTokens('expired-token', 'revoked-refresh', 900);

    const onExpired = vi.fn();
    const unsubscribe = onSessionExpired(onExpired);

    const mock = vi.fn();
    mock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Expired.' }, 401));
    mock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Revoked.' }, 401));
    global.fetch = mock as unknown as typeof fetch;

    await expect(http.get('/users/me', { auth: true })).rejects.toBeInstanceOf(ApiError);

    expect(onExpired).toHaveBeenCalled();
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();

    unsubscribe();
  });

  it('reports a network failure as a retryable error, not a crash', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as never;

    const error = (await http.get('/releases').catch((c) => c)) as ApiError;
    expect(error.kind).toBe('network');
    expect(error.isRetryable).toBe(true);
    expect(error.message).toContain('could not reach the server');
  });

  /**
   * Regression: a cancelled request must not be reported as a timeout.
   *
   * When the query layer cancels a fetch (component unmount, route change,
   * StrictMode remount) it needs to see an AbortError. If it is handed an
   * ordinary error instead, it discards the rejection as belonging to a
   * cancelled query and leaves the query with no data and no error — which the
   * page then renders as an empty state for a request that actually failed.
   */
  it('rethrows a caller cancellation as an AbortError, not a timeout', async () => {
    const controller = new AbortController();

    global.fetch = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch;

    const pending = http.get('/releases', { signal: controller.signal });
    controller.abort();

    const error = await pending.catch((caught) => caught);

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('reports its own timeout as a timeout error', async () => {
    global.fetch = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch;

    const error = (await http
      .get('/releases', { timeoutMs: 10 })
      .catch((caught) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('timeout');
  });

  it('refuses immediately when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const error = await http
      .get('/releases', { signal: controller.signal })
      .catch((caught) => caught);

    expect((error as Error).name).toBe('AbortError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops empty query parameters instead of sending them', async () => {
    const mock = stubFetch(jsonResponse({ data: [] }));

    await http.get('/admin/feedback', {
      query: { page: 1, page_size: 20, status: undefined },
    });

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('page_size=20');
    expect(url).not.toContain('status');
  });
});
