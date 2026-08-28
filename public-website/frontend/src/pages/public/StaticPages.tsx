/**
 * pages/public/StaticPages.tsx
 * ────────────────────────────
 * Content pages with no API dependency: features, FAQ, docs index, docs
 * article, privacy, terms, and the 404 / 403 pages.
 *
 * Grouped in one module because each is a thin wrapper over authored copy from
 * `constants/content`. Anything that talks to the API lives in its own file.
 */

import { Link, useParams } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { Accordion } from '@/components/common/Accordion';
import { ROUTES } from '@/constants/routes';
import { DOCS, FAQS, FEATURES, PRODUCT } from '@/constants/content';
import { config } from '@/constants/config';
import {
  BookIcon,
  ChevronRightIcon,
  LockIcon,
  SearchIcon,
} from '@/components/common/Icons';

// ── Shared page header ──────────────────────────────────────────────────────

function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="border-b border-ink-200 bg-ink-50">
      <div className="container-page py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="heading-1 mt-3">{title}</h1>
          {lede ? <p className="lede mt-4">{lede}</p> : null}
        </div>
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────────────────────

export function FeaturesPage() {
  return (
    <>
      <PageMeta
        title="Features"
        description="Endpoint inventory, risk scoring, ranked remediation, trend analytics and verified builds."
        canonicalPath="/features"
      />
      <PageHeader
        eyebrow="Features"
        title="What RiskIntel does"
        lede="Six capabilities that turn raw findings into a queue your team can actually work through."
      />

      <section className="section">
        <div className="container-page">
          <div className="space-y-6">
            {FEATURES.map((feature, index) => (
              <article key={feature.id} className="card">
                <div className="card-body sm:flex sm:gap-8">
                  <div className="sm:w-52 sm:shrink-0">
                    <p className="font-mono text-xs font-semibold text-brand-600">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h2 className="heading-3 mt-1">{feature.title}</h2>
                    <p className="mt-1 text-sm font-medium text-ink-500">{feature.summary}</p>
                  </div>
                  <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-600 sm:mt-0">
                    {feature.detail}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link to={ROUTES.download} className="btn-primary">
              Download RiskIntel
            </Link>
            <Link to={ROUTES.docs} className="btn-secondary">
              Read the documentation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────

export function FaqPage() {
  return (
    <>
      <PageMeta
        title="Frequently asked questions"
        description="Answers about accounts, downloads, checksum verification, data collection and support."
        canonicalPath="/faq"
      />
      <PageHeader
        eyebrow="Support"
        title="Frequently asked questions"
        lede="If your question is not answered here, send us a message and a person will reply."
      />

      <section className="section">
        <div className="container-narrow">
          <Accordion items={FAQS} />

          <div className="mt-10 panel text-center">
            <h2 className="heading-3">Still stuck?</h2>
            <p className="mt-2 text-sm text-ink-600">
              Send a contact request and track its progress from your account.
            </p>
            <Link to={ROUTES.contact} className="btn-primary mt-4">
              Contact support
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Documentation index ─────────────────────────────────────────────────────

export function DocsPage() {
  return (
    <>
      <PageMeta
        title="Documentation"
        description="Getting started, deployment, the security model and troubleshooting."
        canonicalPath="/docs"
      />
      <PageHeader
        eyebrow="Documentation"
        title="Documentation"
        lede="Everything needed to get RiskIntel running and to understand how it handles your data."
      />

      <section className="section">
        <div className="container-page">
          <ul className="grid gap-5 sm:grid-cols-2">
            {DOCS.map((doc) => (
              <li key={doc.slug}>
                <Link
                  to={ROUTES.docsArticle(doc.slug)}
                  className="card card-hover block h-full focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="card-body">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <BookIcon className="h-5 w-5" />
                    </span>
                    <h2 className="heading-3 mt-4">{doc.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">{doc.summary}</p>
                    <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                      Read
                      <ChevronRightIcon className="h-4 w-4" />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

// ── Documentation article ───────────────────────────────────────────────────

export function DocsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = DOCS.find((entry) => entry.slug === slug);

  if (!doc) {
    return (
      <>
        <PageMeta title="Page not found" noIndex />
        <section className="section">
          <div className="container-narrow text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
              <SearchIcon className="h-6 w-6" />
            </span>
            <h1 className="heading-2 mt-4">That page does not exist</h1>
            <p className="mt-2 text-sm text-ink-600">
              The documentation article you asked for is not one we publish.
            </p>
            <Link to={ROUTES.docs} className="btn-primary mt-6">
              Back to documentation
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={doc.title}
        description={doc.summary}
        canonicalPath={ROUTES.docsArticle(doc.slug)}
        ogType="article"
      />

      <section className="border-b border-ink-200 bg-ink-50">
        <div className="container-narrow py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-2 text-sm text-ink-500">
              <li>
                <Link to={ROUTES.docs} className="link">
                  Documentation
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRightIcon className="h-4 w-4" />
              </li>
              <li aria-current="page" className="font-medium text-ink-700">
                {doc.title}
              </li>
            </ol>
          </nav>
          <h1 className="heading-1">{doc.title}</h1>
          <p className="lede mt-3">{doc.summary}</p>
        </div>
      </section>

      <section className="section">
        <div className="container-narrow">
          <article className="space-y-10">
            {doc.body.map((block) => (
              <div key={block.heading}>
                <h2 className="heading-2">{block.heading}</h2>
                <div className="mt-3 space-y-3">
                  {block.paragraphs.map((paragraph, index) => (
                    <p key={index} className="prose-body">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {block.list ? (
                  <ul className="mt-4 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-4">
                    {block.list.map((entry) => (
                      <li key={entry} className="break-anywhere font-mono text-xs text-ink-700">
                        {entry}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </article>

          <nav className="mt-14 border-t border-ink-200 pt-6" aria-label="Other documentation">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Other sections
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {DOCS.filter((entry) => entry.slug !== doc.slug).map((entry) => (
                <li key={entry.slug}>
                  <Link to={ROUTES.docsArticle(entry.slug)} className="btn-secondary btn-sm">
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </>
  );
}

// ── Legal ───────────────────────────────────────────────────────────────────

function LegalShell({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
}) {
  return (
    <section className="section">
      <div className="container-narrow">
        <h1 className="heading-1">{title}</h1>
        <p className="lede mt-4">{intro}</p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="heading-2">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="prose-body">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-ink-200 pt-6 text-sm text-ink-500">
          Questions about this page? Email{' '}
          <a href={`mailto:${config.supportEmail}`} className="link">
            {config.supportEmail}
          </a>
          .
        </p>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <>
      <PageMeta
        title="Privacy policy"
        description="What this website collects, why, and how long it is kept."
        canonicalPath="/privacy"
      />
      <LegalShell
        title="Privacy policy"
        intro="This describes what the RiskIntel public website collects and what is done with it. It covers this website only, not the analysis backend you run inside your own environment."
        sections={[
          {
            heading: 'What we collect',
            paragraphs: [
              'When you register we store your name, email address, country code and, if you supply one, your company name. Your password is never stored: only an Argon2id hash of it is kept, which cannot be reversed into the original.',
              'When you record a download we store which release you obtained and when. The network address and browser used are recorded server-side so abuse can be investigated. Those two fields are deliberately not returned by the API and are not shown anywhere in this interface.',
              'Feedback and contact requests store what you wrote, along with the account that wrote it, so we can reply and so you can track the status yourself.',
            ],
          },
          {
            heading: 'Why we collect it',
            paragraphs: [
              'Account details let us authenticate you and reply to you. Download records give both of us an auditable history of who obtained which build, which matters for security software. Feedback and contact records exist so requests are not lost.',
              'We do not sell this data, and we do not use it for advertising.',
            ],
          },
          {
            heading: 'Cookies and storage',
            paragraphs: [
              'This site sets no advertising or analytics cookies. To keep you signed in between page loads, a session token is held in your browser session storage, which your browser discards when you close the tab. Signing out removes it immediately.',
            ],
          },
          {
            heading: 'Your choices',
            paragraphs: [
              'You can view and correct your name, country and company at any time from your profile page. To ask for your account and its associated records to be removed, send us a contact request and we will handle it.',
            ],
          },
        ]}
      />
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <PageMeta
        title="Terms of service"
        description="The terms that apply to using this website and the software published on it."
        canonicalPath="/terms"
      />
      <LegalShell
        title="Terms of service"
        intro={`These terms cover your use of the ${PRODUCT.name} website and the software published through it.`}
        sections={[
          {
            heading: 'Your account',
            paragraphs: [
              'You are responsible for what happens under your account and for keeping your password to yourself. Tell us promptly if you believe someone else has access to it.',
              'Accounts are for the person who registered them. Do not share credentials, and do not attempt to reach data belonging to another account.',
            ],
          },
          {
            heading: 'Acceptable use',
            paragraphs: [
              'Use the software on systems you own or are authorised to assess. Do not use it to probe infrastructure you have no permission to test.',
              'Do not attempt to disrupt this service, work around its rate limits, or access parts of it you have not been granted.',
            ],
          },
          {
            heading: 'Software and verification',
            paragraphs: [
              'Builds are published with a SHA-256 checksum. Verify what you download before you run it. We cannot vouch for a copy obtained anywhere other than this site.',
              'The software is provided as it is. Its findings inform your security decisions; they do not replace your own judgement about your environment.',
            ],
          },
          {
            heading: 'Changes',
            paragraphs: [
              'These terms may be updated as the product changes. Continuing to use the site after an update means the updated terms apply to you.',
            ],
          },
        ]}
      />
    </>
  );
}

// ── Error pages ─────────────────────────────────────────────────────────────

export function NotFoundPage() {
  return (
    <>
      <PageMeta title="Page not found" noIndex />
      <section className="section">
        <div className="container-narrow text-center">
          <p className="font-mono text-sm font-semibold text-brand-600">404</p>
          <h1 className="heading-1 mt-2">We cannot find that page</h1>
          <p className="lede mx-auto mt-4 max-w-lg">
            The address may be mistyped, or the page may have moved. Nothing has gone wrong with
            your account.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={ROUTES.home} className="btn-primary">
              Go to the homepage
            </Link>
            <Link to={ROUTES.contact} className="btn-secondary">
              Report a broken link
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function ForbiddenPage() {
  return (
    <>
      <PageMeta title="Access denied" noIndex />
      <section className="section">
        <div className="container-narrow text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <LockIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-mono text-sm font-semibold text-danger-600">403</p>
          <h1 className="heading-1 mt-2">You do not have access to that</h1>
          <p className="lede mx-auto mt-4 max-w-lg">
            Your account is signed in, but it is not permitted to view that area. If you believe it
            should be, ask an administrator to review your role.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={ROUTES.profile} className="btn-primary">
              Go to your account
            </Link>
            <Link to={ROUTES.home} className="btn-secondary">
              Go to the homepage
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
