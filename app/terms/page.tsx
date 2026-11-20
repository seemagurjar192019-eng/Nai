import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Ucred Smart Voice Khata, AI Parchi Scanner, Galla Cashbook, GST billing, stock tracking, and UPI collection tools.',
  alternates: { canonical: '/terms' },
};

export default function TermsOfServicePage() {
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
          <span className="text-xs font-semibold text-[var(--ink-muted)]">Updated: 2026</span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
            <FileText className="h-4 w-4" />
            Terms of Use
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            Ucred Terms of Service
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            By using the Ucred web application, PWA, or Android package, you agree to the following practical terms.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            1. Bookkeeping, AI Scans &amp; Tax Responsibility
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred is a digital bookkeeping, AI receipt assistance, and billing aid for shopkeepers. You remain responsible for verifying spoken voice amounts, AI-scanned parchi line items, trust indicators, customer balances, GST rates, and tax invoices before filing statutory returns.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            2. UPI Links &amp; Payments
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred does not process, hold, or clear funds. UPI QR codes and payment links route directly between your customer&apos;s UPI app and the UPI VPA configured in your Business Profile. Always verify your UPI ID before sharing reminders.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            3. Guest Mode, Multi-Staff Access &amp; Backups
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            In Instant Guest Mode, entries stay stored locally on your device—connect +91 Mobile OTP backup or download periodic JSON/CSV backups from Settings to avoid data loss if you clear device storage. When synced, keep your verified mobile SIM and OTP messages secure and set 4-digit PINs for App Lock and Staff Operators on shared counter phones.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            4. Account Termination
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            You may stop using Ucred and erase your entire account and associated data at any time via Settings or{' '}
            <Link href="/delete-account" className="font-bold text-[var(--ink)] underline">
              Delete Account
            </Link>
            .
          </p>
        </section>

        <footer className="bg-[var(--surface-subtle)] rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <span>
            Read our{' '}
            <Link href="/privacy" className="font-semibold text-[var(--ink)] underline">
              Privacy Policy
            </Link>
          </span>
          <Link href="/" className="font-bold text-[var(--ink)] hover:underline">
            Return to Ucred &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
