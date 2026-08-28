/**
 * api/client/errors.ts
 * ────────────────────
 * Centralised error model for every API call.
 *
 * Two rules drive this module:
 *  1. The user sees a plain sentence describing what happened and what to do.
 *  2. Raw backend text is only ever shown when the backend authored it as a
 *     user-facing message. Stack traces, driver errors and SQL never reach the
 *     screen, because the backend already refuses to emit them and we refuse to
 *     render whatever arrives in their place.
 */

import type { ApiErrorBody, ApiErrorDetail } from '@/types/api';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unavailable'
  | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** Field-level messages, when the backend returned a 422 validation body. */
  readonly details: ApiErrorDetail[];
  /** Correlation id, useful when a user reports a problem. Not sensitive. */
  readonly requestId: string | null;

  constructor(params: {
    message: string;
    status: number;
    kind: ApiErrorKind;
    details?: ApiErrorDetail[];
    requestId?: string | null;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.kind = params.kind;
    this.details = params.details ?? [];
    this.requestId = params.requestId ?? null;
  }

  /** Field name to message map, for wiring 422s back into form inputs. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const detail of this.details) {
      if (detail.field) {
        // Backend field paths look like "body.email"; keep the last segment.
        const segments = detail.field.split('.');
        const key = segments[segments.length - 1];
        if (key && !result[key]) result[key] = detail.message;
      }
    }
    return result;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'unavailable' ||
      this.kind === 'server'
    );
  }
}

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    case 502:
    case 503:
    case 504:
      return 'unavailable';
    default:
      if (status >= 500) return 'server';
      if (status >= 400) return 'bad_request';
      return 'unknown';
  }
}

/**
 * Default, user-facing copy per status. Used when the backend did not supply a
 * message of its own, and as the safety net that guarantees we never render an
 * unexpected payload verbatim.
 */
const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'We could not reach the server. Check your connection and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  bad_request: 'That request could not be processed. Please review your input and try again.',
  unauthorized: 'Your session has ended. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'We could not find what you were looking for.',
  conflict: 'That conflicts with something that already exists.',
  validation: 'Please correct the highlighted fields and try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our end. Please try again shortly.',
  unavailable: 'The service is temporarily unavailable. Please try again shortly.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * A backend message is shown only when it looks like prose written for a person.
 * This is the guard that keeps a leaked driver error or stack fragment off the
 * screen even if one were somehow returned.
 */
function isPresentableMessage(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return false;

  const technicalMarkers = [
    'Traceback',
    'File "',
    'psycopg',
    'sqlalchemy',
    'asyncpg',
    'SELECT ',
    'INSERT ',
    'UPDATE ',
    'DELETE FROM',
    'DETAIL:',
    'at 0x',
    '<class ',
    'Exception:',
    'Error:',
  ];
  return !technicalMarkers.some((marker) => trimmed.includes(marker));
}

/** Build an ApiError from an HTTP response plus its already-parsed body. */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const kind = kindForStatus(status);
  const parsed = (body ?? {}) as Partial<ApiErrorBody>;

  const backendMessage = parsed.error;
  const message = isPresentableMessage(backendMessage)
    ? backendMessage
    : FALLBACK_MESSAGES[kind];

  return new ApiError({
    message,
    status,
    kind,
    details: Array.isArray(parsed.details) ? parsed.details : [],
    requestId: typeof parsed.request_id === 'string' ? parsed.request_id : null,
  });
}

export function networkError(): ApiError {
  return new ApiError({ message: FALLBACK_MESSAGES.network, status: 0, kind: 'network' });
}

export function timeoutError(): ApiError {
  return new ApiError({ message: FALLBACK_MESSAGES.timeout, status: 0, kind: 'timeout' });
}

/** Narrow an unknown thrown value to a user-presentable sentence. */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return FALLBACK_MESSAGES.unknown;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * True when a request was deliberately cancelled rather than having failed.
 *
 * Cancellation happens on unmount, on navigation, when the query layer
 * supersedes an in-flight fetch, and on every StrictMode remount in
 * development. It must never be retried and must never be shown to anyone: the
 * caller stopped caring about the answer, which is not an error condition.
 */
export function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
