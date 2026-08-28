/**
 * test/integration.test.tsx
 * ─────────────────────────
 * Flows across components: sign-in, registration, release listing, the download
 * action, feedback submission and contact submission.
 *
 * Each test stubs the API at the fetch boundary, so the real API modules, the
 * real HTTP client and the real components all take part.
 */

import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DownloadPage } from '@/pages/public/DownloadPage';
import { ContactForm } from '@/components/forms/ContactForm';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { tokenStore } from '@/api/client/tokenStore';
import { jsonResponse, makeUser, paginated, renderWithProviders } from '@/test/utils';
import type { Release } from '@/types/api';

const RELEASE: Release = {
  release_id: 'aaaaaaaa-0000-4000-8000-000000000001',
  version: '2.1.0',
  title: 'RiskIntel 2.1',
  description: 'Faster scoring and a new remediation queue.',
  release_notes: 'Added the remediation queue.\nFixed a scoring edge case.',
  file_size: 52_428_800,
  sha256_checksum: 'b'.repeat(64),
  published_at: '2026-02-10T09:00:00Z',
  is_latest: true,
  release_status: 'PUBLISHED',
  created_at: '2026-02-10T09:00:00Z',
  updated_at: '2026-02-10T09:00:00Z',
};

/** Route requests by URL so a test can describe the whole API surface it needs. */
function routeFetch(handlers: Record<string, (init?: RequestInit) => Response>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) return handler(init);
    }
    throw new Error(`No stub for ${url}`);
  }) as unknown as typeof fetch;
}

// ── Sign-in ─────────────────────────────────────────────────────────────────

