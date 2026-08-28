/**
 * hooks/useReleases.ts
 * ────────────────────
 * Release reads and the download action.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { releasesApi } from '@/api/releases';
import { downloadsApi } from '@/api/downloads';
import { ApiError } from '@/api/client/errors';
import { queryKeys } from '@/services/queryKeys';
import type { CreateDownloadPayload } from '@/types/api';

/** Published releases, paginated. Public data, cached for a while. */
export function useReleases(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.releases.list(page, pageSize),
    queryFn: ({ signal }) => releasesApi.list({ page, page_size: pageSize }, signal),
    staleTime: 2 * 60_000,
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a spinner on every page change.
    placeholderData: (previous) => previous,
  });
}

/**
 * The most recent published release.
 * A 404 here is a legitimate state, not a failure: it simply means nothing has
 * been published yet. It is surfaced as `notPublished` so the homepage can show
 * an honest empty state rather than an error.
 */
export function useLatestRelease() {
  const query = useQuery({
    queryKey: queryKeys.releases.latest(),
    queryFn: ({ signal }) => releasesApi.getLatest(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const notPublished = query.error instanceof ApiError && query.error.status === 404;

  return {
    ...query,
    notPublished,
    // Do not report "nothing published yet" as an error condition.
    isError: query.isError && !notPublished,
  };
}

export function useRelease(releaseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.releases.detail(releaseId ?? ''),
    queryFn: ({ signal }) => releasesApi.getById(releaseId as string, signal),
    enabled: Boolean(releaseId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Record a download.
 *
 * The backend owns this flow end to end: it verifies the account, verifies the
 * email, confirms the release is published, applies its hourly limit and writes
 * the audit row. The client asks and reports what came back. It never learns
 * the file's location on the server, and it never constructs a path itself.
 */
export function useRecordDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDownloadPayload) => downloadsApi.record(payload),
    onSuccess: () => {
      // The person's own history is now out of date.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.root });
    },
  });
}
