/**
 * components/navigation/Footer.tsx
 * ────────────────────────────────
 * Site footer. Public links only — nothing here points into the admin area.
 */

import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { PRODUCT } from '@/constants/content';
import { config } from '@/constants/config';
import { ShieldIcon } from '@/components/common/Icons';

const COLUMNS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { to: ROUTES.features, label: 'Features' },
      { to: ROUTES.download, label: 'Download' },
      { to: ROUTES.docs, label: 'Documentation' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { to: ROUTES.faq, label: 'FAQ' },
      { to: ROUTES.contact, label: 'Contact us' },
      { to: ROUTES.docsArticle('troubleshooting'), label: 'Troubleshooting' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: ROUTES.privacy, label: 'Privacy policy' },
      { to: ROUTES.terms, label: 'Terms of service' },
      { to: ROUTES.docsArticle('security'), label: 'Security model' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-ink-200 bg-ink-50">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-8">
            <Link
              to={ROUTES.home}
              className="inline-flex items-center gap-2 rounded-lg text-ink-950"
              aria-label={`${PRODUCT.name} home`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <ShieldIcon className="h-5 w-5" />
              </span>
              <span className="text-base font-bold tracking-tight">{PRODUCT.name}</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">{PRODUCT.tagline}</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {column.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="rounded text-sm text-ink-600 transition-colors hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-500">
            &copy; {year} {PRODUCT.name}. All rights reserved.
          </p>
          <p className="text-xs text-ink-500">
            Questions?{' '}
            <a href={`mailto:${config.supportEmail}`} className="link">
              {config.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
