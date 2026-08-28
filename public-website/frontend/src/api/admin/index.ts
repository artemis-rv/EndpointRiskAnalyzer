/**
 * api/admin/index.ts
 * ──────────────────
 * Administrative endpoints. Kept in its own module so nothing under
 * `pages/public` or `pages/user` can reach admin data by accident — the only
 * importers of this file are `pages/admin/*` and `hooks/useAdmin*`.
 *
 * Contract sources:
 *   backend/app/api/v1/admin/releases.py
 *   backend/app/api/v1/admin/feedback.py
 *   backend/app/api/v1/admin/contact.py
 *
 * Authorisation is enforced by `require_admin` on the server for every call
 * below. Reaching these functions from the client proves nothing; a non-admin
 * caller receives 403 no matter what the interface allowed them to click.
 */

import { http } from '@/api/client/http';
import { ApiError } from '@/api/client/errors';
import type {
  AdminRelease,
  AdminUpdateContactPayload,
  AdminUpdateFeedbackPayload,
  ContactRequest,
  ContactStatus,
  CreateReleasePayload,
  DownloadRecord,
  Feedback,
  FeedbackStatus,
  PageParams,
  Paginated,
  UpdateReleasePayload,
  User,
  UserRole,
} from '@/types/api';

// ── Releases ────────────────────────────────────────────────────────────────

export const adminReleasesApi = {
  /** GET /admin/releases → Paginated<ReleaseAdminResponse> (all statuses) */
  list(params: PageParams = {}, signal?: AbortSignal): Promise<Paginated<AdminRelease>> {
    return http.get<Paginated<AdminRelease>>('/admin/releases', {
      auth: true,
      query: { page: params.page, page_size: params.page_size },
      signal,
    });
  },

  /** POST /admin/releases → 201 ReleaseAdminResponse */
  create(payload: CreateReleasePayload): Promise<AdminRelease> {
    return http.post<AdminRelease>('/admin/releases', payload, { auth: true });
  },

  /** PATCH /admin/releases/{id} → ReleaseAdminResponse */
  update(releaseId: string, payload: UpdateReleasePayload): Promise<AdminRelease> {
    return http.patch<AdminRelease>(
      `/admin/releases/${encodeURIComponent(releaseId)}`,
      payload,
      { auth: true },
    );
  },

  /** DELETE /admin/releases/{id} → 204 */
  remove(releaseId: string): Promise<null> {
    return http.delete<null>(`/admin/releases/${encodeURIComponent(releaseId)}`, {
      auth: true,
    });
  },
};

// ── Feedback ────────────────────────────────────────────────────────────────

export const adminFeedbackApi = {
  /** GET /admin/feedback → Paginated<FeedbackResponse>, optional status filter */
  list(
    params: PageParams & { status?: FeedbackStatus } = {},
    signal?: AbortSignal,
  ): Promise<Paginated<Feedback>> {
    return http.get<Paginated<Feedback>>('/admin/feedback', {
      auth: true,
      query: { page: params.page, page_size: params.page_size, status: params.status },
      signal,
    });
  },

  /**
   * PATCH /admin/feedback/{id} → FeedbackResponse
   * The server enforces the legal status transitions and returns 422 for an
   * illegal one. `FEEDBACK_TRANSITIONS` below mirrors those rules so the UI can
   * offer only the moves that will be accepted — it is not the rule itself.
   */
  update(feedbackId: string, payload: AdminUpdateFeedbackPayload): Promise<Feedback> {
    return http.patch<Feedback>(
      `/admin/feedback/${encodeURIComponent(feedbackId)}`,
      payload,
      { auth: true },
    );
  },
};

/** Mirror of `_VALID_TRANSITIONS` in backend/app/services/feedback_service.py. */
export const FEEDBACK_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  NEW: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'RESOLVED'],
  ACCEPTED: ['RESOLVED'],
  REJECTED: [],
  RESOLVED: [],
};

// ── Contact requests ────────────────────────────────────────────────────────

export const adminContactApi = {
  /** GET /admin/contact → Paginated<ContactRequestResponse>, optional status filter */
  list(
    params: PageParams & { status?: ContactStatus } = {},
    signal?: AbortSignal,
  ): Promise<Paginated<ContactRequest>> {
    return http.get<Paginated<ContactRequest>>('/admin/contact', {
      auth: true,
      query: { page: params.page, page_size: params.page_size, status: params.status },
      signal,
    });
  },

  /** PATCH /admin/contact/{id} → ContactRequestResponse */
  update(contactRequestId: string, payload: AdminUpdateContactPayload): Promise<ContactRequest> {
    return http.patch<ContactRequest>(
      `/admin/contact/${encodeURIComponent(contactRequestId)}`,
      payload,
      { auth: true },
    );
  },
};

/** Mirror of `_VALID_TRANSITIONS` in backend/app/services/contact_service.py. */
export const CONTACT_TRANSITIONS: Record<ContactStatus, ContactStatus[]> = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESPONDED', 'CLOSED'],
  RESPONDED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

// ── Users and download activity ─────────────────────────────────────────────
//
// Both endpoints exist as of Phase 6.12 and are verified against the running
// backend. `require_admin` guards each one server-side.
//
// `EndpointNotImplementedError` is kept because the screens still distinguish
// "this backend build does not serve the route" from an ordinary failure. It no
// longer fires against a current backend, but it keeps the frontend usable
// against an older one instead of showing a bare error.

/**
 * Marker meaning "the server has no such route", as opposed to "the server
 * refused you" or "the server broke".
 */
export class EndpointNotImplementedError extends Error {
  readonly path: string;

  constructor(path: string) {
    super('This view needs a backend endpoint that is not available yet.');
    this.name = 'EndpointNotImplementedError';
    this.path = path;
  }
}

function mapMissingEndpoint(path: string) {
  return (error: unknown): never => {
    if (error instanceof ApiError && error.status === 404) {
      throw new EndpointNotImplementedError(path);
    }
    throw error;
  };
}

export const adminUsersApi = {
  /**
   * GET /admin/users → Paginated<UserPublicResponse>
   * Optional `role` and `search` filters are applied server-side; the search
   * term is escaped for LIKE in the repository, not interpolated into SQL.
   */
  list(
    params: PageParams & { role?: UserRole; search?: string } = {},
    signal?: AbortSignal,
  ): Promise<Paginated<User>> {
    return http
      .get<Paginated<User>>('/admin/users', {
        auth: true,
        query: {
          page: params.page,
          page_size: params.page_size,
          role: params.role,
          search: params.search,
        },
        signal,
      })
      .catch(mapMissingEndpoint('/admin/users'));
  },
};

export const adminDownloadsApi = {
  /**
   * GET /admin/downloads → Paginated<DownloadResponse> across every account.
   * Returns the same item schema as a person's own history: the address and
   * user agent recorded on each row are deliberately not exposed here either.
   */
  list(
    params: PageParams & { release_id?: string; user_id?: string } = {},
    signal?: AbortSignal,
  ): Promise<Paginated<DownloadRecord>> {
    return http
      .get<Paginated<DownloadRecord>>('/admin/downloads', {
        auth: true,
        query: {
          page: params.page,
          page_size: params.page_size,
          release_id: params.release_id,
          user_id: params.user_id,
        },
        signal,
      })
      .catch(mapMissingEndpoint('/admin/downloads'));
  },
};
