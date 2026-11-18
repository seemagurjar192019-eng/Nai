import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for BolBahi Voice Khata ledger, GST billing preview, stock tracking, and UPI reminder tools.',
  alternates: { canonical: '/terms' },
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#F6F8F7] dark:bg-[#0D1210] text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-9 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#008037] dark:text-emerald-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to BolBahi
          </Link>
          <span className="text-xs font-semibold text-slate-400">Updated: 2025</span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#008037] dark:text-emerald-400">
            <FileText className="h-4 w-4" />
            Terms of Use
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            BolBahi Terms of Service
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            By using the BolBahi web application, PWA, or Android package, you agree to the following practical terms.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">1. Bookkeeping &amp; Tax Responsibility</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            BolBahi is a digital bookkeeping and billing aid for shopkeepers. You remain responsible for verifying spoken voice amounts, customer balances, GST rates, and tax invoices before filing statutory GST returns or issuing official tax documents.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">2. UPI Links &amp; Payments</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            BolBahi does not process, hold, or clear money. UPI QR codes and payment links route directly between your customer&apos;s UPI app and the UPI VPA you enter in your Business Profile. Always verify your UPI ID before sharing payment links.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">3. Backups &amp; Security</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Maintain regular JSON/CSV backups from Settings for critical business records. Keep your Google account secure and enable the 4-digit App Lock PIN on shared shop devices.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">4. Account Termination</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            You may stop using BolBahi and erase your entire account and associated data at any time via Settings or{' '}
            <Link href="/delete-account" className="font-bold text-[#008037] dark:text-emerald-400 underline">
              Delete Account
            </Link>
            .
          </p>
        </section>

        <footer className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Read our <Link href="/privacy" className="font-semibold text-[#008037] dark:text-emerald-400 underline">Privacy Policy</Link></span>
          <Link href="/" className="font-bold text-[#008037] dark:text-emerald-400 hover:underline">
            Return to App &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
