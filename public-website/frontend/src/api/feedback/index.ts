/**
 * api/feedback/index.ts
 * ─────────────────────
 * Feedback submission and history for the signed-in user.
 * Contract source: `backend/app/api/v1/feedback.py`.
 */

import { http } from '@/api/client/http';
import type {
  CreateFeedbackPayload,
  Feedback,
  PageParams,
  Paginated,
  PublicTestimonial,
} from '@/types/api';

export const feedbackApi = {
  /**
   * POST /feedback → 201 FeedbackResponse
   * The backend rejects a rating on a non-RATING submission and requires one on
   * a RATING submission; the form mirrors that rule for usability only.
   */
  create(payload: CreateFeedbackPayload): Promise<Feedback> {
    return http.post<Feedback>('/feedback', payload, { auth: true });
  },

  /** GET /feedback/me → Paginated<FeedbackResponse> */
  listMine(params: PageParams = {}, signal?: AbortSignal): Promise<Paginated<Feedback>> {
    return http.get<Paginated<Feedback>>('/feedback/me', {
      auth: true,
      query: { page: params.page, page_size: params.page_size },
      signal,
    });
  },

  /**
   * GET /feedback/testimonials → PublicTestimonialResponse[]
   *
   * Public and unauthenticated. The server returns only feedback that is both
   * ACCEPTED and featured; the filter is in the SQL query, never here. Asking
   * for all feedback and filtering client-side would put unreviewed bug reports
   * on the wire to anonymous visitors.
   */
  listPublicTestimonials(limit = 12, signal?: AbortSignal): Promise<PublicTestimonial[]> {
    return http.get<PublicTestimonial[]>('/feedback/testimonials', {
      query: { limit },
      signal,
    });
  },
};