describe('sign-in flow', () => {
  it('exchanges credentials for a session and stores no access token on disk', async () => {
    const user = userEvent.setup();
    tokenStore.clear();

    global.fetch = routeFetch({
      '/auth/login': () =>
        jsonResponse({
          access_token: 'access-xyz',
          refresh_token: 'refresh-xyz',
          token_type: 'bearer',
          expires_in: 900,
        }),
      '/users/me': () => jsonResponse(makeUser()),
    });

    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Correct-Horse-99!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(tokenStore.getAccessToken()).toBe('access-xyz'));
    expect(localStorage.length).toBe(0);
    expect(JSON.stringify(sessionStorage)).not.toContain('access-xyz');
  });

  it('gives one uniform message for a bad email and a bad password', async () => {
    const user = userEvent.setup();
    tokenStore.clear();

    global.fetch = routeFetch({
      '/auth/login': () =>
        jsonResponse({ success: false, error: 'Invalid credentials.' }, 401),
    });

    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText(/email address/i), 'nobody@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Whatever-123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    // Says nothing about which half was wrong.
    expect(alert).toHaveTextContent(/do not match an account/i);
    expect(alert.textContent).not.toMatch(/no such user|unknown email|wrong password/i);
  });

  it('reports rate limiting as something to wait out', async () => {
    const user = userEvent.setup();
    global.fetch = routeFetch({
      '/auth/login': () => jsonResponse({ success: false, error: 'Too many.' }, 429),
    });

    renderWithProviders(<LoginPage />, { route: '/login' });
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Correct-Horse-99!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a minute/i);
  });

  it('validates before sending anything to the server', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithProviders(<LoginPage />, { route: '/login' });
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email address is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Registration ────────────────────────────────────────────────────────────

/**
 * The register page renders both a password input and a <ul> labelled
 * "Password requirements", so a bare /^password/i matches two nodes. Restrict
 * the query to the input.
 */
function passwordInput() {
  return screen.getByLabelText(/^password/i, { selector: 'input' });
}

describe('registration flow', () => {
  it('ends in the verification-pending state, not a signed-in session', async () => {
    const user = userEvent.setup();
    tokenStore.clear();

    global.fetch = routeFetch({
      '/auth/register': () =>
        jsonResponse({ message: 'Registration successful. Check your email.' }, 201),
    });

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/work email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/country code/i), 'GB');
    await user.type(passwordInput(), 'Correct-Horse-99!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Correct-Horse-99!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    // Registration does not sign anyone in.
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('tracks the password policy live and refuses a weak password', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(passwordInput(), 'short');

    const requirements = screen.getByLabelText(/password requirements/i);
    expect(requirements).toHaveTextContent(/at least 12 characters/i);

    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/password does not meet all requirements/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a mismatched confirmation', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn() as unknown as typeof fetch;

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(passwordInput(), 'Correct-Horse-99!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different-Horse-99!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });
});

// ── Releases and downloads ──────────────────────────────────────────────────

describe('release listing and download', () => {
  it('shows a release with its version, size and checksum', async () => {
    tokenStore.clear();
    global.fetch = routeFetch({ '/releases': () => jsonResponse(paginated([RELEASE])) });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    expect(await screen.findByText('RiskIntel 2.1')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
    expect(screen.getByText('50.0 MB')).toBeInTheDocument();
    expect(screen.getByText('b'.repeat(64))).toBeInTheDocument();
  });

  it('shows an empty state, not an error, when nothing is published', async () => {
    global.fetch = routeFetch({ '/releases': () => jsonResponse(paginated([])) });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    expect(await screen.findByText(/no releases are available yet/i)).toBeInTheDocument();
  });

  it('shows a retryable error state when the release list fails', async () => {
    global.fetch = routeFetch({
      '/releases': () => jsonResponse({ success: false, error: 'Unavailable.' }, 503),
    });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    expect(await screen.findByText(/unable to load releases/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('asks an unauthenticated visitor to sign in rather than offering a download', async () => {
    tokenStore.clear();
    global.fetch = routeFetch({ '/releases': () => jsonResponse(paginated([RELEASE])) });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    expect(await screen.findByText(/an account is needed to download/i)).toBeInTheDocument();
    // The per-release control only exists once the release list has resolved.
    await screen.findByText('RiskIntel 2.1');
    expect(
      screen.getAllByRole('link', { name: /sign in to download/i }).length,
    ).toBeGreaterThan(0);
  });

  it('fetches the artefact and confirms what was saved', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    // The delivery endpoint returns bytes plus the filename to save as, not JSON.
    const delivered = vi.fn(
      () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="riskintel-2.1.0.tar.gz"',
          }),
          blob: async () => new Blob(['payload'], { type: 'application/octet-stream' }),
          json: async () => {
            throw new Error('not json');
          },
        }) as unknown as Response,
    );

    global.fetch = routeFetch({
      '/users/me': () => jsonResponse(makeUser({ email_verified: true })),
      '/file': delivered,
      '/releases': () => jsonResponse(paginated([RELEASE])),
    });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    await user.click(await screen.findByRole('button', { name: /download v2\.1\.0/i }));

    expect(await screen.findByText(/v2\.1\.0 downloaded/i)).toBeInTheDocument();
    expect(screen.getByText('riskintel-2.1.0.tar.gz')).toBeInTheDocument();
    expect(delivered).toHaveBeenCalled();
  });

  it('sends the bearer token in a header, never in the URL', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access-secret', 'refresh', 900);

    let requestedUrl = '';
    let requestedHeaders: Record<string, string> = {};

    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/file')) {
        requestedUrl = url;
        requestedHeaders = (init?.headers ?? {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Disposition': 'attachment; filename="riskintel-2.1.0.tar.gz"',
          }),
          blob: async () => new Blob(['payload']),
          json: async () => ({}),
        } as unknown as Response;
      }
      if (url.includes('/users/me')) return jsonResponse(makeUser({ email_verified: true }));
      return jsonResponse(paginated([RELEASE]));
    }) as unknown as typeof fetch;

    renderWithProviders(<DownloadPage />, { route: '/download' });
    await user.click(await screen.findByRole('button', { name: /download v2\.1\.0/i }));

    await waitFor(() => expect(requestedUrl).toContain('/file'));
    expect(requestedHeaders.Authorization).toBe('Bearer access-secret');
    expect(requestedUrl).not.toContain('access-secret');
    expect(requestedUrl).not.toContain('token');
  });

  it('blocks the download for an unverified account and explains why', async () => {
    tokenStore.setTokens('access', 'refresh', 900);

    global.fetch = routeFetch({
      '/users/me': () => jsonResponse(makeUser({ email_verified: false })),
      '/releases': () => jsonResponse(paginated([RELEASE])),
    });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    expect(await screen.findByText(/verify your email to download/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify email to download/i }),
    ).toBeDisabled();
  });

  it('explains a 429 from the download endpoint without offering an instant retry', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    global.fetch = routeFetch({
      '/users/me': () => jsonResponse(makeUser({ email_verified: true })),
      '/file': () =>
        jsonResponse(
          { success: false, error: 'Too many download requests. Please try again later.' },
          429,
        ),
      '/releases': () => jsonResponse(paginated([RELEASE])),
    });

    renderWithProviders(<DownloadPage />, { route: '/download' });

    await user.click(await screen.findByRole('button', { name: /download v2\.1\.0/i }));

    expect(await screen.findByText(/download failed/i)).toBeInTheDocument();
    expect(screen.getByText(/too many download requests/i)).toBeInTheDocument();
  });
});

