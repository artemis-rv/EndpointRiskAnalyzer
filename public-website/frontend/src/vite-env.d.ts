/// <reference types="vite/client" />

/**
 * Typed view of the public environment variables this app reads.
 *
 * Everything here is inlined into the bundle and is therefore public. Adding a
 * secret to this interface would be a security bug, not a typing convenience.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_ENABLE_DEV_DIAGNOSTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_MODE__: string;
