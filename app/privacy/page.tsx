import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mic, Database, Lock, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Ucred Smart Voice Khata PWA and Android app covering Google Sign-In, Cloud Firestore sync, hybrid voice & AI parchi processing, Galla cashbook, and account deletion.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="h-4 w-4" />
            Privacy &amp; Data Protection
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#161514] dark:text-[#F3EDE4]">
            Ucred Privacy Policy
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Ucred (&ldquo;Smart Voice Khata &amp; Galla OS&rdquo;) helps shopkeepers manage customer credits (Udhaar), payments (Jama), GST bills, inventory, cash-drawer Galla records, and counter staff logs. This policy explains what data we store and how you control it.
          </p>
        </header>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4] flex items-center gap-2">
            <Database className="h-4 w-4" />
            1. Information You Store in Ucred
          </h2>
          <ul className="list-disc pl-5 text-sm text-stone-600 dark:text-stone-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>Account Details:</strong> Your Google Sign-In email/UID and the shopkeeper mobile number you optionally enter during onboarding.
            </li>
            <li>
              <strong>Business, Khata &amp; Galla Records:</strong> Business profile, GSTIN, UPI ID, customer/supplier accounts, promise-to-pay dates, transactions, GST bills, stock inventory, Galla cashbook inflows/expenses, counter staff names/roles, activity audit logs, and compressed receipt photos you attach.
            </li>
            <li>
              <strong>Preferences &amp; Security:</strong> Language, theme preset, dark/light appearance, and salted SHA-256 hashes of any 4-digit App Lock or Staff PINs.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4] flex items-center gap-2">
            <Mic className="h-4 w-4" />
            2. Microphone, Hybrid Voice &amp; AI Parchi Processing
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Microphone access is activated only when you tap Voice / Counter Mode. Simple commands resolve offline directly on your device. When you request Smart AI parsing for complex spoken sentences or upload a receipt photo inside the AI Parchi Scanner, only that text transcript or compressed slip image is sent securely over HTTPS to our server API for structured field extraction—never raw audio recordings and never used for ad targeting.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4] flex items-center gap-2">
            <Lock className="h-4 w-4" />
            3. Cloud Sync, Offline Cache &amp; WhatsApp / UPI Links
          </h2>
          <ul className="list-disc pl-5 text-sm text-stone-600 dark:text-stone-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>Private Cloud Sync:</strong> All records live inside Google Cloud Firestore scoped exclusively to your authenticated Firebase UID.
            </li>
            <li>
              <strong>Offline First:</strong> IndexedDB persistence lets your shop keep billing and posting khata even when internet drops.
            </li>
            <li>
              <strong>No Data Selling &amp; No Ads:</strong> Ucred never sells, rents, or shares your customer phone numbers, credit balances, or sales with third-party advertisers or credit bureaus.
            </li>
            <li>
              <strong>Direct WhatsApp &amp; UPI:</strong> Payment reminders and receipts open your device&apos;s WhatsApp or UPI app directly with your chosen amount and VPA.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-[#161514] dark:text-[#F3EDE4] flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            4. Export, Retention &amp; Permanent Deletion
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Export a full JSON backup or CSV ledger report anytime from Settings, clear an individual shop, or permanently delete your entire Ucred account and cloud records via Settings or our{' '}
            <Link href="/delete-account" className="font-bold text-[#161514] dark:text-[#F3EDE4] underline">
              Account Deletion instructions
            </Link>
            .
          </p>
        </section>

        <footer className="border-t border-[#E5DEC9] dark:border-[#2A2824] pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
          <span>
            Also review our{' '}
            <Link href="/terms" className="font-semibold text-[#161514] dark:text-[#F3EDE4] underline">
              Terms of Service
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
