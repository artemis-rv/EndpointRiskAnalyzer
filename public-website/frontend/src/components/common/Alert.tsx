/**
 * components/common/Alert.tsx
 * ───────────────────────────
 * Inline messaging.
 *
 * Errors and warnings use role="alert" so they interrupt and are announced.
 * Success and info use role="status", which announces politely without
 * stealing focus from whatever the person is doing.
 */

import type { ReactNode } from 'react';
import { AlertIcon, CheckCircleIcon, InfoIcon } from './Icons';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<AlertTone, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  danger: 'alert-danger',
};

const TONE_ICON: Record<AlertTone, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: AlertIcon,
  danger: AlertIcon,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function Alert({ tone = 'info', title, children, className = '', actions }: AlertProps) {
  const IconComponent = TONE_ICON[tone];
  const assertive = tone === 'danger' || tone === 'warning';

  return (
    <div
      className={`${TONE_CLASS[tone]} ${className}`}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
    >
      <IconComponent className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
