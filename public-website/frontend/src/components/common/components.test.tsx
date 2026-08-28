/**
 * components/common/components.test.tsx
 * ─────────────────────────────────────
 * Component-level tests for the design system pieces: buttons, states, the
 * dialog, pagination, the accordion and the form fields.
 *
 * These lean on accessible queries (role, label) rather than test ids, so a
 * passing test also demonstrates the component is reachable the way assistive
 * technology reaches it.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Alert } from './Alert';
import { AsyncBoundary, EmptyState, ErrorState, LoadingState } from './States';
import { ConfirmDialog } from './Modal';
import { Pagination } from './Pagination';
import { Accordion } from './Accordion';
import { ApiError } from '@/api/client/errors';
import { RatingField, SelectField, TextField } from '@/components/forms/Fields';
import { isStalled } from '@/utils/queryState';

// ── Button ──────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('calls its handler when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and marked busy while loading, preventing a double submit', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

// ── Alert ───────────────────────────────────────────────────────────────────

describe('Alert', () => {
  it('uses role=alert for errors so they interrupt', () => {
    render(<Alert tone="danger" title="Failed">Something broke.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('uses role=status for success so it does not steal focus', () => {
    render(<Alert tone="success">Saved.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });
});

// ── States ──────────────────────────────────────────────────────────────────

describe('async states', () => {
  it('announces the loading state politely', () => {
    render(<LoadingState label="Loading releases" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading releases/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders an empty state with its call to action', () => {
    render(
      <EmptyState
        title="No releases"
        description="Nothing published yet."
        action={<Button>Contact us</Button>}
      />,
    );
    expect(screen.getByText('No releases')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeInTheDocument();
  });

  it('shows a safe message for an error and offers a retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new ApiError({ message: 'The service is busy.', status: 503, kind: 'unavailable' });

    render(<ErrorState error={error} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('The service is busy.');
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('never renders a raw thrown value', () => {
    render(<ErrorState error={new Error('psycopg2.errors.UniqueViolation: boom')} />);
    expect(screen.queryByText(/psycopg2/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('AsyncBoundary shows exactly one state, with error winning over empty', () => {
    const { rerender } = render(
      <AsyncBoundary isLoading isError={false} hasLoaded={false}>
        <p>Content</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();

    rerender(
      <AsyncBoundary isLoading={false} isError hasLoaded isEmpty>
        <p>Content</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <AsyncBoundary isLoading={false} isError={false} hasLoaded isEmpty={false}>
        <p>Content</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  /**
   * Regression: a parked request must not present as an endless spinner.
   * The query layer parks a fetch when it believes there is no connection; that
   * state is neither loading nor error, so it has to be named explicitly.
   */
  it('AsyncBoundary reports a parked request instead of spinning forever', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <AsyncBoundary
        isLoading={false}
        isError={false}
        hasLoaded={false}
        isPaused
        onRetry={onRetry}
      >
        <p>Content</p>
      </AsyncBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/no connection to the server/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('isStalled fires only for a parked request with nothing to show', () => {
    expect(isStalled('paused', false)).toBe(true);
    expect(isStalled('paused', true)).toBe(false);
    expect(isStalled('fetching', false)).toBe(false);
    expect(isStalled('idle', false)).toBe(false);
  });

  /**
   * Regression: a request that has neither resolved nor failed must never be
   * reported as "there is nothing here". Claiming emptiness we cannot know is
   * the most misleading of the four states, because it looks like a normal,
   * successful answer.
   */
  it('AsyncBoundary never claims emptiness before the server has answered', () => {
    render(
      <AsyncBoundary
        isLoading={false}
        isError={false}
        hasLoaded={false}
        isEmpty
        emptyFallback={<p>Nothing exists</p>}
      >
        <p>Content</p>
      </AsyncBoundary>,
    );

    expect(screen.queryByText('Nothing exists')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ── ConfirmDialog ───────────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  it('requires a deliberate confirmation for a destructive action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        destructive
        title="Delete this release?"
        message="This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('This cannot be undone.')).toBeInTheDocument();

    // Nothing has happened just by opening it.
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Confirm"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not close while busy', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        busy
        title="Confirm"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Confirm"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── Pagination ──────────────────────────────────────────────────────────────

describe('Pagination', () => {
  it('reports the current window and disables the ends', () => {
    render(
      <Pagination
        page={1}
        pageSize={10}
        total={25}
        hasNext
        hasPrev={false}
        onPageChange={vi.fn()}
        itemLabel="releases"
      />,
    );

    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('requests the next page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <Pagination
        page={2}
        pageSize={10}
        total={25}
        hasNext
        hasPrev
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders nothing when there is nothing to page through', () => {
    const { container } = render(
      <Pagination
        page={1}
        pageSize={10}
        total={0}
        hasNext={false}
        hasPrev={false}
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ── Accordion ───────────────────────────────────────────────────────────────

describe('Accordion', () => {
  const items = [
    { id: 'a', question: 'First question', answer: 'First answer' },
    { id: 'b', question: 'Second question', answer: 'Second answer' },
  ];

  it('opens and closes with a keyboard and reports its state', async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);

    const first = screen.getByRole('button', { name: 'First question' });
    expect(first).toHaveAttribute('aria-expanded', 'false');

    first.focus();
    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('First answer')).toBeVisible();

    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps one panel open at a time by default', async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);

    await user.click(screen.getByRole('button', { name: 'First question' }));
    await user.click(screen.getByRole('button', { name: 'Second question' }));

    expect(screen.getByRole('button', { name: 'First question' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Second question' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

// ── Form fields ─────────────────────────────────────────────────────────────

describe('form fields', () => {
  it('binds the label, hint and error to the input', () => {
    render(
      <TextField
        label="Email address"
        required
        hint="We will send a verification link."
        error="Enter a valid email address."
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/email address/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');

    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const described = describedBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');

    expect(described).toContain('We will send a verification link.');
    expect(described).toContain('Enter a valid email address.');
  });

  it('marks optional fields so the requirement is never guessed', () => {
    render(<TextField label="Company name" value="" onChange={vi.fn()} />);
    expect(screen.getByText(/\(optional\)/i)).toBeInTheDocument();
  });

  it('renders the select options and reports a change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SelectField
        label="Category"
        placeholder="Choose one"
        options={[
          { value: 'SALES', label: 'Sales' },
          { value: 'SUPPORT', label: 'Support' },
        ]}
        value=""
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/category/i), 'SUPPORT');
    expect(onChange).toHaveBeenCalled();
  });

  it('exposes the rating as a keyboard-reachable radio group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RatingField label="Your rating" value={null} onChange={onChange} required />);

    const three = screen.getByLabelText(/^3/);
    await user.click(three);
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
