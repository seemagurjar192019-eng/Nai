import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Delete Account & Data',
  description:
    'How to permanently delete your BolBahi Voice Khata account and all associated businesses, customers, transactions, bills, and stock data.',
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
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
          <span className="text-xs font-semibold text-slate-400">Google Play Data Safety</span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <Trash2 className="h-4 w-4" />
            Permanent Account &amp; Data Deletion
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Delete Your BolBahi Account
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            You can permanently erase your BolBahi user profile, Google Sign-In link inside BolBahi, and every synced ledger record directly inside the app in under 30 seconds.
          </p>
        </header>

        <section className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Steps to Delete Immediately In-App:
          </h2>
          <ol className="list-decimal pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <li>Open <strong>BolBahi</strong> and sign in with your Google account.</li>
            <li>Tap the <strong>More</strong> tab at the bottom right, then open <strong>Settings</strong>.</li>
            <li>(Recommended) Tap <strong>Export JSON Backup</strong> first if you want a local copy.</li>
            <li>Scroll to <strong>Danger Zone &amp; Account Deletion</strong> and tap <strong>Delete Account &amp; All Cloud Data</strong>.</li>
            <li>Confirm deletion (if prompted by Google security for a fresh login, re-verify once) to permanently wipe all data.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#008037] dark:text-emerald-400" />
            What Data Is Permanently Deleted
          </h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
            <li>User profile, saved mobile number, language, theme, and App Lock PIN hash</li>
            <li>All business profiles, UPI IDs, and GST settings</li>
            <li>All customer and supplier ledger accounts and transactions, including attached bill photos</li>
            <li>All bills, quotes, and stock inventory items</li>
            <li>Your Firebase Authentication account record for BolBahi</li>
          </ul>
        </section>

        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Deletion is immediate and irreversible. If you signed in offline earlier, clear your browser/PWA site storage after deleting your cloud account to remove local offline cache as well.
          </p>
        </div>

        <footer className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/privacy" className="font-semibold text-[#008037] dark:text-emerald-400 underline">
            Privacy Policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#008037] px-4 py-2 font-bold text-white hover:bg-[#006B2E] transition"
          >
            Open BolBahi Settings &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
