/**
 * components/admin/AdminPrimitives.tsx
 * ────────────────────────────────────
 * Pieces shared across the admin screens: page headers, statistic tiles, a
 * status filter, and the panel shown when an endpoint the screen needs is not
 * present in the backend.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertIcon, ChevronRightIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';

// ── Page header ─────────────────────────────────────────────────────────────

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="heading-2">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

// ── Statistic tile ──────────────────────────────────────────────────────────

export interface StatTileProps {
  label: string;
  /** null renders as an em dash: a figure we do not have, not a zero. */
  value: number | null;
  hint?: string;
  to?: string;
  loading?: boolean;
  icon?: ReactNode;
  tone?: 'default' | 'attention';
}

export function StatTile({
  label,
  value,
  hint,
  to,
  loading = false,
  icon,
  tone = 'default',
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        {icon ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              tone === 'attention'
                ? 'bg-warning-50 text-warning-600'
                : 'bg-admin-50 text-admin-600'
            }`}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-2xl font-bold tabular-nums text-ink-950">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-base font-medium text-ink-400">
            <Spinner className="h-4 w-4" />
            <span className="sr-only">Loading</span>
          </span>
        ) : value === null ? (
          <span className="text-ink-400" title="Not available">
            —
          </span>
        ) : (
          value.toLocaleString()
        )}
      </p>

      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}

      {to ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-admin-700">
          View
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </p>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="card card-hover block focus-visible:ring-2 focus-visible:ring-admin-500">
        <div className="card-body">{body}</div>
      </Link>
    );
  }

  return (
    <div className="card">
      <div className="card-body">{body}</div>
    </div>
  );
}

// ── Status filter ───────────────────────────────────────────────────────────

export interface StatusFilterProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  disabled?: boolean;
}

/**
 * Filter chips rendered as a radio group, so arrow keys move between options
 * and the current selection is announced.
 */
export function StatusFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: StatusFilterProps<T>) {
  const all = [{ value: undefined, label: 'All' }, ...options] as {
    value: T | undefined;
    label: string;
  }[];

  return (
    <fieldset className="flex flex-wrap items-center gap-2" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {all.map((option) => {
        const selected = value === option.value;
        const id = `filter-${option.value ?? 'all'}`;
        return (
          <div key={id}>
            <input
              type="radio"
              id={id}
              name="status-filter"
              checked={selected}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors
                peer-focus-visible:ring-2 peer-focus-visible:ring-admin-500 peer-focus-visible:ring-offset-2
                ${
                  selected
                    ? 'border-admin-600 bg-admin-600 text-white'
                    : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                }`}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

// ── Missing endpoint notice ─────────────────────────────────────────────────

/**
 * Shown when a screen needs an endpoint the backend does not expose.
 *
 * This exists so the admin area can be honest instead of inventing data. It
 * names the missing route and what it would need to return, which is exactly
 * what someone would need in order to add it.
 */
export function EndpointUnavailable({
  path,
  purpose,
  expectedShape,
}: {
  path: string;
  purpose: string;
  expectedShape: string;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="heading-3">Not available in this backend build</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-600">{purpose}</p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-600">
              This screen is wired and ready. It calls{' '}
              <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-800">
                GET {path}
              </code>
              , which the API does not currently serve. Nothing is shown here rather than showing
              figures that were made up.
            </p>
            <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Expected response
              </p>
              <p className="mt-1.5 break-anywhere font-mono text-xs text-ink-700">
                {expectedShape}
              </p>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              Once that route exists, this page starts working with no frontend change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
