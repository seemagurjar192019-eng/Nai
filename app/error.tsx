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
    <main className="min-h-screen bg-[#F6F8F7] dark:bg-[#0D1210] flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 text-center shadow-lg space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Your saved khata records are safe. Try reloading this screen.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#008037] hover:bg-[#006B2E] px-4 py-3 text-sm font-bold text-white transition"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
