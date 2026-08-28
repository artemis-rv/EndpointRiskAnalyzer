/**
 * constants/config.ts
 * ───────────────────
 * The single place where `import.meta.env` is read.
 *
 * Everything here is PUBLIC: Vite inlines `VITE_*` variables into the bundle,
 * so any value below is visible to anyone who opens devtools. Nothing secret
 * may ever be routed through this module. Backend secrets (DATABASE_URL,
 * JWT_SECRET_KEY, SMTP_PASSWORD and friends) live only in the backend .env.
 */

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function readInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const rawApiBase = readString(import.meta.env.VITE_API_BASE_URL);

export const config = {
  /**
   * Origin of the FastAPI backend with no trailing slash.
   * An empty string means "same origin", which is the correct setting when the
   * site is served behind a reverse proxy that forwards /api to the backend.
   */
  apiBaseUrl: rawApiBase.replace(/\/+$/, ''),

  /** Versioned API prefix, matching `APIRouter(prefix="/api/v1")` on the server. */
  apiPrefix: '/api/v1',

  /** Public origin of this site, used for canonical URLs and Open Graph tags. */
  siteUrl: readString(import.meta.env.VITE_SITE_URL).replace(/\/+$/, ''),

  /** Abort API requests that exceed this many milliseconds. */
  apiTimeoutMs: readInt(import.meta.env.VITE_API_TIMEOUT_MS, 15_000),

  /** Public contact address rendered on marketing pages. */
  supportEmail: readString(import.meta.env.VITE_SUPPORT_EMAIL, 'support@riskintel.example.com'),

  /** True only in a Vite dev/preview build. Never true in a production bundle. */
  isDevBuild: import.meta.env.DEV === true,

  /** Opt-in verbose client diagnostics; ignored entirely in production builds. */
  devDiagnostics:
    import.meta.env.DEV === true &&
    readString(import.meta.env.VITE_ENABLE_DEV_DIAGNOSTICS).toLowerCase() === 'true',
} as const;

/** Absolute URL for a versioned API path, e.g. apiUrl('/auth/login'). */
export function apiUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiBaseUrl}${config.apiPrefix}${normalised}`;
}
