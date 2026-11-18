import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mic, Database, Lock, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for BolBahi Voice Khata PWA and Android app covering Google Sign-In, Cloud Firestore sync, microphone speech processing, and account deletion.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="h-4 w-4" />
            Privacy &amp; Data Protection
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            BolBahi Privacy Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            BolBahi (&ldquo;Voice Khata&rdquo;) helps shopkeepers record customer credits (Udhaar), payments (Jama), bills, and inventory. This policy explains what data we collect, how it is stored, and how you stay in full control.
          </p>
        </header>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-[#008037] dark:text-emerald-400" />
            1. Information You Store in BolBahi
          </h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>Account Details:</strong> Your Google Sign-In email/UID and the shopkeeper mobile number you optionally provide during setup.
            </li>
            <li>
              <strong>Business &amp; Khata Records:</strong> Business name, GSTIN, UPI ID, customer/supplier names and phone numbers, ledger transactions, bills/quotes, stock items, and compressed bill receipt photos you attach.
            </li>
            <li>
              <strong>App Preferences:</strong> Selected language, theme color, light/dark appearance, and salted SHA-256 hash of your 4-digit App Lock PIN (never stored as raw PIN digits for newly saved PINs).
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic className="h-4 w-4 text-[#008037] dark:text-emerald-400" />
            2. Microphone &amp; Voice Processing
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Microphone access is requested only when you tap the Voice Entry microphone button. Speech recognition runs through your browser&apos;s built-in Speech Recognition engine and BolBahi&apos;s deterministic on-device Hinglish/Hindi parser. BolBahi does not record or upload raw audio files to its database; only the resulting parsed ledger entry (and optional recognized text note) is saved when you confirm Save.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#008037] dark:text-emerald-400" />
            3. Storage, Offline Cache &amp; Third-Party Links
          </h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>Cloud Sync:</strong> Your ledger records are stored securely in Google Cloud Firestore scoped strictly to your authenticated Firebase UID.
            </li>
            <li>
              <strong>Offline Cache:</strong> IndexedDB persistence keeps your ledger working offline on your device and syncs automatically when internet returns.
            </li>
            <li>
              <strong>No Data Selling &amp; No Ads:</strong> BolBahi does not sell, rent, or share your customer khata or phone numbers with advertisers, lenders, or data brokers.
            </li>
            <li>
              <strong>WhatsApp &amp; UPI:</strong> When you tap Send Reminder or Pay via UPI, your device opens WhatsApp or your chosen UPI app directly with the message/amount you initiated.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-[#008037] dark:text-emerald-400" />
            4. Export, Retention &amp; Permanent Deletion
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            You can export a complete JSON backup or CSV report anytime from Settings, clear a specific business&apos;s entries, or permanently delete your entire BolBahi account and all cloud records directly inside Settings &rarr; Danger Zone, or via our{' '}
            <Link href="/delete-account" className="font-bold text-[#008037] dark:text-emerald-400 underline">
              Account Deletion instructions
            </Link>
            .
          </p>
        </section>

        <footer className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Also review our <Link href="/terms" className="font-semibold text-[#008037] dark:text-emerald-400 underline">Terms of Service</Link></span>
          <Link href="/" className="font-bold text-[#008037] dark:text-emerald-400 hover:underline">
            Return to App &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}
