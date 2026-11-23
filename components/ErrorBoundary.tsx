'use client';

import React from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

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

  handleEmergencyExport = () => {
    try {
      const raw =
        window.localStorage.getItem('ucred_guest_vault_v1') ||
        window.localStorage.getItem('ucred_guest_vault_enc_v1');
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ucred_emergency_recovery_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Ignore storage access failures
    }
  };

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

      const hasLocalData =
        typeof window !== 'undefined' &&
        Boolean(
          window.localStorage.getItem('ucred_guest_vault_v1') ||
            window.localStorage.getItem('ucred_guest_vault_enc_v1')
        );

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--app-bg)]">
          <div className="w-full max-w-md rounded-[28px] spatial-hero p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--credit-tint)] text-[var(--credit-red)] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--ink-muted)] break-words leading-relaxed">
              {friendly}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm hover:bg-[var(--brand-hover)] active:scale-95 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Ucred
              </button>
              {hasLocalData && (
                <button
                  type="button"
                  onClick={this.handleEmergencyExport}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-2xl bg-[var(--surface-subtle)] text-[var(--ink)] font-bold text-xs active:scale-95 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save Emergency Local Backup
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
