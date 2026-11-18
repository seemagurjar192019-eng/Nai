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
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Google Play Data Safety
          </span>
        </div>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <Trash2 className="h-4 w-4" />
            Permanent Account &amp; Data Deletion
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#161514] dark:text-[#F3EDE4]">
            Delete Your Ucred Account
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            You can permanently erase your Ucred user profile, Google Sign-In link inside Ucred, and every synced ledger, Galla, staff, and billing record directly inside the app in under 30 seconds.
          </p>
        </header>

        <section className="rounded-2xl bg-[#F6F2EC] dark:bg-[#22201C] border border-[#E5DEC9] dark:border-[#2A2824] p-5 space-y-3">
          <h2 className="text-sm font-bold text-[#161514] dark:text-[#F3EDE4]">
            Steps to Delete Immediately In-App:
          </h2>
          <ol className="list-decimal pl-5 text-sm text-stone-700 dark:text-stone-300 space-y-2 leading-relaxed">
            <li>Open <strong>Ucred</strong> and sign in with your Google account.</li>
            <li>Tap <strong>More</strong> at the bottom right (or <strong>Settings</strong> in the desktop sidebar).</li>
            <li>(Recommended) Tap <strong>Download JSON Backup</strong> first if you want a local copy.</li>
            <li>Scroll down and tap <strong>Delete Account &amp; All Cloud Data</strong>.</li>
            <li>Confirm deletion (if prompted by Google for recent sign-in, re-verify once) to permanently wipe all records.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#0F8A4B]" />
            What Data Is Permanently Deleted
          </h2>
          <ul className="list-disc pl-5 text-sm text-stone-600 dark:text-stone-300 space-y-1.5">
            <li>User profile, saved mobile number, language, theme, and App Lock PIN hash</li>
            <li>All business profiles, UPI IDs, and GST settings</li>
            <li>All customer and supplier ledger accounts and transactions, including attached parchi photos</li>
            <li>All Galla cashbook entries, staff/Munim profiles, and activity audit logs</li>
            <li>All bills, quotes, and stock inventory items</li>
            <li>Your Firebase Authentication account record for Ucred</li>
          </ul>
        </section>

        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Deletion is immediate and irreversible. If you signed in offline earlier, clear your browser/PWA site storage after deleting your cloud account to remove local offline cache as well.
          </p>
        </div>

        <footer className="border-t border-[#E5DEC9] dark:border-[#2A2824] pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
          <Link href="/privacy" className="font-semibold text-[#161514] dark:text-[#F3EDE4] underline">
            Privacy Policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#161514] dark:bg-[#F3EDE4] px-4 py-2 font-bold text-white dark:text-[#161514] hover:opacity-90 transition"
          >
            Open Ucred Settings &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
