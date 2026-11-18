'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F6F8F7] text-slate-900 flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-7 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-extrabold">BolBahi Encountered an Error</h1>
          <p className="text-sm text-slate-500">
            Your cloud-synced data remains protected. Reload to resume.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#008037] px-5 py-3.5 text-sm font-bold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Reload BolBahi
          </button>
        </div>
      </body>
    </html>
  );
}
