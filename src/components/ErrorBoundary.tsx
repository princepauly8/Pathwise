import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `Sync issue (${parsed.operationType ?? 'operation'}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error): void {
    console.error('Application boundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--pw-bg)] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h1 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
              Something interrupted your study session
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
            >
              Reload Pathwise
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
