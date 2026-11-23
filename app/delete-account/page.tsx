import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Delete Account & Data',
  description:
    'How to permanently delete your Ucred account (Google, Email Link, or Mobile OTP) and all associated businesses, contacts, transactions, cashbook, staff logs, bills, and stock data.',
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen spatial-shell-bg text-[var(--ink)] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-[28px] spatial-hero p-6 sm:p-9 space-y-6">
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
            Delete Your Ucred Account or Local Data
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Whether you use Ucred in Instant Guest Mode (stored locally on your device) or with optional Cloud Sync (Google Sign-In, Email Verification Link, or +91 Mobile OTP), you can permanently erase all ledger, cashbook, staff, and billing records in under 30 seconds.
          </p>
        </header>

        <section className="rounded-[22px] bg-[var(--surface-subtle)] p-5 space-y-3">
          <h2 className="font-display text-sm font-bold text-[var(--ink)]">
            Option A: Delete Guest Mode (On-Device) Data
          </h2>
          <ol className="list-decimal pl-5 text-sm text-[var(--ink-muted)] space-y-2 leading-relaxed">
            <li>Open <strong className="text-[var(--ink)]">Ucred</strong> and tap <strong className="text-[var(--ink)]">Settings</strong> in the bottom navigation dock (or the profile avatar at top-right).</li>
            <li>(Optional) Tap <strong className="text-[var(--ink)]">JSON Backup</strong> or <strong className="text-[var(--ink)]">Export CSV</strong> first to keep a copy.</li>
            <li>Scroll to <strong className="text-[var(--ink)]">Data &amp; Danger Zone</strong>, tap <strong className="text-[var(--ink)]">Clear All Business Data</strong>, and confirm to wipe local workspaces, contacts, cashbook, bills, and stock from this device.</li>
          </ol>
        </section>

        <section className="rounded-[22px] bg-[var(--surface-subtle)] p-5 space-y-3">
          <h2 className="font-display text-sm font-bold text-[var(--ink)]">
            Option B: Permanently Delete Signed-In Cloud Account
          </h2>
          <ol className="list-decimal pl-5 text-sm text-[var(--ink-muted)] space-y-2 leading-relaxed">
            <li>Open <strong className="text-[var(--ink)]">Ucred</strong> while signed in with Google, your verified Email, or +91 Mobile OTP.</li>
            <li>Tap <strong className="text-[var(--ink)]">Settings</strong> in the bottom dock (or the profile avatar at top-right).</li>
            <li>(Recommended) Tap <strong className="text-[var(--ink)]">Download JSON Backup</strong> first if you want a personal archive.</li>
            <li>Scroll to <strong className="text-[var(--ink)]">Data &amp; Backups</strong> and tap <strong className="text-[var(--ink)]">Delete Cloud Account Permanently</strong>.</li>
            <li>Confirm deletion (re-authenticating via Google popup, email, or 6-digit OTP if prompted) to permanently wipe all Cloud Firestore records and your Firebase Authentication account.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--debit-green)]" />
            What Data Is Permanently Deleted
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5">
            <li>User profile, verified Gmail/email/mobile identity, theme preference, and App Lock PIN hash</li>
            <li>All business profiles, UPI IDs, and GST settings</li>
            <li>All customer and supplier ledger accounts and transactions, including attached receipt photos</li>
            <li>All cashbook entries, staff profiles, and activity audit logs</li>
            <li>All bills, quotes, and stock inventory items</li>
            <li>Your Firebase Authentication account record for Ucred (when signed in)</li>
          </ul>
        </section>

        <div className="rounded-[22px] bg-[var(--brand-tint)] p-4 flex items-start gap-3 text-xs text-[var(--ink)] leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-[var(--brand-accent)]" />
          <p>
            Deletion is immediate and irreversible. Need manual assistance? Contact <strong className="font-extrabold">naitik.webstudio45@gmail.com</strong> from your registered email or mobile details.
          </p>
        </div>

        <footer className="bg-[var(--surface-subtle)] rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <Link href="/privacy" className="font-semibold text-[var(--ink)] underline">
            Privacy Policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2 font-bold text-[var(--brand-fg)] tactile-key-primary hover:bg-[var(--brand-hover)] transition"
          >
            Open Ucred Settings &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
