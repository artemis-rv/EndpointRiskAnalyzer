/**
 * components/releases/ReleaseCard.tsx
 * ───────────────────────────────────
 * One published release, with its notes, integrity data and download action.
 *
 * Everything shown here comes from `ReleasePublicResponse`, which has no
 * `file_path` field. The public site never learns where a build sits on the
 * server, and never builds a path of its own.
 *
 * Release notes are author-supplied text. They are rendered inside a
 * `whitespace-pre-line` block, so line breaks survive while the content stays a
 * text node. No HTML from the server is ever parsed or injected.
 */

import { Link } from 'react-router-dom';
import type { Release } from '@/types/api';
import { ROUTES } from '@/constants/routes';
import { formatBytes, formatDate, isoDateAttr } from '@/utils/format';
import { Badge } from '@/components/common/Badge';
import { CopyButton } from '@/components/common/CopyButton';
import { DownloadAction } from './DownloadAction';

export interface ReleaseCardProps {
  release: Release;
  /** Renders the notes in full instead of clamping them. */
  expanded?: boolean;
}

export function ReleaseCard({ release, expanded = false }: ReleaseCardProps) {
  return (
    <article className="card" aria-labelledby={`release-${release.release_id}`}>
      <div className="card-body">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`release-${release.release_id}`} className="heading-3">
                {release.title}
              </h3>
              {release.is_latest ? <Badge tone="success">Latest</Badge> : null}
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
              <span className="font-mono font-medium text-ink-700">v{release.version}</span>
              <span aria-hidden="true">&middot;</span>
              <span>
                Published{' '}
                <time dateTime={isoDateAttr(release.published_at)}>
                  {formatDate(release.published_at)}
                </time>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>{formatBytes(release.file_size)}</span>
            </p>
          </div>

          <DownloadAction release={release} />
        </header>

        {release.description ? (
          <p className="mt-4 text-sm leading-relaxed text-ink-600">{release.description}</p>
        ) : null}

        {/* Release notes: author text, rendered as text. */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Release notes
          </h4>
          <div
            className={`mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink-600 ${
              expanded ? '' : 'line-clamp-6'
            }`}
          >
            {release.release_notes}
          </div>
          {!expanded ? (
            <Link
              to={`${ROUTES.download}?release=${encodeURIComponent(release.release_id)}`}
              className="link mt-2 inline-block text-sm"
            >
              Read the full notes for v{release.version}
            </Link>
          ) : null}
        </div>

        {/* Integrity */}
        <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-600">
              SHA-256 checksum
            </h4>
            <CopyButton value={release.sha256_checksum} label="SHA-256 checksum" />
          </div>
          <p className="mt-2 break-anywhere font-mono text-xs leading-relaxed text-ink-700">
            {release.sha256_checksum}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Compare this with the checksum of the file you downloaded before running it.
          </p>
        </div>
      </div>
    </article>
  );
}
