/**
 * api/users/index.ts
 * ──────────────────
 * Profile endpoints.
 * Contract source: `backend/app/api/v1/users.py`.
 *
 * The server derives the subject from the bearer token, so there is no user id
 * in these paths. That is what makes an IDOR impossible here: the client cannot
 * name a different user even if it wanted to.
 */

import { http } from '@/api/client/http';
import type { UpdateProfilePayload, User } from '@/types/api';

export const usersApi = {
  /** GET /users/me → UserPublicResponse */
  getMe(signal?: AbortSignal): Promise<User> {
    return http.get<User>('/users/me', { auth: true, signal });
  },

  /** PATCH /users/me → UserPublicResponse */
  updateMe(payload: UpdateProfilePayload): Promise<User> {
    return http.patch<User>('/users/me', payload, { auth: true });
  },
};
