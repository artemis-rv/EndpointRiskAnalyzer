/**
 * api/releases/index.ts
 * ─────────────────────
 * Public release browsing.
 * Contract source: `backend/app/api/v1/releases.py`.
 *
 * These endpoints require no authentication and return `ReleasePublicResponse`,
 * which deliberately omits `file_path`. The public site never learns where a
 * build lives on the server's filesystem.
 */

import { http } from '@/api/client/http';
import type { PageParams, Paginated, Release } from '@/types/api';

export const releasesApi = {
  /** GET /releases → Paginated<ReleasePublicResponse> */
  list(params: PageParams = {}, signal?: AbortSignal): Promise<Paginated<Release>> {
    return http.get<Paginated<Release>>('/releases', {
      query: { page: params.page, page_size: params.page_size },
      signal,
    });
  },

  /** GET /releases/latest → ReleasePublicResponse (404 when nothing published) */
  getLatest(signal?: AbortSignal): Promise<Release> {
    return http.get<Release>('/releases/latest', { signal });
  },

  /** GET /releases/{id} → ReleasePublicResponse */
  getById(releaseId: string, signal?: AbortSignal): Promise<Release> {
    return http.get<Release>(`/releases/${encodeURIComponent(releaseId)}`, { signal });
  },
};
