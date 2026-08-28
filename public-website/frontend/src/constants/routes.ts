/**
 * constants/routes.ts
 * ───────────────────
 * Every route path in one place so links can never drift from the router.
 */

export const ROUTES = {
  // Public
  home: '/',
  features: '/features',
  download: '/download',
  docs: '/docs',
  docsArticle: (slug: string) => `/docs/${slug}`,
  faq: '/faq',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  notFound: '/404',
  forbidden: '/403',

  // Auth
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',

  // Authenticated user
  profile: '/profile',
  myDownloads: '/my-downloads',
  myFeedback: '/my-feedback',
  myRequests: '/my-requests',

  // Admin
  admin: '/admin',
  adminUsers: '/admin/users',
  adminReleases: '/admin/releases',
  adminFeedback: '/admin/feedback',
  adminContact: '/admin/contact',
  adminDownloads: '/admin/downloads',
} as const;
