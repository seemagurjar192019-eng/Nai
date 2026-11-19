import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Delete Account & Data',
  description:
    'How to permanently delete your Ucred account and all associated businesses, customers, transactions, Galla cashbook, staff logs, bills, and stock data.',
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen spatial-shell-bg text-[var(--ink)] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-[28px] spatial-hero ring-1 ring-white/80 dark:ring-white/10 p-6 sm:p-9 space-y-6">
        <div className="flex items-center justify-between gap-4 bg-[var(--surface-subtle)] rounded-2xl px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ucred
          </Link>
          <span className="text-xs font-semibold text-[var(--ink-muted)]">
            Google Play Data Safety
          </span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--credit-red)]">
            <Trash2 className="h-4 w-4" />
            Permanent Account &amp; Data Deletion
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            Delete Your Ucred Account
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            You can permanently erase your Ucred profile, verified mobile account link, and every synced ledger, Galla, staff, and billing record directly inside the app in under 30 seconds.
          </p>
        </header>

        <section className="rounded-[22px] bg-[var(--surface-subtle)] p-5 space-y-3">
          <h2 className="font-display text-sm font-bold text-[var(--ink)]">
            Steps to Delete Immediately In-App:
          </h2>
          <ol className="list-decimal pl-5 text-sm text-[var(--ink-muted)] space-y-2 leading-relaxed">
            <li>Open <strong className="text-[var(--ink)]">Ucred</strong> and sign in with your Mobile Number &amp; SMS OTP.</li>
            <li>Tap <strong className="text-[var(--ink)]">More</strong> at the bottom right and open <strong className="text-[var(--ink)]">PIN &amp; All (Settings)</strong>.</li>
            <li>(Recommended) Tap <strong className="text-[var(--ink)]">Download JSON Backup</strong> first if you want a local copy.</li>
            <li>Scroll down and tap <strong className="text-[var(--ink)]">Delete Account &amp; All Cloud Data</strong>.</li>
            <li>Confirm deletion (if prompted for a fresh OTP verification, enter the 6-digit code) to permanently wipe all records.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--debit-green)]" />
            What Data Is Permanently Deleted
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5">
            <li>User profile, verified mobile number, language, Light/Dark preference, and App Lock PIN hash</li>
            <li>All business profiles, UPI IDs, and GST settings</li>
            <li>All customer and supplier ledger accounts and transactions, including attached parchi photos</li>
            <li>All Galla cashbook entries, staff/Munim profiles, and activity audit logs</li>
            <li>All bills, quotes, and stock inventory items</li>
            <li>Your Firebase Authentication phone record for Ucred</li>
          </ul>
        </section>

        <div className="rounded-[22px] bg-[var(--brand-tint)] p-4 flex items-start gap-3 text-xs text-[var(--ink)] leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-[var(--brand-accent)]" />
          <p>
            Deletion is immediate and irreversible. If you signed in offline earlier, clear your browser/PWA site storage after deleting your cloud account to remove local offline cache as well.
          </p>
        </div>

        <footer className="bg-[var(--surface-subtle)] rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <Link href="/privacy" className="font-semibold text-[var(--ink)] underline">
            Privacy Policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2 font-bold text-[var(--brand-fg)] hover:bg-[var(--brand-hover)] transition"
          >
            Open Ucred Settings &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
