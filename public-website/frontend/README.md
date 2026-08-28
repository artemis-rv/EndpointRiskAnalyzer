# RiskIntel Public Website — Frontend

The public-facing website for RiskIntel: product information, accounts,
release browsing, downloads, feedback, contact requests, and the administrative
panel.

It is a client of the FastAPI backend in `../backend`. It holds no business
logic of its own, talks to no database, and makes no authorisation decision that
matters.

---

## Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Development commands](#development-commands)
- [Production build](#production-build)
- [Testing](#testing)
- [Project structure](#project-structure)
- [API configuration](#api-configuration)
- [Backend contract audit](#backend-contract-audit)
- [Security considerations](#security-considerations)
- [Accessibility](#accessibility)
- [Deployment notes](#deployment-notes)

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20.19+ or 22.12+ | Required by Vite 7 |
| npm | 10+ | Ships with Node |
| Backend | running | `../backend`, default `http://localhost:8080` |
| PostgreSQL | running | Used by the backend, not by this app |

Check with `node -v && npm -v`.

---

## Installation

```bash
cd public-website/frontend
npm install
```

Then create a local environment file:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. Fill in the values described below.

---

## Environment variables

Every variable is prefixed `VITE_`, which means **Vite inlines it into the
JavaScript bundle and it is public**. Anyone can read these values in devtools.

> **Never put a secret in this directory.** `DATABASE_URL`, `JWT_SECRET_KEY`,
> `SECRET_KEY`, `SMTP_PASSWORD`, API secrets and private keys belong in
> `../backend/.env` and must stay there. Frontend and backend environment files
> are deliberately separate and must not be merged.

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | no | `http://localhost:8080` | Backend origin, no trailing slash, no `/api/v1`. **Empty means same-origin**, which is correct behind a reverse proxy. |
| `VITE_SITE_URL` | no | `https://riskintel.example.com` | Public origin, used for canonical URLs and Open Graph tags. |
| `VITE_API_TIMEOUT_MS` | no | `15000` | Request timeout. Defaults to 15000. |
| `VITE_SUPPORT_EMAIL` | no | `support@example.com` | Public contact address shown on marketing pages. |
| `VITE_ENABLE_DEV_DIAGNOSTICS` | no | `true` | Verbose client diagnostics. Ignored entirely in production builds. |

Files, in Vite's precedence order:

| File | Committed | Purpose |
| --- | --- | --- |
| `.env.example` | yes | Template. Variable names only, never values. |
| `.env.development` | yes | Localhost defaults for development. Contains no secrets. |
| `.env.local` | **no** | Your machine. Overrides everything. |
| `.env.production` | **no** | Production values, supplied by your deploy pipeline. |

---

## Development commands

```bash
npm run dev          # dev server on http://localhost:3000
npm run build        # typecheck + production build into dist/
npm run preview      # serve the built dist/ on http://localhost:3000
npm run lint         # ESLint
npm run typecheck    # tsc for app, node and test projects
npm test             # run the test suite once
npm run test:watch   # watch mode
npm run audit        # npm audit for production dependencies
```

### The port is not arbitrary

The dev server is pinned to **3000** with `strictPort`. The backend's
`CORS_ORIGINS` allowlist contains `http://localhost:3000`, so a different port
is refused by the browser. Changing it requires a matching backend change.

---

## Production build

```bash
npm run build
```

`tsc -b` runs first, so a type error fails the build rather than shipping.
Output goes to `dist/`.

The build is configured so that a production bundle contains:

- no source maps (internal module paths are not shipped)
- no `console.log`
- no development-only URLs — with `VITE_API_BASE_URL` unset the client uses the
  current origin
- no secrets, because none are ever available to it

Verify a build before shipping:

```bash
grep -rn "localhost" dist/ || echo "clean"
grep -rc "console\.log" dist/assets/*.js
ls dist/assets/*.map 2>/dev/null || echo "no sourcemaps"
```

Chunks are split so a visitor who never signs in never downloads the account or
admin code.

---

## Testing

```bash
npm test
```

`vitest` + React Testing Library + jsdom. **87 tests across 7 files.**

The backend has its own suite: **122 passed, 1 skipped** (`pytest app/tests` from
`public-website/backend`), including path-traversal, CORS-on-500, download
delivery and admin authorisation tests added in Phase 6.12.

| File | Covers |
| --- | --- |
| `api/client/http.test.ts` | Status-to-error mapping, auth headers, refresh-and-retry, cancellation vs timeout, query serialisation, driver errors never reaching the user |
| `api/client/tokenStore.test.ts` | Access token never persisted, `localStorage` never written, expiry, clearing |
| `routes/guards.test.tsx` | Unauthenticated redirect, admin refusal, `SUPER_ADMIN` uses the same admin area, session restore, stale token handling |
| `test/integration.test.tsx` | Sign-in, registration, release listing, download recording, feedback, contact, 422 field mapping, double-submit prevention |
| `test/security.test.tsx` | Source-tree scans: no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no `localStorage`, no secrets, no tokens in logs or URLs, no bare `fetch`; plus live XSS payload rendering |
| `test/cancellation.test.tsx` | A failing request under StrictMode double-mounting reports failure rather than emptiness |
| `components/common/components.test.tsx` | Buttons, alerts, the four async states, dialog focus trap and Escape, pagination, accordion, form field wiring |

Tests query by role and label rather than test ids, so a passing test also
demonstrates the component is reachable by assistive technology.

`fetch` is stubbed globally and **throws by default**, so an accidental network
call fails loudly instead of passing for the wrong reason.

---

## Project structure

```
src/
├── api/                  # the only place that talks to the network
│   ├── client/
│   │   ├── http.ts       # the single HTTP client
│   │   ├── errors.ts     # ApiError, status mapping, safe messages
│   │   └── tokenStore.ts # the only module holding auth material
│   ├── auth/  users/  releases/  downloads/  feedback/  contact/
│   └── admin/            # imported only by pages/admin
├── components/
│   ├── common/           # Button, Card, Badge, Alert, Modal, States, …
│   ├── forms/  feedback/  releases/  navigation/  admin/  seo/
├── constants/            # config (the only reader of import.meta.env), routes, content
├── context/              # authContext.ts + AuthProvider.tsx
├── hooks/                # useAuth, usePagination, useReleases, useMyActivity, useAdmin
├── layouts/              # GuestLayout, UserLayout, AdminLayout
├── pages/                # public/ auth/ user/ admin/
├── routes/               # AppRoutes.tsx, guards.tsx
├── services/             # queryClient.ts, queryKeys.ts
├── styles/               # index.css — the design system
├── test/                 # setup, helpers, cross-cutting suites
├── types/api.ts          # TypeScript mirror of the backend contract
└── utils/                # format, validation, queryState
```

The dependency rule: **components never call `fetch`.** A component uses a hook,
the hook uses an API module, the API module uses the HTTP client. This is
enforced by a test that fails if a bare `fetch(` appears anywhere outside the
client.

`api/admin` and `pages/admin` are the only modules that touch administrative
endpoints, so no public page can pull admin data into a cache it reads.

---

## API configuration

```
Component → Hook → API module → HTTP client → FastAPI
```

`src/api/client/http.ts` centralises the base URL, the `/api/v1` prefix, JSON
encoding, the `Authorization` header, timeouts, transparent token refresh, and
the normalising of every failure into an `ApiError`.

Server state is held by TanStack Query. Cache keys live in one table
(`services/queryKeys.ts`) so invalidation targets the right entries. Public data
is cached; account-scoped data lives under a `me` root and the entire cache is
cleared on sign-out.

### Error handling

Every failure becomes an `ApiError` with a `kind`, so pages branch on meaning
rather than on numbers: `network`, `timeout`, `bad_request`, `unauthorized`,
`forbidden`, `not_found`, `conflict`, `validation`, `rate_limited`, `server`,
`unavailable`.

A backend message is shown **only** when it reads as prose written for a person.
Anything resembling a stack trace, SQL, or a driver error is replaced with a
plain sentence. So a `psycopg2.errors.UniqueViolation` never reaches a screen;
"That conflicts with something that already exists." does.

422 responses carry field-level detail, which is mapped back onto the inputs
that caused it.

### The four states, and a fifth

Every API-driven view handles **loading, empty, error, success**. Two rules the
codebase enforces:

1. **An error wins over emptiness.** A failed request has no rows, but "this
   failed" and "there is nothing here" are different and the person needs to
   know which.
2. **Emptiness is only claimed once the server has answered.** Inferring "empty"
   from absent data reports a request that never resolved as "nothing exists" —
   a confident claim about something unknown, dressed as a successful answer.

There is a fifth state: a **parked** request, which the query layer creates when
it believes there is no connection. It is neither loading nor failed, so it is
named explicitly and offered a retry rather than spinning forever.

---

## Backend contract audit

Verified against a running backend and its OpenAPI document. As of **Phase 6.12**
every endpoint this frontend calls exists and is exercised end to end.

Endpoints added in 6.12 and now consumed here:

| Endpoint | Used by |
| --- | --- |
| `GET /api/v1/downloads/{release_id}/file` | The download button — authorises, records and streams |
| `GET /api/v1/admin/users` | `/admin/users` |
| `GET /api/v1/admin/downloads` | `/admin/downloads` and the overview tile |
| `GET /api/v1/feedback/testimonials` | Homepage testimonials |
| `POST /api/v1/auth/resend-verification` | Verification banner |

### The download flow

```
Download button
  → GET /downloads/{id}/file  (Authorization header, never a URL token)
    → authenticate → verify email → release PUBLISHED?
      → resolve artefact inside the storage root → hourly limit
        → write the download record → stream
  → Blob → anchor[download] → browser saves
```

Fetched rather than linked, because an anchor cannot carry an `Authorization`
header and a credential in a URL leaks into history, logs and referrers. The
response is buffered into a Blob, which holds the artefact in memory for the
duration of the save — the accepted cost of not weakening the auth scheme. For
artefacts large enough that this matters, a short-lived single-use download
ticket would be the next step.

`Content-Disposition` is read for the filename, which requires the backend to
list it in `expose_headers` — it is not CORS-safelisted, and without that the
file saves under a generic name.

### Deliberate gaps that remain

- **No attribution on testimonials.** `PublicTestimonialResponse` carries no
  name, company or id. Approval makes the *content* public; it does not make the
  author public. Attribution would need consent captured at submission.
- **`POST /api/v1/downloads` is unused by this site.** It records without
  delivering; calling it as well as the delivery endpoint would write two rows
  for one download.
- **`SUPER_ADMIN` uses the same `/admin` area.** There is no separate portal.

## Security considerations

### Authorisation is not done here

Route guards decide what to draw. They are **not** a security boundary: the
bundle is public, client state is editable, and anyone can render any component.
What protects data is that every request carries a bearer token the server
validates, and every protected endpoint re-checks the caller through
`get_current_user` / `require_verified` / `require_admin`. A non-admin who forces
their way to `/admin/users` sees the shell and a column of 403s. That is the
design working.

### Token handling

The backend returns bearer tokens in the JSON body and sets no cookies, so a
cookie-only design is not available without changing it. Given that:

| Token | Where | Why |
| --- | --- | --- |
| Access token | **memory only** | Never persisted. Dies with the tab. |
| Refresh token | **`sessionStorage`** | Lets a reload keep you signed in. Tab-scoped, cleared when the tab closes, never shared across tabs. |

`localStorage` is never used, and a lint rule plus a test enforce that.

**Accepted risk:** any script on this origin can read `sessionStorage`. The
mitigations are that no third-party scripts are loaded, no HTML from any source
is ever rendered, and the backend rotates refresh tokens on every use, so a
captured token is single-use at worst. Moving to HTTP-only cookies would require
a backend change and would remove this trade-off entirely.

Tokens are never logged, never placed in a URL, and never included in an error
message.

### OWASP Top 10

| Risk | Handling |
| --- | --- |
| **A01 Broken access control** | Guards are UX only; the server authorises every request. No path contains a user id — `/users/me` derives the subject from the token, so a client cannot name another account. |
| **A02 Cryptographic failures** | Passwords exist only as a request payload and are cleared from state after submission. No secret is ever available to this app. HTTPS in production. |
| **A03 Injection** | `dangerouslySetInnerHTML` is banned by lint and by test. No `innerHTML`, no `document.write`, no `eval`. All server text renders as text nodes. A test injects `<script>` and `<img onerror>` through the API and asserts no element is created. |
| **A04 Insecure design** | Client validation is for usability and mirrors the backend's Pydantic constraints; the server re-validates and its answer is authoritative. Safe defaults throughout. |
| **A05 Security misconfiguration** | Production builds ship no source maps, no `console.log`, no stack traces. The error boundary shows an apology, never the error. |
| **A06 Vulnerable components** | Small dependency surface, lockfile committed, `npm audit` reports **0 vulnerabilities**. |
| **A07 Authentication failures** | Explicit auth states including `initialising`, so a guard never mistakes "not checked yet" for "not signed in". Session expiry is surfaced and recoverable. Sign-in failures are uniform so they cannot be used to discover which addresses have accounts. Password reset always answers identically. |
| **A08 Data integrity failures** | No remote scripts. Icons are hand-rolled inline SVG. Only Google Fonts is loaded, over TLS. Lockfile pins the tree. |
| **A09 Logging failures** | No `console.log` in shipped code. A test scans every log call for token, password, authorization or secret. Error reporting is limited to error identity. |
| **A10 SSRF** | No user input reaches a request URL. All destinations derive from `VITE_API_BASE_URL` plus fixed paths. No proxy accepts an arbitrary URL. |

### Git hygiene

`.gitignore` excludes `.env`, `.env.*` (except the two committed templates),
`node_modules/`, `dist/`, `coverage/`, `*.log`, and certificate and key files.
No secret has been committed from this directory.

> If a secret is ever committed anywhere in this repository, removing the file is
> not enough. The secret must be rotated at its source and the history addressed
> separately.

---

## Accessibility

- Semantic HTML first; ARIA only where markup cannot express the meaning.
- Every input has a real `<label>`, with hints and errors linked by
  `aria-describedby` and `aria-invalid` set on failure.
- Focus is never removed. A single visible focus ring is defined once.
- A skip link precedes the navigation in all three layouts.
- Route changes move focus to `<main>`, restoring what a page load would do.
- The dialog traps focus, cycles with Tab and Shift+Tab, closes on Escape, and
  returns focus to whatever opened it.
- Status is never carried by colour alone; every badge has a text label.
- No interaction depends on hover. Copy confirmation is announced in a live
  region rather than a tooltip.
- Errors use `role="alert"`; success uses `role="status"` so it does not steal
  focus.
- Touch targets are at least 44px. Admin tables scroll inside their own
  container so the page never scrolls sideways.
- `prefers-reduced-motion` is respected.

---

## Deployment notes

### Security headers belong to the reverse proxy

This app deliberately sets no HTTP security headers — a SPA cannot set headers
for its own document. Configure them at the proxy or CDN. The backend already
sets its own for API responses.

Suggested starting point for the document response:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

Notes before enabling:

- `style-src` needs `'unsafe-inline'` because Tailwind emits inline styles.
  Removing it requires a nonce or hash strategy.
- `connect-src` must include whatever `VITE_API_BASE_URL` points at. If the API
  is proxied under the same origin, `'self'` alone is enough — the better
  arrangement, since it also removes the CORS surface.
- The Google Fonts entries can be dropped if fonts are self-hosted.
- Do not enable a restrictive CSP during development without testing; the dev
  server relies on inline scripts and a websocket.

### SPA routing

The app uses history routing, so every unknown path must serve `index.html` or
deep links will 404:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Caching

Assets under `/assets/` are content-hashed and safe to cache immutably.
`index.html` must **not** be cached, or clients will keep loading an old bundle.

```nginx
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location = /index.html { add_header Cache-Control "no-cache"; }
```

### CORS

Serving the site and the API from the same origin removes CORS entirely and is
the recommended production arrangement. Otherwise, add the site's origin to
`CORS_ORIGINS` in the backend environment. Never add `*` — the backend sends
credentials, and a wildcard combined with credentials is a data-theft primitive
(the backend has a guard against exactly this).

### Before going live

- [ ] `VITE_API_BASE_URL` set, or the API proxied under the same origin
- [ ] `VITE_SITE_URL` set so canonical and Open Graph URLs are absolute
- [ ] `public/robots.txt` sitemap line points at the production origin
- [ ] `public/sitemap.xml` entries prefixed with the production origin
- [ ] Security headers configured at the proxy
- [ ] `index.html` served with `no-cache`
- [ ] SPA fallback configured
- [ ] HTTPS enforced, HSTS enabled
- [ ] `npm audit` reviewed
- [ ] **Backend enum defect resolved** — see the contract audit above
