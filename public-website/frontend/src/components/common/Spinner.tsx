/**
 * components/common/Spinner.tsx
 * ─────────────────────────────
 * Busy indicator. Presentational only: the accessible announcement belongs to
 * the container that owns the busy state (a button with aria-busy, or a region
 * with role="status"), so screen readers hear it once rather than twice.
 */

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
