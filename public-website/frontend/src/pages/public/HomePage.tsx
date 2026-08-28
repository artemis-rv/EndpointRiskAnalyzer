/**
 * pages/public/HomePage.tsx
 * ─────────────────────────
 * The homepage answers, in the first screenful: what this is, what it fixes,
 * and what to do next.
 *
 * The only live data here is the latest release, which comes from the public
 * `/releases/latest` endpoint. It has all four states: loading, the release,
 * "nothing published yet" (a 404 from that endpoint, which is a normal
 * condition rather than a failure), and an error with a way to retry.
 */

import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/seo/PageMeta';
import { ROUTES } from '@/constants/routes';
import { FEATURES, PRODUCT, TRUST_POINTS } from '@/constants/content';
import { useLatestRelease } from '@/hooks/useReleases';
import { useTestimonials } from '@/hooks/useTestimonials';
import { formatBytes, formatDate, isoDateAttr } from '@/utils/format';
import { Spinner } from '@/components/common/Spinner';
import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  ShieldIcon,
  StarIcon,
} from '@/components/common/Icons';

function LatestReleasePanel() {
  const { data: release, isLoading, isError, notPublished, refetch } = useLatestRelease();

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-3 rounded-card border border-white/15 bg-white/10 px-5 py-4"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-5 w-5 text-white" />
        <p className="text-sm text-white/80">Checking for the latest release…</p>
      </div>
    );
  }

  if (notPublished) {
    return (
      <div className="rounded-card border border-white/15 bg-white/10 px-5 py-4">
        <p className="text-sm font-semibold text-white">No public release yet</p>
        <p className="mt-1 text-sm text-white/70">
          Nothing has been published so far. Get in touch and we will let you know when the first
          build is available.
        </p>
      </div>
    );
  }

  if (isError || !release) {
    return (
      <div className="rounded-card border border-white/15 bg-white/10 px-5 py-4" role="alert">
        <p className="text-sm font-semibold text-white">Release information unavailable</p>
        <p className="mt-1 text-sm text-white/70">
          We could not load the latest release just now.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 rounded text-sm font-semibold text-white underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-white/15 bg-white/10 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">
        Latest release
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-white">
        <span className="font-mono text-lg font-bold">v{release.version}</span>
        <span className="text-sm text-white/70">{release.title}</span>
      </p>
      <p className="mt-1 text-xs text-white/60">
        Published{' '}
        <time dateTime={isoDateAttr(release.published_at)}>
          {formatDate(release.published_at)}
        </time>{' '}
        &middot; {formatBytes(release.file_size)} &middot; SHA-256 verified
      </p>
    </div>
  );
}

/**
 * Approved testimonials.
 *
 * Renders nothing at all until the server has some. An empty or failed request
 * means the section is simply absent — a marketing block is not worth an error
 * message, and inventing filler quotes to occupy the space would be worse than
 * leaving it out.
 *
 * The content is author-written text from the API and is rendered as text.
 */
function TestimonialsSection() {
  const { data, isLoading, isError } = useTestimonials(6);

  if (isLoading || isError || !data || data.length === 0) return null;

  return (
    <section className="section bg-ink-50">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">In their words</p>
          <h2 className="heading-2 mt-3">What teams using RiskIntel say</h2>
          <p className="lede mt-3">
            Submitted by account holders and approved for publication.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item, index) => (
            <li key={`${item.created_at}-${index}`}>
              <figure className="card h-full">
                <div className="card-body">
                  {item.rating !== null ? (
                    <p className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarIcon
                          key={star}
                          filled={star <= (item.rating ?? 0)}
                          className={`h-4 w-4 ${
                            star <= (item.rating ?? 0) ? 'text-warning-500' : 'text-ink-300'
                          }`}
                        />
                      ))}
                      <span className="sr-only">{item.rating} out of 5</span>
                    </p>
                  ) : null}

                  <h3 className="heading-3 mt-3 break-words">{item.title}</h3>
                  <blockquote className="mt-2">
                    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                      {item.description}
                    </p>
                  </blockquote>
                </div>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <PageMeta
        title="Endpoint risk analysis"
        description={PRODUCT.summary}
        canonicalPath="/"
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-950">
        {/* Decorative only; carries no information. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_36rem_at_75%_-10%,rgba(51,85,245,0.45),transparent)]"
        />

        <div className="container-page relative py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100">
                <ShieldIcon className="h-3.5 w-3.5" />
                Endpoint risk analyzer
              </p>

              <h1 className="heading-1 mt-5 text-white">{PRODUCT.tagline}</h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                {PRODUCT.summary}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={ROUTES.download} className="btn-primary btn-lg">
                  <DownloadIcon className="h-5 w-5" />
                  Get RiskIntel
                </Link>
                <Link
                  to={ROUTES.features}
                  className="btn-lg inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-transparent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  See what it does
                  <ChevronRightIcon className="h-5 w-5" />
                </Link>
              </div>

              <p className="mt-4 text-xs text-white/55">
                Free to download. An account with a verified email is required.
              </p>
            </div>

            <div className="lg:pl-4">
              <LatestReleasePanel />
            </div>
          </div>
        </div>
      </section>

      {/* ── The problem ───────────────────────────────────────────────────── */}
      <section className="section border-b border-ink-100">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">The problem</p>
            <h2 className="heading-2 mt-3">Findings are cheap. Knowing what matters is not.</h2>
            <p className="lede mt-4">{PRODUCT.problem}</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Collect',
                body: 'The agent reports what is installed and how each endpoint is configured.',
              },
              {
                step: '2',
                title: 'Score',
                body: 'Findings are weighted by exploitability and exposure into one number per machine.',
              },
              {
                step: '3',
                title: 'Fix',
                body: 'Your team gets a ranked queue with the remediation attached to each item.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                  {item.step}
                </span>
                <h3 className="heading-3 mt-4">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section bg-ink-50">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="eyebrow">Capabilities</p>
            <h2 className="heading-2 mt-3">What you get</h2>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.id}>
                <div className="card card-hover h-full">
                  <div className="card-body">
                    <h3 className="heading-3">{feature.title}</h3>
                    <p className="mt-1 text-sm font-medium text-brand-700">{feature.summary}</p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-600">{feature.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link to={ROUTES.features} className="link">
              See the full feature breakdown
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="eyebrow">How this is built</p>
              <h2 className="heading-2 mt-3">Security you can check, not just claims</h2>
              <p className="lede mt-4">
                Every statement here describes how this system actually works. Read the security
                model if you want the detail.
              </p>
              <Link to={ROUTES.docsArticle('security')} className="link mt-4 inline-block">
                Read the security model
              </Link>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {TRUST_POINTS.map((point) => (
                <li key={point.id} className="panel">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">{point.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{point.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* ── Closing call to action ────────────────────────────────────────── */}
      <section className="border-t border-ink-200 bg-ink-50">
        <div className="container-page py-14">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="heading-2">Ready to see your fleet?</h2>
              <p className="mt-2 text-sm text-ink-600">
                Create an account, verify your email, and download the latest build.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={ROUTES.register} className="btn-primary btn-lg">
                Create an account
              </Link>
              <Link to={ROUTES.contact} className="btn-secondary btn-lg">
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
