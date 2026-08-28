/**
 * test/security.test.tsx
 * ──────────────────────
 * Security regressions this codebase must never reintroduce.
 *
 * These are deliberately blunt. Several scan the source tree rather than the
 * DOM, because the property being protected is "nobody added this pattern",
 * which a rendering test cannot express.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ReleaseCard } from '@/components/releases/ReleaseCard';
import { MyFeedbackPage } from '@/pages/user/MyFeedbackPage';
import { tokenStore } from '@/api/client/tokenStore';
import { jsonResponse, paginated, renderWithProviders } from '@/test/utils';
import type { Feedback, Release } from '@/types/api';

const SRC_DIR = join(process.cwd(), 'src');

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      collectSourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const SOURCE_FILES = collectSourceFiles(SRC_DIR);

// ── A03: injection ──────────────────────────────────────────────────────────

describe('A03 — untrusted content is never rendered as HTML', () => {
  it('no source file uses dangerouslySetInnerHTML', () => {
    const offenders = SOURCE_FILES.filter((file) =>
      readFileSync(file, 'utf8').includes('dangerouslySetInnerHTML'),
    );
    expect(offenders).toEqual([]);
  });

  it('no source file writes to innerHTML or calls document.write', () => {
    const offenders = SOURCE_FILES.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return /\.innerHTML\s*=/.test(content) || /document\.write\s*\(/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  it('renders a script tag in release notes as visible text, not as markup', () => {
    const release: Release = {
      release_id: 'c0ffee00-0000-4000-8000-000000000001',
      version: '1.0.0',
      title: 'Injected <img src=x onerror=alert(1)>',
      description: null,
      release_notes: 'Fixed things.\n<script>window.__pwned = true;</script>',
      file_size: 1024,
      sha256_checksum: 'a'.repeat(64),
      published_at: '2026-02-01T10:00:00Z',
      is_latest: true,
      release_status: 'PUBLISHED',
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
    };

    const { container } = renderWithProviders(<ReleaseCard release={release} expanded />);

    // No element was created from the payload.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();

    // It is on screen, as text.
    expect(screen.getByText(/window.__pwned = true/)).toBeInTheDocument();
    expect(
      screen.getByText(/Injected <img src=x onerror=alert\(1\)>/),
    ).toBeInTheDocument();
  });

  it('renders hostile feedback text from the API as text', async () => {
    tokenStore.setTokens('access', 'refresh', 900);

    const hostile: Feedback = {
      feedback_id: 'f0000000-0000-4000-8000-000000000001',
      user_id: '11111111-1111-4111-8111-111111111111',
      type: 'BUG',
      title: '<script>alert("xss")</script>',
      description: '<iframe src="https://evil.example"></iframe>',
      rating: null,
      status: 'NEW',
      featured: false,
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
      resolved_at: null,
    };

    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(paginated([hostile]))) as unknown as typeof fetch;

    const { container } = renderWithProviders(<MyFeedbackPage />, { route: '/my-feedback' });

    expect(await screen.findByText('<script>alert("xss")</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });
});

// ── A02 / A09: secrets and logging ──────────────────────────────────────────

describe('A02 and A09 — no secrets in source, no tokens in logs', () => {
  it('contains no hardcoded secret-looking assignments', () => {
    const forbidden = [
      /JWT_SECRET/,
      /DATABASE_URL/,
      /SECRET_KEY\s*[:=]\s*['"][^'"]+['"]/,
      /PRIVATE_KEY/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /password\s*[:=]\s*['"][A-Za-z0-9!@#$%^&*]{6,}['"]/i,
    ];

    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        // The token store and config document these names in prose; a match in
        // a comment is not an assignment.
        const codeOnly = content
          .split('\n')
          .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
          .join('\n');
        if (pattern.test(codeOnly)) offenders.push(`${file} :: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never logs a token, password or authorization header', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const content = readFileSync(file, 'utf8');
      const logCalls = content.match(/console\.(log|info|debug|warn|error)\([^)]*\)/g) ?? [];
      for (const call of logCalls) {
        if (/token|password|authorization|secret|refresh_token/i.test(call)) {
          offenders.push(`${file} :: ${call}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never puts a token in a URL or query string', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const content = readFileSync(file, 'utf8');
      if (/[?&](access_token|refresh_token|password)=/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no localStorage anywhere in application code', () => {
    const offenders = SOURCE_FILES.filter((file) =>
      /localStorage\s*\.\s*(setItem|getItem)/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

// ── A08: third-party code ───────────────────────────────────────────────────

describe('A08 — no remote code is loaded at runtime', () => {
  it('loads no external script and evaluates no dynamic code', () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const content = readFileSync(file, 'utf8');
      if (/\beval\s*\(/.test(content)) offenders.push(`${file} :: eval`);
      if (/new\s+Function\s*\(/.test(content)) offenders.push(`${file} :: new Function`);
      if (/createElement\(['"]script['"]\)/.test(content)) {
        offenders.push(`${file} :: script injection`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── A10: SSRF-shaped patterns ───────────────────────────────────────────────

describe('A10 — no user-controlled request destinations', () => {
  it('routes every request through the shared client rather than bare fetch', () => {
    const allowed = [
      join(SRC_DIR, 'api', 'client', 'http.ts'),
      // The artefact download needs the raw Response — Content-Disposition for
      // the filename, and the body as a Blob — which `request()` cannot return
      // because it decodes JSON. It still routes the destination through
      // apiUrl(), still refreshes the token first, and still maps failures
      // through apiErrorFromResponse, so nothing about the client contract is
      // bypassed except the JSON decoding.
      join(SRC_DIR, 'api', 'downloads', 'index.ts'),
      join(SRC_DIR, 'test', 'setup.ts'),
      join(SRC_DIR, 'test', 'utils.tsx'),
    ];

    const offenders = SOURCE_FILES.filter((file) => {
      if (allowed.includes(file)) return false;
      const content = readFileSync(file, 'utf8');
      // Ignore matches inside comments and the word "prefetch".
      const codeOnly = content
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n');
      return /(?<![.\w])fetch\s*\(/.test(codeOnly);
    });

    expect(offenders).toEqual([]);
  });
});
