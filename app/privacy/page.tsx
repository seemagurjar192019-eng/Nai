import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mic, Database, Lock, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Ucred Smart Voice Khata PWA and Android app covering Mobile OTP authentication, Cloud Firestore sync, hybrid voice & AI parchi processing, Galla cashbook, and account deletion.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="h-4 w-4" />
            Privacy &amp; Data Protection
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            Ucred Privacy Policy
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred (&ldquo;Smart Voice Khata &amp; Galla OS&rdquo;) helps shopkeepers manage customer credits (Udhaar), payments (Jama), GST bills, inventory, cash-drawer Galla records, and counter staff logs. You can start immediately in Instant Guest Mode or optionally connect your mobile number via OTP for encrypted cloud sync.
          </p>
        </header>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--brand-accent)]" />
            1. Guest Storage &amp; Optional Account Data
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-[var(--ink)]">Instant Guest Mode (On-Device):</strong> When used without signing in, your shops, customer/supplier khata entries, Galla cashbook, stock, and bills are stored locally on your device via browser/IndexedDB storage. No mobile number is required to start.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Optional Mobile OTP Identity:</strong> If you choose &ldquo;Backup / Sync via Mobile OTP&rdquo;, your verified 10-digit Indian mobile number (`+91`) and Firebase Authentication UID are used exclusively to scope, merge, and protect your cloud ledger across devices.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Business, Khata &amp; Galla Records:</strong> Business profile, GSTIN, UPI ID, customer/supplier accounts, promise-to-pay dates, transactions, GST bills, stock inventory, Galla cashbook inflows/expenses, counter staff names/roles, activity audit logs, and compressed receipt photos you attach.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Preferences &amp; Security:</strong> Theme, language, and salted SHA-256 hashes of any 4-digit App Lock or Staff PINs.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Mic className="h-4 w-4 text-[var(--brand-accent)]" />
            2. Microphone &amp; Camera Access (Just-In-Time Only)
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink)]">Microphone:</strong> Activated only when you tap the Munim Voice Orb or Counter Mode. Common Hindi/Hinglish/English entries resolve offline on your device. Only complex spoken text transcripts are sent securely over HTTPS for AI parsing—never raw audio recordings and never for advertising.
          </p>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink)]">Camera &amp; Photos:</strong> Activated only when you tap &ldquo;Take Photo&rdquo; or &ldquo;Upload&rdquo; inside the AI Parchi Scanner or attach a receipt to an entry. Compressed slip images are sent over HTTPS solely to extract party names, items, and totals into your ledger.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--brand-accent)]" />
            3. Cloud Sync, Offline Cache &amp; WhatsApp / UPI Links
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-[var(--ink)]">Private Cloud Sync:</strong> When signed in via OTP, records sync inside Google Cloud Firestore scoped strictly to your authenticated phone UID.
            </li>
            <li>
              <strong className="text-[var(--ink)]">No Data Selling &amp; No Ads:</strong> Ucred never sells, rents, or shares your customer phone numbers, credit balances, or sales with third-party advertisers, data brokers, or credit bureaus.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Direct WhatsApp &amp; UPI:</strong> Payment reminders and receipts open your device&apos;s WhatsApp or UPI app directly with your chosen amount and VPA.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-[var(--brand-accent)]" />
            4. Export, Local Wipe &amp; Permanent Deletion
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Export a full JSON backup or CSV ledger report anytime from Settings. In Guest Mode, use <strong className="text-[var(--ink)]">Clear All Business Data</strong> in Settings to wipe on-device records. Signed-in users can permanently delete their account and cloud records via Settings or our{' '}
            <Link href="/delete-account" className="font-bold text-[var(--ink)] underline">
              Data &amp; Account Deletion instructions
            </Link>
            . Support contact: <span className="font-bold text-[var(--ink)]">support@ucred.app</span>.
          </p>
        </section>

        <footer className="bg-[var(--surface-subtle)] rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <span>
            Also review our{' '}
            <Link href="/terms" className="font-semibold text-[var(--ink)] underline">
              Terms of Service
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
