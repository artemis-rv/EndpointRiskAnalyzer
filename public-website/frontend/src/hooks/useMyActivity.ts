/**
 * hooks/useMyActivity.ts
 * ──────────────────────
 * Reads and writes scoped to the signed-in account.
 *
 * Every key here lives under the `me` root, so signing out clears all of it in
 * one sweep and no data belonging to one account can survive into another.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { downloadsApi } from '@/api/downloads';
import { feedbackApi } from '@/api/feedback';
import { contactApi } from '@/api/contact';
import { queryKeys } from '@/services/queryKeys';
import type { CreateContactPayload, CreateFeedbackPayload } from '@/types/api';

export function useMyDownloads(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.me.downloads(page, pageSize),
    queryFn: ({ signal }) => downloadsApi.listMine({ page, page_size: pageSize }, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useMyFeedback(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.me.feedback(page, pageSize),
    queryFn: ({ signal }) => feedbackApi.listMine({ page, page_size: pageSize }, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useMyContactRequests(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.me.contact(page, pageSize),
    queryFn: ({ signal }) => contactApi.listMine({ page, page_size: pageSize }, signal),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFeedbackPayload) => feedbackApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.root });
    },
  });
}

export function useSubmitContactRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContactPayload) => contactApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.root });
    },
  });
}
