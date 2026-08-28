/**
 * components/common/Badge.tsx
 * ───────────────────────────
 * Status pills.
 *
 * Colour is never the only signal: every badge carries its own text label, so
 * the state is readable without perceiving hue (WCAG 1.4.1).
 */

import type { ReactNode } from 'react';
import {
  CONTACT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
} from '@/constants/content';
import type { ContactStatus, FeedbackStatus, ReleaseStatus } from '@/types/api';
import { humaniseToken } from '@/utils/format';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'badge-neutral',
  brand: 'badge-brand',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`${TONE_CLASS[tone]} ${className}`}>{children}</span>;
}

const RELEASE_TONE: Record<ReleaseStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
};

const FEEDBACK_TONE: Record<FeedbackStatus, BadgeTone> = {
  NEW: 'brand',
  UNDER_REVIEW: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  RESOLVED: 'neutral',
};

const CONTACT_TONE: Record<ContactStatus, BadgeTone> = {
  NEW: 'brand',
  IN_PROGRESS: 'warning',
  RESPONDED: 'success',
  CLOSED: 'neutral',
};

export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  return (
    <Badge tone={RELEASE_TONE[status] ?? 'neutral'}>
      {RELEASE_STATUS_LABELS[status] ?? humaniseToken(status)}
    </Badge>
  );
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <Badge tone={FEEDBACK_TONE[status] ?? 'neutral'}>
      {FEEDBACK_STATUS_LABELS[status] ?? humaniseToken(status)}
    </Badge>
  );
}

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return (
    <Badge tone={CONTACT_TONE[status] ?? 'neutral'}>
      {CONTACT_STATUS_LABELS[status] ?? humaniseToken(status)}
    </Badge>
  );
}
