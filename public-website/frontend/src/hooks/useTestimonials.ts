/**
 * hooks/useTestimonials.ts
 * ────────────────────────
 * Approved testimonials for the public homepage.
 *
 * Public, cacheable data. The server decides what is publishable — this only
 * decides whether there is anything worth drawing.
 */

import { useQuery } from '@tanstack/react-query';
import { feedbackApi } from '@/api/feedback';
import { queryKeys } from '@/services/queryKeys';

export function useTestimonials(limit = 6) {
  return useQuery({
    queryKey: queryKeys.testimonials.list(limit),
    queryFn: ({ signal }) => feedbackApi.listPublicTestimonials(limit, signal),
    staleTime: 10 * 60_000,
    // A homepage section is not worth retrying hard for; if it fails the
    // section is simply not drawn.
    retry: false,
  });
}
