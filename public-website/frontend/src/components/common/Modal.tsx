/**
 * components/common/Modal.tsx
 * ───────────────────────────
 * Accessible dialog with a focus trap.
 *
 * Behaviours that make it usable without a mouse:
 *   - focus moves into the dialog on open and returns to the trigger on close
 *   - Tab and Shift+Tab cycle inside the dialog only
 *   - Escape closes
 *   - the backdrop is inert to keyboard users and merely a click target
 *   - background scrolling is locked while open
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { XIcon } from './Icons';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevents closing while a request is in flight. */
  busy?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? dialog)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-4 sm:items-center">
      {/* Presentational backdrop: keyboard users close with Escape. */}
      <div
        className="fixed inset-0 bg-ink-950/50 backdrop-blur-[1px]"
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full ${SIZE_CLASS[size]} animate-fade-in rounded-card bg-white shadow-popover`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="heading-3">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        {children ? <div className="px-5 py-4">{children}</div> : null}

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** Say plainly what will happen and whether it can be undone. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}

/**
 * Two-step confirmation for anything irreversible. Every destructive admin
 * action routes through this rather than firing on a single click.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
            loadingLabel="Working"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">{message}</p>
    </Modal>
  );
}
