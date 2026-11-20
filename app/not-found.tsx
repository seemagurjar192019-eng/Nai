import Link from 'next/link';
import { BookOpen, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen spatial-shell-bg flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-[28px] spatial-hero p-7 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)]">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] font-tabular">
            404
          </p>
          <h1 className="font-display text-xl font-extrabold text-[var(--ink)]">
            Page Not Found
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Yeh page available nahi hai. Apne Ucred Khata par wapas jaayein.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] px-5 py-3.5 text-sm font-bold text-[var(--brand-fg)] tactile-key-primary transition"
        >
          <Home className="h-4 w-4" />
          Back to Ucred Cockpit
        </Link>
      </div>
    </main>
  );
}
