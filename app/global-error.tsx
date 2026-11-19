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
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-5">
        <div className="w-full max-w-[400px] rounded-3xl bg-white border border-[#E2E8F0] p-7 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">Ucred Encountered an Error</h1>
          <p className="text-sm text-[#475569]">
            Your cloud-synced shop khata remains safe. Reload Ucred to resume.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1E40AF] active:scale-95 px-5 py-3.5 text-sm font-bold text-white transition"
          >
            <RotateCcw className="h-4 w-4" />
            Reload Ucred
          </button>
        </div>
      </body>
    </html>
  );
}
