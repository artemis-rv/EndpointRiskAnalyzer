/**
 * components/common/CopyButton.tsx
 * ────────────────────────────────
 * Copies a value to the clipboard and confirms it.
 *
 * Used for checksums and identifiers. The confirmation is announced through a
 * live region rather than a tooltip, because a tooltip would make the feedback
 * hover-dependent (WCAG 1.4.13).
 */

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

export interface CopyButtonProps {
  value: string;
  /** Describes what is being copied, e.g. "SHA-256 checksum". */
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied by permissions policy or an insecure
      // origin. Tell the person instead of failing silently.
      setFailed(true);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2400);
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        className="btn-secondary btn-sm"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ''}
        {failed ? `Could not copy ${label}. Select the text and copy it manually.` : ''}
      </span>
      {failed ? (
        <span className="text-xs text-danger-700">Copy blocked. Select the text manually.</span>
      ) : null}
    </span>
  );
}
