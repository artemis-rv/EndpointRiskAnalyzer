/**
 * types/api.ts
 * ────────────
 * TypeScript mirrors of the FastAPI/Pydantic response contract.
 *
 * These types are transcribed from the backend schemas in
 * `public-website/backend/app/schemas/` and the enums in
 * `public-website/backend/app/models/`. They are a *description* of what the
 * server sends — never a source of business rules. Anything that decides access
 * or validity is decided by the backend.
 *
 * IMPORTANT: every string field below originates from user input and must be
 * rendered as text, never as HTML (OWASP A03).
 */

// ── Enums (must match backend model enums exactly) ──────────────────────────

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ReleaseStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ReleaseStatus = (typeof ReleaseStatus)[keyof typeof ReleaseStatus];

export const FeedbackType = {
  RATING: 'RATING',
  BUG: 'BUG',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  TESTIMONIAL: 'TESTIMONIAL',
  GENERAL: 'GENERAL',
} as const;
export type FeedbackType = (typeof FeedbackType)[keyof typeof FeedbackType];

export const FeedbackStatus = {
  NEW: 'NEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
} as const;
export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus];

export const ContactCategory = {
  SALES: 'SALES',
  SUPPORT: 'SUPPORT',
  BUG: 'BUG',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  PARTNERSHIP: 'PARTNERSHIP',
  GENERAL: 'GENERAL',
} as const;
export type ContactCategory = (typeof ContactCategory)[keyof typeof ContactCategory];

export const ContactStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  RESPONDED: 'RESPONDED',
  CLOSED: 'CLOSED',
} as const;
export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];

// ── Envelopes ───────────────────────────────────────────────────────────────

/** `app/schemas/common.py :: PaginatedResponse` */
export interface Paginated<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

/** `app/schemas/common.py :: ErrorDetail` */
export interface ApiErrorDetail {
  field: string | null;
  message: string;
  code?: string | null;
}

/** `app/schemas/common.py :: ErrorResponse` and the global handlers in main.py */
export interface ApiErrorBody {
  success: false;
  error: string;
  details?: ApiErrorDetail[] | null;
  request_id?: string | null;
}

/** `app/schemas/auth.py :: MessageResponse` */
export interface MessageResponse {
  message: string;
}

// ── Auth ────────────────────────────────────────────────────────────────────

/** `app/schemas/auth.py :: TokenResponse` */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Seconds until the access token expires. */
  expires_in: number;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  country_code: string;
  company_name?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyEmailPayload {
  user_id: string;
  token: string;
}

export interface ResetPasswordPayload {
  user_id: string;
  token: string;
  new_password: string;
}

// ── Users ───────────────────────────────────────────────────────────────────

/** `app/schemas/user.py :: UserPublicResponse` */
export interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  company_name: string | null;
  role: UserRole;
  email_verified: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  is_active: boolean;
}

/** `app/schemas/user.py :: UpdateMeRequest` */
export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  country_code?: string;
  company_name?: string | null;
}

// ── Releases ────────────────────────────────────────────────────────────────

/** `app/schemas/release.py :: ReleasePublicResponse` — note: no `file_path`. */
export interface Release {
  release_id: string;
  version: string;
  title: string;
  description: string | null;
  release_notes: string;
  file_size: number;
  sha256_checksum: string;
  published_at: string | null;
  is_latest: boolean;
  release_status: ReleaseStatus;
  created_at: string;
  updated_at: string;
}

/**
 * `app/schemas/release.py :: ReleaseAdminResponse`
 * Adds `file_path`, which is a server-side filesystem path. It is displayed
 * only inside the admin area and is never surfaced on a public page.
 */
export interface AdminRelease extends Release {
  file_path: string;
  published_by_user_id: string;
}

export interface CreateReleasePayload {
  version: string;
  title: string;
  description?: string | null;
  release_notes: string;
  file_path: string;
  file_size: number;
  sha256_checksum: string;
  release_status?: ReleaseStatus;
  published_at?: string | null;
}

export interface UpdateReleasePayload {
  title?: string;
  description?: string | null;
  release_notes?: string;
  file_path?: string;
  file_size?: number;
  sha256_checksum?: string;
  release_status?: ReleaseStatus;
  is_latest?: boolean;
  published_at?: string | null;
}

// ── Downloads ───────────────────────────────────────────────────────────────

/** `app/schemas/download.py :: DownloadResponse` (no IP / user-agent by design) */
export interface DownloadRecord {
  download_id: string;
  user_id: string;
  release_id: string;
  downloaded_at: string;
  download_source: string;
}

export interface CreateDownloadPayload {
  release_id: string;
  download_source?: string;
}

// ── Feedback ────────────────────────────────────────────────────────────────

/** `app/schemas/feedback.py :: FeedbackResponse` */
export interface Feedback {
  feedback_id: string;
  user_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  rating: number | null;
  status: FeedbackStatus;
  featured: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateFeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  /** Required when `type` is RATING, forbidden otherwise (backend rule). */
  rating?: number | null;
}

/**
 * `app/schemas/feedback.py :: PublicTestimonialResponse`
 *
 * Deliberately carries no identifier of any kind. Approval makes the *content*
 * public; it does not make the author public.
 */
export interface PublicTestimonial {
  type: FeedbackType;
  title: string;
  description: string;
  rating: number | null;
  created_at: string;
}

export interface AdminUpdateFeedbackPayload {
  status?: FeedbackStatus;
  featured?: boolean;
}

// ── Contact requests ────────────────────────────────────────────────────────

/** `app/schemas/contact_request.py :: ContactRequestResponse` */
export interface ContactRequest {
  contact_request_id: string;
  user_id: string;
  subject: string;
  message: string;
  category: ContactCategory;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  handled_by_user_id: string | null;
}

export interface CreateContactPayload {
  subject: string;
  message: string;
  category: ContactCategory;
}

export interface AdminUpdateContactPayload {
  status?: ContactStatus;
  handled_by_user_id?: string;
}

// ── Shared query params ─────────────────────────────────────────────────────

export interface PageParams {
  page?: number;
  page_size?: number;
}
