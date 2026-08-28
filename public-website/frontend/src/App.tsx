/**
 * App.tsx
 * ───────
 * Composition root: providers, error boundary, router.
 *
 * Order matters. The error boundary sits outermost so a crash anywhere below
 * still renders something. The query client wraps the auth provider because
 * the auth provider clears the query cache on sign-out.
 */

import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthProvider';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { createQueryClient } from '@/services/queryClient';

export function App() {
  // Created once per mount rather than at module scope, so tests get a fresh
  // cache per render instead of leaking state between cases.
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
