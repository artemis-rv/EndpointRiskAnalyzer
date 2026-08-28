/**
 * constants/content.ts
 * ────────────────────
 * Static marketing and documentation copy.
 *
 * This is authored site content, not data pretending to come from an API.
 * Anything the backend actually serves (releases, feedback, contact requests)
 * is fetched at runtime and never duplicated here.
 */

import type { ContactCategory, FeedbackType } from '@/types/api';

export const PRODUCT = {
  name: 'RiskIntel',
  tagline: 'See the risk on your endpoints before someone else does.',
  summary:
    'RiskIntel is an endpoint risk analyzer. It inventories the machines you run, scores what it finds against known weaknesses, and hands your team a ranked list of what to fix first.',
  problem:
    'Most teams already own more security tooling than they can read. The hard part is not collecting findings, it is knowing which of the thousands of findings actually matter on the machines you actually run.',
} as const;

export interface FeatureItem {
  id: string;
  title: string;
  summary: string;
  detail: string;
}

export const FEATURES: FeatureItem[] = [
  {
    id: 'inventory',
    title: 'Endpoint inventory',
    summary: 'Know exactly what is running where.',
    detail:
      'A lightweight agent reports installed software, versions, patch level and configuration for each endpoint, so your inventory reflects the machines as they are today rather than as they were at onboarding.',
  },
  {
    id: 'scoring',
    title: 'Risk scoring',
    summary: 'One comparable number per endpoint.',
    detail:
      'Findings are weighted by exploitability, exposure and the role the machine plays, then rolled up into a single score. Two endpoints with the same raw finding count can score very differently, which is the point.',
  },
  {
    id: 'prioritisation',
    title: 'Ranked remediation',
    summary: 'A queue, not a spreadsheet.',
    detail:
      'Every finding arrives with the fix attached and a position in the queue, so teams work top down instead of arguing about which report to read.',
  },
  {
    id: 'analytics',
    title: 'Trend analytics',
    summary: 'Show the curve bending.',
    detail:
      'Track score movement across the fleet over time, per team and per endpoint group, so remediation effort turns into a number you can take to a review.',
  },
  {
    id: 'integrity',
    title: 'Verified builds',
    summary: 'Every release is checksummed.',
    detail:
      'Each published release carries a SHA-256 checksum shown next to the download. Verify the file before you install it, and compare against the checksum published here.',
  },
  {
    id: 'privacy',
    title: 'Data minimisation',
    summary: 'Collect the finding, not the person.',
    detail:
      'The agent reports posture data about machines. Download records keep who obtained which build and when for audit purposes, and that record is visible to you on your own account page.',
  },
];

export interface TrustItem {
  id: string;
  title: string;
  detail: string;
}

/**
 * Verifiable statements about how this system is built. These describe the
 * implementation in this repository, not marketing claims about customers.
 */
export const TRUST_POINTS: TrustItem[] = [
  {
    id: 'hashing',
    title: 'Argon2id password hashing',
    detail:
      'Passwords are hashed with Argon2id using OWASP-aligned parameters. They are never stored, logged, or transmitted in a recoverable form.',
  },
  {
    id: 'sessions',
    title: 'Rotating refresh tokens',
    detail:
      'Sessions use short-lived access tokens paired with refresh tokens that rotate on every use, so a captured refresh token stops working the moment it is redeemed.',
  },
  {
    id: 'authorisation',
    title: 'Server-side authorisation',
    detail:
      'Every permission decision is made by the API. Hiding a control in the interface is a convenience for you, never the thing that keeps data safe.',
  },
  {
    id: 'integrity',
    title: 'Published checksums',
    detail:
      'Every release ships with a SHA-256 checksum so you can confirm the file you received is the file that was published.',
  },
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    id: 'what-is-it',
    question: 'What does RiskIntel actually do?',
    answer:
      'It collects posture data from your endpoints, scores each machine against known weaknesses, and produces a ranked list of remediation work. It is an analysis and prioritisation tool: it reports and ranks risk rather than blocking traffic or removing files.',
  },
  {
    id: 'account-required',
    question: 'Do I need an account to download?',
    answer:
      'Yes. Release listings, version numbers, release notes and checksums are public, but recording a download requires a signed-in account with a verified email address. This keeps an auditable record of who obtained which build.',
  },
  {
    id: 'verify-email',
    question: 'Why do I have to verify my email address?',
    answer:
      'Verification confirms the address belongs to you before the account can obtain builds. After registering, open the link in the verification email. Links expire, so use the most recent one you received.',
  },
  {
    id: 'checksum',
    question: 'How do I verify a download?',
    answer:
      'Every release shows its SHA-256 checksum. After downloading, compute the checksum of your copy and compare it with the value shown here. If the two differ, do not run the file.',
  },
  {
    id: 'data-collected',
    question: 'What data does the agent send?',
    answer:
      'Endpoint posture data: operating system and patch level, installed software and versions, and configuration relevant to the checks being run. The collection is scoped to what is needed to score risk.',
  },
  {
    id: 'feedback',
    question: 'How do I report a bug or request a feature?',
    answer:
      'Sign in and use the feedback form on your account. Bug reports and feature requests are triaged by the team, and you can follow the status of everything you have submitted from your feedback page.',
  },
  {
    id: 'support',
    question: 'How do I reach a human?',
    answer:
      'Use the contact form and pick the category that matches your question so it reaches the right queue. You can track the status of your request from your account.',
  },
  {
    id: 'password',
    question: 'What are the password requirements?',
    answer:
      'At least 12 characters, including an uppercase letter, a lowercase letter, a digit and a special character, and no longer than 72 characters.',
  },
];

