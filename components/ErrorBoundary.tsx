'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Sync error (${parsed.operationType || 'read'}): ${parsed.error}`;
        }
      } catch {
        // Keep message as-is
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--app-bg)]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-semibold hover:bg-[var(--brand-hover)] transition"
            >
              <RotateCcw className="w-4 h-4" />
              Reload BolBahi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
