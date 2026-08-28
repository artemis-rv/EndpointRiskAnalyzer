/**
 * hooks/useDownloadArtefact.ts
 * ────────────────────────────
 * Ask the backend for a release artefact and hand it to the browser to save.
 *
 * The whole decision — may this person have this build — happens server-side.
 * This hook carries the answer to the browser and nothing more: it constructs
 * no URL of its own, learns no filesystem path, and gets the saved filename
 * from the response rather than inventing one.
 */

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { downloadsApi } from '@/api/downloads';
import { ApiError, isCancellation } from '@/api/client/errors';
import { queryKeys } from '@/services/queryKeys';

export type DownloadPhase = 'idle' | 'preparing' | 'saved' | 'failed';

export interface UseDownloadArtefactResult {
  phase: DownloadPhase;
  error: ApiError | null;
  /** Filename the browser was asked to save as, once a download has succeeded. */
  savedAs: string | null;
  start: (releaseId: string) => Promise<void>;
  reset: () => void;
}

export function useDownloadArtefact(): UseDownloadArtefactResult {
  const [phase, setPhase] = useState<DownloadPhase>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Guards against a second click while the first transfer is still running,
  // which would ask the server for the same artefact twice.
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setSavedAs(null);
  }, []);

  const start = useCallback(
    async (releaseId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;

      setPhase('preparing');
      setError(null);

      let objectUrl: string | null = null;
      try {
        const { blob, filename } = await downloadsApi.fetchArtefact(releaseId);

        // Hand the bytes to the browser through a temporary object URL. It is
        // revoked immediately afterwards so the artefact is not pinned in
        // memory for the life of the page.
        objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setSavedAs(filename);
        setPhase('saved');

        // The download is now recorded server-side, so the history is stale.
        void queryClient.invalidateQueries({ queryKey: queryKeys.me.root });
      } catch (caught) {
        if (isCancellation(caught)) {
          setPhase('idle');
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({
                message: 'The download could not be started. Please try again.',
                status: 0,
                kind: 'unknown',
              }),
        );
        setPhase('failed');
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        inFlight.current = false;
      }
    },
    [queryClient],
  );

  return { phase, error, savedAs, start, reset };
}