export interface DocBlock {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface DocSection {
  slug: string;
  title: string;
  summary: string;
  body: DocBlock[];
}

export const DOCS: DocSection[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Create an account, verify your email and obtain your first build.',
    body: [
      {
        heading: 'Create an account',
        paragraphs: [
          'Registration needs your name, a work email address, a country code and a password that satisfies the policy. A company name is optional.',
          'After registering, check your inbox for a verification link. Until the address is verified, the account can sign in and browse but cannot record downloads.',
        ],
      },
      {
        heading: 'Obtain a build',
        paragraphs: [
          'Open the download page and choose a release. Published releases show their version, release notes, file size and SHA-256 checksum.',
          'Signing in before you download means the release is recorded against your account, and you can review that history at any time.',
        ],
      },
      {
        heading: 'Verify what you downloaded',
        paragraphs: [
          'Always compare the checksum of the file you received against the checksum shown on the release. A mismatch means the file is not the one that was published, and it should not be run.',
        ],
        list: [
          'Windows: certutil -hashfile riskintel-setup.exe SHA256',
          'Linux: sha256sum riskintel-setup.tar.gz',
          'macOS: shasum -a 256 riskintel-setup.pkg',
        ],
      },
    ],
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    summary: 'How the agent, backend and database fit together.',
    body: [
      {
        heading: 'Architecture',
        paragraphs: [
          'The agent runs on each endpoint and reports posture data to the analysis backend. The backend stores findings in PostgreSQL, scores them, and serves the results to the console.',
          'This public website is a separate surface. It serves product information, account management, release listings and download records. It is not the analysis console and holds no endpoint data.',
        ],
      },
      {
        heading: 'Rollout',
        paragraphs: [
          'Start with a representative pilot group rather than the whole fleet. A pilot surfaces environment-specific issues while the blast radius is small, and it gives you a baseline score to measure the wider rollout against.',
        ],
      },
    ],
  },
  {
    slug: 'security',
    title: 'Security model',
    summary: 'Authentication, authorisation and data handling.',
    body: [
      {
        heading: 'Authentication',
        paragraphs: [
          'Accounts authenticate with an email address and password. Passwords are hashed with Argon2id. Sessions use short-lived access tokens paired with rotating refresh tokens, so a captured refresh token stops working as soon as it is used once.',
        ],
      },
      {
        heading: 'Authorisation',
        paragraphs: [
          'Every permission decision is made by the server. The interface hides controls a role cannot use, but hiding a control is a convenience, not a boundary. The API re-checks the caller on every request and rejects anything it is not entitled to.',
        ],
      },
      {
        heading: 'Data handling',
        paragraphs: [
          'Download records store who obtained which release and when. The address and browser used are recorded server-side for abuse handling and are deliberately not returned by the API. Release file paths are never exposed to the public site.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    summary: 'Common problems and what to do about them.',
    body: [
      {
        heading: 'The verification link does not work',
        paragraphs: [
          'Verification links expire. Request a fresh link and use the newest email you received, because older links stop working once a newer one is issued.',
        ],
      },
      {
        heading: 'Downloads are being refused',
        paragraphs: [
          'Downloads require a verified email address, and there is a limit on how many times the same release can be recorded in an hour. If you reach the limit, wait rather than retrying immediately.',
        ],
      },
      {
        heading: 'Checksums do not match',
        paragraphs: [
          'Re-download the file over a connection you trust and compare again. If it still does not match, do not run the file. Send a contact request with the release version and the checksum you computed.',
        ],
      },
    ],
  },
];

/** Human-readable labels for backend enum values. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  RATING: 'Rating',
  BUG: 'Bug report',
  FEATURE_REQUEST: 'Feature request',
  TESTIMONIAL: 'Testimonial',
  GENERAL: 'General feedback',
};

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  SALES: 'Sales',
  SUPPORT: 'Support',
  BUG: 'Bug',
  FEATURE_REQUEST: 'Feature request',
  PARTNERSHIP: 'Partnership',
  GENERAL: 'General',
};

export const FEEDBACK_STATUS_LABELS = {
  NEW: 'New',
  UNDER_REVIEW: 'Under review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
} as const;

export const CONTACT_STATUS_LABELS = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  RESPONDED: 'Responded',
  CLOSED: 'Closed',
} as const;

export const RELEASE_STATUS_LABELS = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
} as const;
