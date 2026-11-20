'use client';

import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold whitespace-nowrap shrink-0 tactile-key-primary hover:bg-[var(--brand-hover)] active:scale-95 transition'
            : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-bold whitespace-nowrap shrink-0 tactile-key-primary hover:bg-[var(--brand-hover)] active:scale-95 transition'
        }
      >
        <Download className="w-4 h-4" />
        <span>Install Ucred</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl spatial-card text-xs font-semibold text-[var(--ink)] whitespace-nowrap shrink-0 active:scale-95 transition"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-[380px] rounded-[28px] spatial-sheet p-6 space-y-4 sheet-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Install Ucred on iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="text-sm text-[var(--ink-muted)] space-y-2 list-decimal list-inside">
                <li>
                  Tap the <strong className="text-[var(--ink)]">Share</strong> button in Safari toolbar.
                </li>
                <li>
                  Scroll down and tap <strong className="text-[var(--ink)]">Add to Home Screen</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold tactile-key-primary active:scale-95 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-2.5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[var(--alert-amber)] px-4 py-2 text-xs font-bold text-slate-950 shadow-lg whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Changes sync automatically when back online</span>
    </div>
  );
};
