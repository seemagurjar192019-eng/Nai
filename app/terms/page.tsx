import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Ucred Voice Ledger, Receipt Scanner, Cashbook, GST billing aid, stock tracking, and UPI collection tools.',
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
            By using the Ucred web application, PWA, or Android package provided by Naitik Web Studio, you agree to the following practical terms governed by the laws of India.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            1. Bookkeeping, Receipt Scans &amp; GST Rule 46 Compliance
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred is a digital bookkeeping, receipt scanning, and invoice preparation aid. It is not a substitute for certified accounting or statutory GST e-invoicing portals. You remain solely responsible for verifying spoken voice amounts, scanned receipt line items, customer balances, HSN/SAC details, GST rates, and Rule 46 invoice requirements before issuing tax invoices or filing GST/income tax returns.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            2. Internal Trust Indicator Disclaimer (RBI / CICRA Notice)
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred&apos;s Customer Trust Score is an automated private mathematical indicator computed locally from payment history inside your own ledger only. It is NOT a credit score or credit report regulated under the Credit Information Companies (Regulation) Act, 2005 (CICRA) or the Reserve Bank of India (RBI), is never shared across businesses, and must not be represented as an official bureau rating.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            3. UPI Deep Links &amp; Non-Custodial Payments
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred is not a payment aggregator or bank and never collects, holds, or transfers funds. UPI QR codes and payment links route directly between your customer&apos;s UPI app and the UPI VPA configured in your Business Profile. Always verify your UPI ID before sharing reminders.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            4. Guest Mode, Sign-In Security &amp; Backups
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            In Instant Guest Mode, entries stay stored locally on your device—connect Google Sign-In, Email Verification Link, or +91 Mobile OTP backup or download periodic JSON/CSV backups from Settings to prevent data loss when clearing browser storage. When sharing counter phones with staff, enable a 4-digit App Lock PIN in Settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            5. Account Termination &amp; Contact
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            You may stop using Ucred and erase your entire account and associated data at any time via Settings or{' '}
            <Link href="/delete-account" className="font-bold text-[var(--ink)] underline">
              Delete Account
            </Link>
            . Support &amp; Grievance Contact: <strong className="text-[var(--ink)]">naitik.webstudio45@gmail.com</strong>.
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
