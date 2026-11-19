'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <main className="min-h-screen spatial-shell-bg flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-[28px] spatial-hero ring-1 ring-white/80 dark:ring-white/10 p-7 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--credit-tint)] text-[var(--credit-red)] shadow-inner">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-lg font-extrabold text-[var(--ink)]">
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Your saved khata records are safe. Try reloading this screen.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 px-4 py-3 text-sm font-bold text-[var(--brand-fg)] shadow-md transition"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-4 py-3 text-sm font-bold text-[var(--ink)] active:scale-95 transition"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
