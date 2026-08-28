/**
 * components/releases/DownloadAction.tsx
 * ──────────────────────────────────────
 * The download control, in every state it can be in.
 *
 * HOW THE DOWNLOAD FLOW WORKS
 * `GET /api/v1/downloads/{release_id}/file` does the whole thing server-side:
 * authenticates the caller, requires a verified email, confirms the release is
 * PUBLISHED, resolves the artefact inside a single trusted storage root,
 * applies the per-release hourly limit, writes the audit record, and streams
 * the bytes.
 *
 * This component asks and reports. It never sees a filesystem path —
 * `ReleasePublicResponse` has no `file_path` — and it builds no URL beyond the
 * release id it was given. The saved filename comes from the server's
 * Content-Disposition, sanitised on arrival.
 */

import { Link } from 'react-router-dom';
import { useDownloadArtefact } from '@/hooks/useDownloadArtefact';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import type { Release } from '@/types/api';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { DownloadIcon, LockIcon } from '@/components/common/Icons';

export function DownloadAction({ release }: { release: Release }) {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const download = useDownloadArtefact();

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="shrink-0 text-right">
        <Link to={ROUTES.login} state={{ from: ROUTES.download }} className="btn-primary">
          <LockIcon className="h-4 w-4" />
          Sign in to download
        </Link>
        <p className="mt-1.5 text-xs text-ink-500">Downloads require a verified account.</p>
      </div>
    );
  }

  // ── Signed in, email not verified ─────────────────────────────────────────
  if (!isEmailVerified) {
    return (
      <div className="shrink-0 text-right">
        <Button variant="secondary" disabled leadingIcon={<LockIcon className="h-4 w-4" />}>
          Verify email to download
        </Button>
        <p className="mt-1.5 max-w-[16rem] text-xs text-ink-500">
          Open the verification link we emailed you, then return here.
        </p>
      </div>
    );
  }

  // ── Delivered ─────────────────────────────────────────────────────────────
  if (download.phase === 'saved') {
    return (
      <div className="w-full shrink-0 sm:w-auto sm:max-w-sm">
        <Alert tone="success" title={`v${release.version} downloaded`}>
          <p className="text-xs leading-relaxed">
            Saved as{' '}
            <span className="break-anywhere font-mono">{download.savedAs}</span>. Verify it
            against the SHA-256 checksum below before you run it.
          </p>
          <p className="mt-2 flex flex-wrap gap-3">
            <Link to={ROUTES.myDownloads} className="link text-xs">
              View your download history
            </Link>
            <button type="button" onClick={download.reset} className="link text-xs">
              Download again
            </button>
          </p>
        </Alert>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (download.phase === 'failed') {
    const error = download.error;
    const isRateLimited = error?.status === 429;

    return (
      <div className="w-full shrink-0 sm:w-auto sm:max-w-sm">
        <Alert tone={isRateLimited ? 'warning' : 'danger'} title="Download failed">
          <p className="text-xs leading-relaxed">
            {error?.message ?? 'Something went wrong. Please try again shortly.'}
          </p>
          {!isRateLimited ? (
            <p className="mt-2">
              <button type="button" onClick={download.reset} className="link text-xs">
                Try again
              </button>
            </p>
          ) : null}
        </Alert>
      </div>
    );
  }

  // ── Ready / in progress ───────────────────────────────────────────────────
  return (
    <div className="shrink-0 text-right">
      <Button
        onClick={() => void download.start(release.release_id)}
        loading={download.phase === 'preparing'}
        loadingLabel="Preparing"
        leadingIcon={<DownloadIcon className="h-4 w-4" />}
      >
        Download v{release.version}
      </Button>
      <p className="mt-1.5 text-xs text-ink-500">Recorded against your account.</p>
    </div>
  );
}
