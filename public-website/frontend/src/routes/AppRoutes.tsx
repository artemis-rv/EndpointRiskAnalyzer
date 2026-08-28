/**
 * routes/AppRoutes.tsx
 * ────────────────────
 * The route table.
 *
 * Layout composition:
 *   GuestLayout  → public marketing pages and the auth flows
 *   UserLayout   → the signed-in account area, behind ProtectedRoute
 *   AdminLayout  → /admin/*, behind AdminRoute
 *
 * Code splitting: the public pages load eagerly because they are the first
 * thing a visitor sees, while the account and admin areas are lazy — a visitor
 * who never signs in never downloads the admin bundle.
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

import { GuestLayout } from '@/layouts/GuestLayout';
import { AdminRoute, GuestOnlyRoute, ProtectedRoute } from './guards';
import { Spinner } from '@/components/common/Spinner';

// Public pages: part of the initial bundle.
import { HomePage } from '@/pages/public/HomePage';
import { DownloadPage } from '@/pages/public/DownloadPage';
import { ContactPage } from '@/pages/public/ContactPage';
import {
  DocsArticlePage,
  DocsPage,
  FaqPage,
  FeaturesPage,
  ForbiddenPage,
  NotFoundPage,
  PrivacyPage,
  TermsPage,
} from '@/pages/public/StaticPages';

// Auth pages.
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from '@/pages/auth/PasswordPages';

// Account area: loaded on demand.
const UserLayout = lazy(() =>
  import('@/layouts/UserLayout').then((module) => ({ default: module.UserLayout })),
);
const ProfilePage = lazy(() =>
  import('@/pages/user/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const MyDownloadsPage = lazy(() =>
  import('@/pages/user/MyDownloadsPage').then((module) => ({ default: module.MyDownloadsPage })),
);
const MyFeedbackPage = lazy(() =>
  import('@/pages/user/MyFeedbackPage').then((module) => ({ default: module.MyFeedbackPage })),
);
const MyRequestsPage = lazy(() =>
  import('@/pages/user/MyRequestsPage').then((module) => ({ default: module.MyRequestsPage })),
);

// Admin area: loaded on demand, and never fetched by a visitor who never
// reaches /admin.
const AdminLayout = lazy(() =>
  import('@/layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })),
);
const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((module) => ({
    default: module.AdminOverviewPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminReleasesPage = lazy(() =>
  import('@/pages/admin/AdminReleasesPage').then((module) => ({
    default: module.AdminReleasesPage,
  })),
);
const AdminDownloadsPage = lazy(() =>
  import('@/pages/admin/AdminDownloadsPage').then((module) => ({
    default: module.AdminDownloadsPage,
  })),
);
const AdminFeedbackPage = lazy(() =>
  import('@/pages/admin/AdminFeedbackPage').then((module) => ({
    default: module.AdminFeedbackPage,
  })),
);
const AdminContactPage = lazy(() =>
  import('@/pages/admin/AdminContactPage').then((module) => ({
    default: module.AdminContactPage,
  })),
);

function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-7 w-7 text-brand-600" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Public ──────────────────────────────────────────────────── */}
        <Route element={<GuestLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.features} element={<FeaturesPage />} />
          <Route path={ROUTES.download} element={<DownloadPage />} />
          <Route path={ROUTES.docs} element={<DocsPage />} />
          <Route path="/docs/:slug" element={<DocsArticlePage />} />
          <Route path={ROUTES.faq} element={<FaqPage />} />
          <Route path={ROUTES.contact} element={<ContactPage />} />
          <Route path={ROUTES.privacy} element={<PrivacyPage />} />
          <Route path={ROUTES.terms} element={<TermsPage />} />

          {/* Auth: reachable only while signed out, except the two flows
              that arrive from an email link and must work in either state. */}
          <Route element={<GuestOnlyRoute />}>
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.register} element={<RegisterPage />} />
            <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          </Route>
          <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
          <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />

          {/* Error pages */}
          <Route path={ROUTES.forbidden} element={<ForbiddenPage />} />
          <Route path={ROUTES.notFound} element={<NotFoundPage />} />
        </Route>

        {/* ── Signed-in account ───────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<UserLayout />}>
            <Route path={ROUTES.profile} element={<ProfilePage />} />
            <Route path={ROUTES.myDownloads} element={<MyDownloadsPage />} />
            <Route path={ROUTES.myFeedback} element={<MyFeedbackPage />} />
            <Route path={ROUTES.myRequests} element={<MyRequestsPage />} />
          </Route>
        </Route>

        {/* ── Admin ───────────────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route path={ROUTES.admin} element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="releases" element={<AdminReleasesPage />} />
            <Route path="downloads" element={<AdminDownloadsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="contact" element={<AdminContactPage />} />
          </Route>
        </Route>

        {/* ── Catch-all ───────────────────────────────────────────────── */}
        <Route element={<GuestLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/index.html" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </Suspense>
  );
}
