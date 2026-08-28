/**
 * components/common/ErrorBoundary.tsx
 * ───────────────────────────────────
 * Catches render-time crashes so one broken subtree does not blank the page.
 *
 * What it shows: a plain apology and a way forward. What it never shows: the
 * error message, the component stack, or anything else that describes the
 * internals of the application (OWASP A05). In development the detail is
 * printed to the console for the developer; in a production build that branch
 * is compiled out by the `config.isDevBuild` check.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { config } from '@/constants/config';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Overrides the default panel, e.g. for a smaller inline region. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (config.isDevBuild) {
      // Developer-facing only. Never reached in a production bundle.
      console.error('Render error caught by boundary:', error, info.componentStack);
    }
    // In production this is where a reporting call would go. Any such call must
    // send the error identity only — never request bodies, tokens, or form
    // contents (OWASP A09).
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="max-w-md text-center" role="alert">
          <p className="font-mono text-sm font-semibold text-danger-600">Application error</p>
          <h1 className="heading-2 mt-2">Something went wrong on this page</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            The page could not finish loading. Reloading usually clears it. Nothing you had already
            saved has been lost.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={this.handleReload} className="btn-primary">
              Reload the page
            </button>
            <a href="/" className="btn-secondary">
              Go to the homepage
            </a>
          </div>
        </div>
      </div>
    );
  }
}
