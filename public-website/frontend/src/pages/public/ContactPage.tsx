/**
 * pages/public/ContactPage.tsx
 * ────────────────────────────
 * Public contact page.
 *
 * `POST /api/v1/contact` is an authenticated endpoint, so a visitor who is not
 * signed in is told that plainly and given both routes forward: sign in to file
 * a tracked request, or email support directly. Showing a form that could only
 * fail on submit would be worse than saying so up front.
 */

import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { ContactForm } from '@/components/forms/ContactForm';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { config } from '@/constants/config';
import { CONTACT_CATEGORY_LABELS } from '@/constants/content';
import { ContactCategory } from '@/types/api';
import { Alert } from '@/components/common/Alert';
import { MailIcon, InboxIcon, LockIcon } from '@/components/common/Icons';

export function ContactPage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <PageMeta
        title="Contact us"
        description="Get in touch about sales, support, bugs, feature requests or partnerships."
        canonicalPath="/contact"
      />

      <section className="border-b border-ink-200 bg-ink-50">
        <div className="container-page py-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Contact</p>
            <h1 className="heading-1 mt-3">Talk to us</h1>
            <p className="lede mt-4">
              Send a message and a person will reply. Requests filed from your account can be
              tracked, so you always know where yours stands.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            {/* Form or sign-in prompt */}
            <div>
              {isAuthenticated ? (
                <div className="card">
                  <div className="card-body">
                    <h2 className="heading-3">Send a message</h2>
                    <p className="mt-1 text-sm text-ink-500">
                      All fields marked with an asterisk are required.
                    </p>
                    <div className="mt-6">
                      <ContactForm />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-body">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <LockIcon className="h-5 w-5" />
                    </span>
                    <h2 className="heading-3 mt-4">Sign in to file a tracked request</h2>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-600">
                      Contact requests are attached to an account so we can reply to you and so you
                      can follow the status yourself. Sign in, or create an account, to send one.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Link
                        to={ROUTES.login}
                        state={{ from: ROUTES.contact }}
                        className="btn-primary"
                      >
                        Sign in
                      </Link>
                      <Link to={ROUTES.register} className="btn-secondary">
                        Create an account
                      </Link>
                    </div>

                    <Alert tone="info" className="mt-6">
                      <p className="text-sm">
                        Would rather not create an account? Email{' '}
                        <a href={`mailto:${config.supportEmail}`} className="link">
                          {config.supportEmail}
                        </a>{' '}
                        instead. Those messages are not tracked in this interface.
                      </p>
                    </Alert>
                  </div>
                </div>
              )}
            </div>

            {/* Supporting information */}
            <aside className="space-y-5">
              <div className="panel">
                <h2 className="heading-3">What each category means</h2>
                <dl className="mt-4 space-y-3">
                  {(
                    [
                      [ContactCategory.SALES, 'Pricing, licensing and procurement questions.'],
                      [ContactCategory.SUPPORT, 'Trouble running or configuring the product.'],
                      [ContactCategory.BUG, 'Something is behaving incorrectly.'],
                      [ContactCategory.FEATURE_REQUEST, 'Something you would like it to do.'],
                      [ContactCategory.PARTNERSHIP, 'Integrations and working together.'],
                      [ContactCategory.GENERAL, 'Anything that does not fit the others.'],
                    ] as const
                  ).map(([category, description]) => (
                    <div key={category}>
                      <dt className="text-sm font-semibold text-ink-800">
                        {CONTACT_CATEGORY_LABELS[category]}
                      </dt>
                      <dd className="text-sm text-ink-600">{description}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="panel">
                <h2 className="heading-3">Other ways to reach us</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-800">Email</span>
                      <a
                        href={`mailto:${config.supportEmail}`}
                        className="link break-anywhere"
                      >
                        {config.supportEmail}
                      </a>
                    </span>
                  </li>
                  {isAuthenticated ? (
                    <li className="flex items-start gap-3">
                      <InboxIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />
                      <span>
                        <span className="block font-medium text-ink-800">Your requests</span>
                        <Link to={ROUTES.myRequests} className="link">
                          Track everything you have sent
                        </Link>
                      </span>
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="panel">
                <h2 className="heading-3">Check the FAQ first</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Accounts, downloads and checksum verification are covered there, and it is faster
                  than waiting for a reply.
                </p>
                <Link to={ROUTES.faq} className="link mt-3 inline-block text-sm">
                  Read the FAQ
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
