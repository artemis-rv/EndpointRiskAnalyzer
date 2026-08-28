/**
 * services/queryKeys.ts
 * ─────────────────────
 * Every cache key in one table.
 *
 * Two properties this buys us:
 *  1. Invalidation after a mutation targets the right entries instead of
 *     guessing at string prefixes scattered across the codebase.
 *  2. User-scoped and admin-scoped data sit under distinct roots, so clearing
 *     one never leaves the other behind. The cache is also wiped wholesale on
 *     sign-out, which is what keeps one account's data from being shown to the
 *     next person to sign in on the same tab.
 */

import type { ContactStatus, FeedbackStatus } from '@/types/api';

export const queryKeys = {
  // Public, cacheable, safe to share across sessions.
  releases: {
    root: ['releases'] as const,
    list: (page: number, pageSize: number) => ['releases', 'list', page, pageSize] as const,
    latest: () => ['releases', 'latest'] as const,
    detail: (id: string) => ['releases', 'detail', id] as const,
  },

  testimonials: {
    root: ['testimonials'] as const,
    list: (limit: number) => ['testimonials', 'list', limit] as const,
  },

  // Scoped to the signed-in account. Never persisted, cleared on sign-out.
  me: {
    root: ['me'] as const,
    profile: () => ['me', 'profile'] as const,
    downloads: (page: number, pageSize: number) => ['me', 'downloads', page, pageSize] as const,
    feedback: (page: number, pageSize: number) => ['me', 'feedback', page, pageSize] as const,
    contact: (page: number, pageSize: number) => ['me', 'contact', page, pageSize] as const,
  },

  // Administrative data. Deliberately rooted separately from everything above.
  admin: {
    root: ['admin'] as const,
    releases: (page: number, pageSize: number) => ['admin', 'releases', page, pageSize] as const,
    releasesRoot: ['admin', 'releases'] as const,
    feedback: (page: number, pageSize: number, status?: FeedbackStatus) =>
      ['admin', 'feedback', page, pageSize, status ?? 'all'] as const,
    feedbackRoot: ['admin', 'feedback'] as const,
    contact: (page: number, pageSize: number, status?: ContactStatus) =>
      ['admin', 'contact', page, pageSize, status ?? 'all'] as const,
    contactRoot: ['admin', 'contact'] as const,
    users: (page: number, pageSize: number) => ['admin', 'users', page, pageSize] as const,
    downloads: (page: number, pageSize: number) => ['admin', 'downloads', page, pageSize] as const,
    overview: () => ['admin', 'overview'] as const,
  },
} as const;
