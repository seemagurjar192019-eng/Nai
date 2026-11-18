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
    <main className="min-h-screen bg-[#F6F2EC] dark:bg-[#0E0E0D] text-stone-800 dark:text-stone-100 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white dark:bg-[#181715] border border-[#E5DEC9] dark:border-[#2A2824] shadow-sm p-6 sm:p-9 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5DEC9] dark:border-[#2A2824] pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#161514] dark:text-[#F3EDE4] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ucred
          </Link>
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Updated: 2026</span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
            <FileText className="h-4 w-4" />
            Terms of Use
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#161514] dark:text-[#F3EDE4]">
            Ucred Terms of Service
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            By using the Ucred web application, PWA, or Android package, you agree to the following practical terms.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4]">
            1. Bookkeeping, AI Scans &amp; Tax Responsibility
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Ucred is a digital bookkeeping, AI receipt assistance, and billing aid for shopkeepers. You remain responsible for verifying spoken voice amounts, AI-scanned parchi line items, trust indicators, customer balances, GST rates, and tax invoices before filing statutory returns.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4]">
            2. UPI Links &amp; Payments
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Ucred does not process, hold, or clear funds. UPI QR codes and payment links route directly between your customer&apos;s UPI app and the UPI VPA configured in your Business Profile. Always verify your UPI ID before sharing reminders.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4]">
            3. Multi-Staff Counter Access &amp; Backups
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Keep your Google account secure, set 4-digit PINs for App Lock and Staff Operators on shared counter phones, and download periodic JSON/CSV backups from Settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4]">
            4. Account Termination
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            You may stop using Ucred and erase your entire account and associated data at any time via Settings or{' '}
            <Link href="/delete-account" className="font-bold text-[#161514] dark:text-[#F3EDE4] underline">
              Delete Account
            </Link>
            .
          </p>
        </section>

        <footer className="border-t border-[#E5DEC9] dark:border-[#2A2824] pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
          <span>
            Read our{' '}
            <Link href="/privacy" className="font-semibold text-[#161514] dark:text-[#F3EDE4] underline">
              Privacy Policy
            </Link>
          </span>
          <Link href="/" className="font-bold text-[#161514] dark:text-[#F3EDE4] hover:underline">
            Return to Ucred &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
