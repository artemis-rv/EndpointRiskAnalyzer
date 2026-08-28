/**
 * api/auth/index.ts
 * ─────────────────
 * Authentication endpoints.
 * Contract source: `backend/app/api/v1/auth.py` + `backend/app/schemas/auth.py`.
 *
 * Passwords appear here as request payloads and nowhere else. They are never
 * stored, never held in state after submission, and never logged.
 */

import { http } from '@/api/client/http';
import { tokenStore } from '@/api/client/tokenStore';
import type {
  LoginPayload,
  MessageResponse,
  RegisterPayload,
  ResetPasswordPayload,
  TokenResponse,
  VerifyEmailPayload,
} from '@/types/api';

export const authApi = {
  /** POST /auth/register → 201 { message } */
  register(payload: RegisterPayload): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/register', payload);
  },

  /**
   * POST /auth/login → 200 TokenResponse
   * On success the token pair is handed to the token store immediately; the
   * caller never sees or holds the raw tokens.
   */
  async login(payload: LoginPayload): Promise<void> {
    const tokens = await http.post<TokenResponse>('/auth/login', payload);
    tokenStore.setTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
  },

  /**
   * POST /auth/logout → 200 { message }
   * Requires the access token *and* the refresh token to be revoked server-side.
   * The local session is cleared regardless of the server's answer, so a failed
   * network call can never leave a signed-in shell behind.
   */
  async logout(): Promise<void> {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await http.post<MessageResponse>('/auth/logout', { refresh_token: refreshToken }, {
          auth: true,
        });
      }
    } finally {
      tokenStore.clear();
    }
  },

  /** POST /auth/verify-email → 200 { message } */
  verifyEmail(payload: VerifyEmailPayload): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/verify-email', payload);
  },

  /**
   * POST /auth/request-password-reset → 200 { message }
   * The backend deliberately answers identically whether or not the address
   * exists. The UI must repeat that message verbatim and must not branch on it,
   * otherwise it reintroduces the account enumeration the backend prevents.
   */
  requestPasswordReset(email: string): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/request-password-reset', { email });
  },

  /** POST /auth/reset-password → 200 { message } */
  resetPassword(payload: ResetPasswordPayload): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/reset-password', payload);
  },

  /**
   * POST /auth/resend-verification → 200 { message }
   *
   * Like the password-reset request, the backend answers identically whether or
   * not the address belongs to an unverified account. The UI must repeat that
   * message as-is and must not branch on it.
   */
  resendVerification(email: string): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/resend-verification', { email });
  },
};
