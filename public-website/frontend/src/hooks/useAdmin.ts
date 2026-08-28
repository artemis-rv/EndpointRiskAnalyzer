/**
 * hooks/useAdmin.ts
 * ─────────────────
 * Administrative reads and writes.
 *
 * Imported only by `pages/admin/*`. Nothing under `pages/public` or
 * `pages/user` may import this module, which keeps admin responses out of the
 * caches those pages read from.
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminContactApi,
  adminDownloadsApi,
  adminFeedbackApi,
  adminReleasesApi,
  adminUsersApi,
  EndpointNotImplementedError,
} from '@/api/admin';
import { queryKeys } from '@/services/queryKeys';
import type {
  AdminUpdateContactPayload,
  AdminUpdateFeedbackPayload,
  ContactStatus,
  CreateReleasePayload,
  FeedbackStatus,
  UpdateReleasePayload,
} from '@/types/api';

// ── Releases ────────────────────────────────────────────────────────────────

export function useAdminReleases(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.admin.releases(page, pageSize),
    queryFn: ({ signal }) => adminReleasesApi.list({ page, page_size: pageSize }, signal),
    placeholderData: (previous) => previous,
  });
}

/**
 * After any release write, both the admin list and the public release caches
 * are invalidated: publishing a release changes what visitors see immediately.
 */
function useReleaseInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.releasesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.releases.root });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() });
  };
}

export function useCreateRelease() {
  const invalidate = useReleaseInvalidation();
  return useMutation({
    mutationFn: (payload: CreateReleasePayload) => adminReleasesApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRelease() {
  const invalidate = useReleaseInvalidation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateReleasePayload }) =>
      adminReleasesApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRelease() {
  const invalidate = useReleaseInvalidation();
  return useMutation({
    mutationFn: (id: string) => adminReleasesApi.remove(id),
    onSuccess: invalidate,
  });
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function useAdminFeedback(page: number, pageSize: number, status?: FeedbackStatus) {
  return useQuery({
    queryKey: queryKeys.admin.feedback(page, pageSize, status),
    queryFn: ({ signal }) => adminFeedbackApi.list({ page, page_size: pageSize, status }, signal),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUpdateFeedbackPayload }) =>
      adminFeedbackApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.feedbackRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() });
    },
  });
}

// ── Contact requests ────────────────────────────────────────────────────────

export function useAdminContact(page: number, pageSize: number, status?: ContactStatus) {
  return useQuery({
    queryKey: queryKeys.admin.contact(page, pageSize, status),
    queryFn: ({ signal }) => adminContactApi.list({ page, page_size: pageSize, status }, signal),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateContactRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUpdateContactPayload }) =>
      adminContactApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.contactRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() });
    },
  });
}

// ── Endpoints awaiting backend support ──────────────────────────────────────

export function useAdminUsers(page: number, pageSize: number) {
  const query = useQuery({
    queryKey: queryKeys.admin.users(page, pageSize),
    queryFn: ({ signal }) => adminUsersApi.list({ page, page_size: pageSize }, signal),
    retry: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    endpointMissing: query.error instanceof EndpointNotImplementedError,
  };
}

export function useAdminDownloads(page: number, pageSize: number) {
  const query = useQuery({
    queryKey: queryKeys.admin.downloads(page, pageSize),
    queryFn: ({ signal }) => adminDownloadsApi.list({ page, page_size: pageSize }, signal),
    retry: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    endpointMissing: query.error instanceof EndpointNotImplementedError,
  };
}

// ── Dashboard overview ──────────────────────────────────────────────────────

/**
 * Figures for the admin landing page.
 *
 * Every number below is a real `total` taken from a real endpoint. The status
 * counts come from filtered list calls with page_size=1: the rows are discarded
 * and only the pagination total is read, which is the cheapest honest count the
 * current API can produce. No figure here is estimated or invented.
 */
export function useAdminOverview() {
  const results = useQueries({
    queries: [
      {
        queryKey: [...queryKeys.admin.overview(), 'releases'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminReleasesApi.list({ page: 1, page_size: 1 }, signal),
        staleTime: 30_000,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'feedback', 'all'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminFeedbackApi.list({ page: 1, page_size: 1 }, signal),
        staleTime: 30_000,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'feedback', 'NEW'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminFeedbackApi.list({ page: 1, page_size: 1, status: 'NEW' }, signal),
        staleTime: 30_000,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'contact', 'all'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminContactApi.list({ page: 1, page_size: 1 }, signal),
        staleTime: 30_000,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'contact', 'NEW'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminContactApi.list({ page: 1, page_size: 1, status: 'NEW' }, signal),
        staleTime: 30_000,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'downloads'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminDownloadsApi.list({ page: 1, page_size: 1 }, signal),
        staleTime: 30_000,
        retry: false,
      },
      {
        queryKey: [...queryKeys.admin.overview(), 'users'],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          adminUsersApi.list({ page: 1, page_size: 1 }, signal),
        staleTime: 30_000,
        retry: false,
      },
    ],
  });

  const [releases, feedbackAll, feedbackNew, contactAll, contactNew, downloads, users] =
    results;

  return {
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    partial: results.some((result) => result.isError) && results.some((r) => r.data),
    error: results.find((result) => result.error)?.error,
    refetch: () => results.forEach((result) => void result.refetch()),
    totals: {
      releases: releases?.data?.total ?? null,
      feedback: feedbackAll?.data?.total ?? null,
      feedbackNew: feedbackNew?.data?.total ?? null,
      contact: contactAll?.data?.total ?? null,
      contactNew: contactNew?.data?.total ?? null,
      // null rather than 0 when the endpoint is unavailable: "we do not know"
      // and "there are none" must not look the same on a dashboard.
      downloads: downloads?.data?.total ?? null,
      users: users?.data?.total ?? null,
    },
  };
}
