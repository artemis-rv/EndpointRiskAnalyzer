/**
 * api/contact/index.ts
 * ────────────────────
 * Contact requests for the signed-in user.
 * Contract source: `backend/app/api/v1/contact.py`.
 */

import { http } from '@/api/client/http';
import type {
  ContactRequest,
  CreateContactPayload,
  PageParams,
  Paginated,
} from '@/types/api';

export const contactApi = {
  /** POST /contact → 201 ContactRequestResponse */
  create(payload: CreateContactPayload): Promise<ContactRequest> {
    return http.post<ContactRequest>('/contact', payload, { auth: true });
  },

  /** GET /contact/me → Paginated<ContactRequestResponse> */
  listMine(params: PageParams = {}, signal?: AbortSignal): Promise<Paginated<ContactRequest>> {
    return http.get<Paginated<ContactRequest>>('/contact/me', {
      auth: true,
      query: { page: params.page, page_size: params.page_size },
      signal,
    });
  },
};
