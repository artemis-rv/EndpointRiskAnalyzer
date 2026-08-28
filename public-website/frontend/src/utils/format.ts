/**
 * utils/format.ts
 * ───────────────
 * Presentation helpers. Every function here takes untrusted server data and
 * returns a plain string for React to render as a text node.
 */

/** Format an ISO timestamp as a readable date, or a dash when absent. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Format an ISO timestamp as date + time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Machine-readable value for a <time dateTime="…"> attribute. */
export function isoDateAttr(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Human-readable file size from a byte count. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const decimals = exponent === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

/**
 * Shorten a checksum for inline display while keeping enough of both ends to be
 * recognisable. The full value is always available to copy.
 */
export function shortChecksum(checksum: string | null | undefined): string {
  if (!checksum || checksum.length <= 20) return checksum ?? '—';
  return `${checksum.slice(0, 10)}…${checksum.slice(-10)}`;
}

/** Turn an enum-ish token into a readable label as a last resort. */
export function humaniseToken(token: string): string {
  return token
    .toLowerCase()
    .split('_')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Full name for display, falling back to the email local part. */
export function displayName(user: { first_name?: string; last_name?: string; email?: string }): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  const email = user.email ?? '';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : 'Account';
}

/** Initials for an avatar bubble. */
export function initials(user: { first_name?: string; last_name?: string; email?: string }): string {
  const first = user.first_name?.trim().charAt(0) ?? '';
  const last = user.last_name?.trim().charAt(0) ?? '';
  const combined = `${first}${last}`.toUpperCase();
  if (combined) return combined;
  return (user.email?.trim().charAt(0) ?? '?').toUpperCase();
}

/** Truncate long free text for table cells, without cutting mid-word. */
export function truncate(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trimEnd()}…`;
}

/** Shorten a UUID for display in a table. The full value stays in the title. */
export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
