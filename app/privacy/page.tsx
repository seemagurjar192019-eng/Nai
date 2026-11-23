import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mic, Database, Lock, Trash2, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Ucred Smart Ledger PWA and Android app covering Google Sign-In, Passwordless Email Link, optional Mobile OTP authentication, Cloud Firestore sync, DPDP Act 2023 compliance, and account deletion.',
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
            Privacy &amp; DPDP Act 2023 Compliance
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            Ucred Privacy Policy
          </h1>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Ucred (&ldquo;Voice Ledger &amp; Cashbook OS&rdquo;), operated by Naitik Web Studio, helps merchants and individuals manage credits, payments, bills, inventory, cashbook records, and counter logs. You can use Instant Guest Mode immediately on-device or optionally sign in via Google, Email Verification Link, or +91 Mobile OTP for zero-knowledge encrypted cloud backup.
          </p>
        </header>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--brand-accent)]" />
            1. Zero-Knowledge Local &amp; Cloud Vault Storage
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-[var(--ink)]">Instant Guest Mode (AES-256-GCM On-Device):</strong> When used without signing in, your workspace, contacts, transactions, cashbook, stock, and bills stay strictly on your device encrypted with a 256-bit AES-GCM device key stored inside browser IndexedDB.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Optional Authentication (Google, Email Link, or +91 OTP):</strong> If you choose Cloud Sync, Firebase Authentication verifies your Gmail address, email verification link, or +91 mobile number solely to scope, merge, and safeguard your encrypted ledger across devices.
            </li>
            <li>
              <strong className="text-[var(--ink)]">On-Device Screen Protections:</strong> Optional 4-digit App Lock PIN (salted PBKDF2-SHA256 with persistent lockout protection), Device Biometric Passkey (WebAuthn), Idle Auto-Lock Timer, and Window Privacy Curtain never transmit biometric data off your device.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Merchant Responsibility for Contact Details:</strong> Under India&apos;s Digital Personal Data Protection (DPDP) Act 2023, you represent that you have a lawful basis and customer consent to store party names, phone numbers, and ledger balances for legitimate business accounting.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Mic className="h-4 w-4 text-[var(--brand-accent)]" />
            2. Microphone &amp; Camera Access (Just-In-Time Only)
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink)]">Microphone:</strong> Activated only when you tap Speak to Save or Hands-Free Counter Mode. Standard English, Hindi, and Hinglish entries parse offline on your device. Only complex spoken text transcripts are transmitted securely over HTTPS to our cloud parsing endpoint—never raw audio files and never for advertising.
          </p>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink)]">Camera &amp; Photos:</strong> Activated only when you tap &ldquo;Take Photo&rdquo; or &ldquo;Upload&rdquo; inside the Receipt Scanner or attach a receipt to an entry. Compressed slip images are sent over HTTPS solely to extract party names, items, and totals into your ledger.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--brand-accent)]" />
            3. Zero-Knowledge Encryption &amp; Third-Party Services
          </h2>
          <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)] space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-[var(--ink)]">Client-Side AES-256-GCM + PBKDF2-SHA256:</strong> Party names, mobile numbers, transaction notes, receipt attachments, bill details, and cashbook descriptions are encrypted on your device before syncing to Cloud Firestore scoped strictly to your authenticated UID. App Lock and Staff PINs are hashed with salted PBKDF2-SHA256.
            </li>
            <li>
              <strong className="text-[var(--ink)]">No Data Selling &amp; No Ads:</strong> Ucred never sells, rents, or shares your customer phone numbers, credit balances, or sales with advertisers, brokers, or credit bureaus.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Direct WhatsApp &amp; UPI:</strong> Payment reminders and digital receipts open your device&apos;s WhatsApp or UPI app directly with your configured UPI VPA.
            </li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--brand-accent)]" />
            4. Data Fiduciary &amp; Grievance Officer (India DPDP Act)
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink)]">Data Fiduciary / Developer:</strong> Naitik Web Studio (Ucred).<br />
            <strong className="text-[var(--ink)]">Grievance Officer &amp; Privacy Contact:</strong>{' '}
            <span className="font-bold text-[var(--ink)]">naitik.webstudio45@gmail.com</span>. Requests regarding access, correction, or erasure are addressed promptly within 7 business days.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-[var(--brand-accent)]" />
            5. Export, Local Wipe &amp; Permanent Deletion
          </h2>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Export a full JSON backup or CSV ledger report anytime from <strong className="text-[var(--ink)]">Settings</strong>. In Guest Mode, use <strong className="text-[var(--ink)]">Clear All Business Data</strong> to wipe on-device records. Signed-in users can permanently delete their account and cloud records via Settings or our{' '}
            <Link href="/delete-account" className="font-bold text-[var(--ink)] underline">
              Data &amp; Account Deletion instructions
            </Link>
            .
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