// ── Feedback ────────────────────────────────────────────────────────────────

describe('feedback submission', () => {
  it('sends a rating only when the type is RATING', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    let sentBody: Record<string, unknown> = {};
    global.fetch = routeFetch({
      '/feedback': (init) => {
        sentBody = JSON.parse(String(init?.body));
        return jsonResponse({ feedback_id: 'x' }, 201);
      },
    });

    renderWithProviders(<FeedbackForm />);

    await user.selectOptions(screen.getByLabelText(/type of feedback/i), 'RATING');
    await user.click(screen.getByLabelText(/^4/));
    await user.type(screen.getByLabelText(/^title/i), 'Works well');
    await user.type(screen.getByLabelText(/^description/i), 'Scoring is quick and accurate.');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => expect(sentBody.rating).toBe(4));
    expect(sentBody.type).toBe('RATING');
  });

  it('omits the rating field entirely for a non-rating type', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    let sentBody: Record<string, unknown> = {};
    global.fetch = routeFetch({
      '/feedback': (init) => {
        sentBody = JSON.parse(String(init?.body));
        return jsonResponse({ feedback_id: 'x' }, 201);
      },
    });

    renderWithProviders(<FeedbackForm />);

    await user.selectOptions(screen.getByLabelText(/type of feedback/i), 'BUG');
    // The rating control is not offered at all for a bug report.
    expect(screen.queryByLabelText(/your rating/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^title/i), 'Crash on start');
    await user.type(screen.getByLabelText(/^description/i), 'It exits immediately on Windows.');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => expect(sentBody.type).toBe('BUG'));
    expect('rating' in sentBody).toBe(false);
  });
});

// ── Contact ─────────────────────────────────────────────────────────────────

describe('contact submission', () => {
  it('submits and confirms', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    global.fetch = routeFetch({
      '/contact': () => jsonResponse({ contact_request_id: 'c1' }, 201),
    });

    renderWithProviders(<ContactForm />);

    await user.selectOptions(screen.getByLabelText(/category/i), 'SUPPORT');
    await user.type(screen.getByLabelText(/subject/i), 'Cannot verify my email');
    await user.type(screen.getByLabelText(/message/i), 'The link says it has expired.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/message sent/i)).toBeInTheDocument();
  });

  it('maps a 422 from the server back onto the field that caused it', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    global.fetch = routeFetch({
      '/contact': () =>
        jsonResponse(
          {
            success: false,
            error: 'Validation failed.',
            details: [{ field: 'body.subject', message: 'Subject is too long.' }],
          },
          422,
        ),
    });

    renderWithProviders(<ContactForm />);

    await user.selectOptions(screen.getByLabelText(/category/i), 'BUG');
    await user.type(screen.getByLabelText(/subject/i), 'A subject');
    await user.type(screen.getByLabelText(/message/i), 'A message body.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Subject is too long.')).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    tokenStore.setTokens('access', 'refresh', 900);

    let release: (value: Response) => void = () => {};
    global.fetch = routeFetch({
      '/contact': () => {
        // Never settles until the test allows it.
        return undefined as unknown as Response;
      },
    });
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => {
        release = resolve;
      }),
    ) as unknown as typeof fetch;

    renderWithProviders(<ContactForm />);

    await user.selectOptions(screen.getByLabelText(/category/i), 'GENERAL');
    await user.type(screen.getByLabelText(/subject/i), 'Hello');
    await user.type(screen.getByLabelText(/message/i), 'Just saying hello.');

    const submit = screen.getByRole('button', { name: /send message/i });
    await user.click(submit);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled(),
    );

    release(jsonResponse({ contact_request_id: 'c1' }, 201));
  });
});
