/**
 * test/setup.ts
 * ─────────────
 * Global test environment.
 *
 * `fetch` is stubbed by default and throws if a test triggers a real request it
 * did not arrange. That turns an accidental network call into a visible failure
 * instead of a silent one that passes for the wrong reason.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

beforeEach(() => {
  global.fetch = vi.fn(() => {
    throw new Error('Unexpected network call: stub fetch in the test that needs it.');
  }) as unknown as typeof fetch;
});

// jsdom implements neither of these, and components under test use both.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
