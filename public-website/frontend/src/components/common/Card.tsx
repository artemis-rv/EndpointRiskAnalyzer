/**
 * components/common/Card.tsx
 * ──────────────────────────
 * Surface primitive. Renders a <section> when given a heading so the page keeps
 * a meaningful landmark structure, and a plain <div> otherwise.
 */

import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Removes the default inner padding for tables and custom layouts. */
  flush?: boolean;
  hoverable?: boolean;
}

export function Card({ children, className = '', flush = false, hoverable = false }: CardProps) {
  return (
    <div className={`card ${hoverable ? 'card-hover' : ''} ${className}`}>
      {flush ? children : <div className="card-body">{children}</div>}
    </div>
  );
}

export interface CardSectionProps {
  title: string;
  description?: string;
  /** Heading level, so cards nest correctly in the page outline. */
  headingLevel?: 2 | 3 | 4;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

export function CardSection({
  title,
  description,
  headingLevel = 2,
  actions,
  children,
  className = '',
  flush = false,
}: CardSectionProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <section className={`card ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <Heading className="heading-3">{title}</Heading>
          {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={flush ? '' : 'p-5 sm:p-6'}>{children}</div>
    </section>
  );
}
