/**
 * pages/auth/AuthShell.tsx
 * ────────────────────────
 * Shared frame for the authentication pages, so sign-in, registration and the
 * password flows read as one sequence rather than four different screens.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { PRODUCT } from '@/constants/content';
import { ShieldIcon } from '@/components/common/Icons';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered under the card, e.g. a link to the other flow. */
  footer?: ReactNode;
  /** Wider frame for the registration form, which has more fields. */
  wide?: boolean;
}

export function AuthShell({ title, subtitle, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50 px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <div className="mb-8 text-center">
          <Link
            to={ROUTES.home}
            className="inline-flex items-center gap-2 rounded-lg"
            aria-label={`${PRODUCT.name} home`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-950">{PRODUCT.name}</span>
          </Link>
        </div>

        <div className="card">
          <div className="card-body sm:p-8">
            <h1 className="heading-2">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-ink-600">{subtitle}</p> : null}
            <div className="mt-7">{children}</div>
          </div>
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-ink-600">{footer}</div> : null}
      </div>
    </div>
  );
}
