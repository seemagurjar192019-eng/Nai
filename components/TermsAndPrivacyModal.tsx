'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ShieldCheck,
  X,
  ExternalLink,
  ChevronRight,
  Lock,
  Scale,
  UserCheck,
  AlertCircle,
  Mail,
  Building,
} from 'lucide-react';
import { useBackStack } from '@/hooks/useBackStack';

interface TermsAndPrivacyModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
  onAgreeAndContinue?: () => void;
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  open,
  onClose,
  initialTab = 'terms',
  onAgreeAndContinue,
}) => {
  const [tab, setTab] = useState<'terms' | 'privacy'>(initialTab);

  useBackStack(open, () => {
    onClose();
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl h-[100dvh] sm:h-[90vh] bg-[var(--app-bg)] text-[var(--ink)] sm:rounded-[28px] border border-[var(--surface-border)] shadow-2xl flex flex-col overflow-hidden select-text"
        >
          {/* Header Bar */}
          <div className="p-4 sm:px-6 border-b border-[var(--surface-border)] flex items-center justify-between gap-3 shrink-0 pt-safe bg-[var(--surface)]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--ink)]">
                <Scale className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-[var(--ink)]">
                  Legal, Terms &amp; Privacy Policy
                </h2>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Compliant with DPDP Act 2023 &amp; Indian IT Act 2000
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close legal documents"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Segment Toggle */}
          <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('terms')}
              className={`flex-1 min-h-[38px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                tab === 'terms'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--glass-border)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('privacy')}
              className={`flex-1 min-h-[38px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                tab === 'privacy'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--glass-border)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy (DPDP 2023)</span>
            </button>
          </div>

          {/* Scrollable Legal Clauses */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-6 text-xs sm:text-[13px] leading-relaxed text-[var(--ink)] overscroll-contain">
            {tab === 'terms' ? (
              <div className="space-y-6">
                <div className="rounded-2xl p-4 bg-[var(--surface-subtle)] border border-[var(--glass-border)] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)]">
                    Legal Agreement · Effective Date: November 2026
                  </span>
                  <p className="font-semibold text-sm text-[var(--ink)]">
                    Ucred Digital Ledger &amp; Cashbook Operating Software
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Please read these Terms carefully. By installing, opening, or accessing Ucred, you enter into a legally binding digital contract under the Indian Contract Act, 1872 and the Information Technology Act, 2000.
                  </p>
                </div>

                {/* Clause 1 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>Acceptance of Terms &amp; User Eligibility</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    By accessing or using Ucred (&ldquo;App&rdquo;, &ldquo;We&rdquo;, &ldquo;Us&rdquo;, or &ldquo;Our&rdquo;), you confirm that you are at least eighteen (18) years of age, or have attained the age of majority in your jurisdiction, and are legally competent to enter into a binding agreement. If you are operating Ucred on behalf of a proprietorship, partnership firm, Hindu Undivided Family (HUF), or company, you represent and warrant that you possess full legal authority to bind said business entity to these Terms.
                  </p>
                </section>

                {/* Clause 2 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">2</span>
                    <span>Nature of Service &amp; FinTech Non-Banking Disclaimer</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    <strong>Ucred is strictly a local-first digital ledger, receipt scanning, and personal/business bookkeeping utility.</strong> Ucred is NOT a bank, Non-Banking Financial Company (NBFC), payment aggregator, payment gateway, escrow service, or money transmitter registered under the Reserve Bank of India (RBI) Act, 1934 or the Payment and Settlement Systems Act, 2007.
                  </p>
                  <p className="text-[var(--ink-muted)]">
                    Ucred does NOT lend money, hold customer deposits, charge credit interest on its own behalf, process financial settlements, or guarantee the recovery of any debt or udhaar entered into the app. All credit relationships, payment terms, interest calculations (&ldquo;Vyaaj&rdquo;), and customer reminders are solely bilateral commercial matters between you and your parties.
                  </p>
                </section>

                {/* Clause 3 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">3</span>
                    <span>Data Ownership, Local Storage &amp; Zero-Loss Custodial Responsibility</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    Ucred operates under a **Zero-Server / Local-First Architectural Paradigm**. All ledger transactions, party names, mobile contacts, cash drawer counts, and bill photos are encrypted and stored directly within your device&rsquo;s sandboxed local storage (IndexedDB).
                  </p>
                  <p className="text-[var(--ink-muted)]">
                    <strong>User Custodianship:</strong> Because We do not harvest or synchronize your private financial entries to centralized surveillance servers without your explicit opt-in Cloud Vault setup, <strong>YOU are solely and exclusively responsible for the preservation and backup of your data.</strong>
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--ink-muted)]">
                    <li>We strongly urge users to utilize the built-in &ldquo;Export Backup (JSON)&rdquo; or &ldquo;Export CSV&rdquo; feature weekly.</li>
                    <li>Ucred, its developers, and contributors shall bear ZERO liability for any loss of records caused by hardware loss, device theft, liquid damage, cache clearing, app uninstallation, or operating system upgrades.</li>
                  </ul>
                </section>

                {/* Clause 4 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">4</span>
                    <span>Accuracy of Voice Recognition &amp; OCR Parchi Scanning</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    Ucred provides automated voice parsing (&ldquo;Voice Munim&rdquo;) and bill scanning features designed to assist fast data capture for Indian shopkeepers. While these tools utilize advanced acoustic models and OCR engines calibrated for Hinglish and Indian retail handwriting, they are assistive technologies and may occasionally misinterpret noisy accents, colloquial slang, or faint handwriting.
                  </p>
                  <p className="text-[var(--ink-muted)]">
                    <strong>Mandatory Verification:</strong> You must always review and verify the previewed customer name, transaction direction (Credit / Debit), and rupee amount before tapping &ldquo;Confirm&rdquo;. Ucred is not responsible for commercial disputes arising from unverified entries.
                  </p>
                </section>

                {/* Clause 5 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">5</span>
                    <span>Prohibited Use &amp; User Conduct</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    You agree to use Ucred only for lawful commercial, retail, agricultural, or personal record-keeping purposes. You shall NOT record transactions involving:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--ink-muted)]">
                    <li>Money laundering, hawala transactions, or terrorist financing under the Prevention of Money Laundering Act, 2002 (PMLA).</li>
                    <li>Unregulated prize chits, Ponzi schemes, illegal lottery, or wagering contracts.</li>
                    <li>Contraband, narcotics, or prohibited goods under the laws of the Republic of India.</li>
                  </ul>
                </section>

                {/* Clause 6 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">6</span>
                    <span>Limitation of Liability &amp; Indemnification</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    To the maximum extent permitted by applicable Indian law, Ucred and its software authors provide the software on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind. Under no circumstances shall Ucred be liable for indirect, incidental, punitive, or consequential damages, lost profits, business interruption, or tax penalties resulting from your use or inability to use the software.
                  </p>
                </section>

                {/* Clause 7 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[10px] flex items-center justify-center font-bold">7</span>
                    <span>Governing Law, Dispute Resolution &amp; Jurisdiction</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    These Terms shall be governed by, construed, and enforced exclusively in accordance with the substantive laws of the Republic of India. In the event of any legal dispute or claim arising out of or in connection with these Terms, the courts situated in India shall have sole and exclusive jurisdiction.
                  </p>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl p-4 bg-[var(--surface-subtle)] border border-[var(--glass-border)] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)]">
                    Statutory Privacy Statement · DPDP Act 2023 Compliant
                  </span>
                  <p className="font-semibold text-sm text-[var(--ink)]">
                    Digital Personal Data Protection &amp; Privacy Policy
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Your financial and business sovereignty is absolute. Ucred adheres strictly to India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDPA) and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.
                  </p>
                </div>

                {/* Privacy Clause 1 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <span>Principle of Purpose Limitation &amp; Local Processing</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    We collect only the minimum device data necessary to deliver local bookkeeping utilities. Unlike traditional cloud fintech applications, <strong>We do not sell, rent, monetize, or broker your customer phone numbers, khata transactions, or trade balances to third-party marketing companies, credit bureaus, or loan aggregators.</strong>
                  </p>
                </section>

                {/* Privacy Clause 2 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Building className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <span>Device Hardware Permissions Disclosure</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    To deliver native mobile capabilities inside the Capacitor APK, Ucred requests explicit device access strictly on a just-in-time basis:
                  </p>
                  <div className="space-y-2 pt-1">
                    <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)]">
                      <p className="font-bold text-xs text-[var(--ink)]">Microphone (RECORD_AUDIO)</p>
                      <p className="text-[11px] text-[var(--ink-muted)]">
                        Accessed only when you tap the microphone button in Voice Munim. Audio is transcribed in real-time on your device; zero ambient background recordings or voice prints are retained.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)]">
                      <p className="font-bold text-xs text-[var(--ink)]">Camera &amp; Photo Gallery (CAMERA, READ_MEDIA_IMAGES)</p>
                      <p className="text-[11px] text-[var(--ink-muted)]">
                        Accessed only when you choose &ldquo;Take Photo&rdquo; or &ldquo;Upload Bill&rdquo; in the Parchi Scanner. Used solely to convert handwritten slips or paper invoices into line items.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)]">
                      <p className="font-bold text-xs text-[var(--ink)]">Storage &amp; File System (WRITE_EXTERNAL_STORAGE)</p>
                      <p className="text-[11px] text-[var(--ink-muted)]">
                        Used exclusively to export your encrypted JSON backups, generate GST invoice PDFs, or share payment reminder slips via WhatsApp.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Privacy Clause 3 */}
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <span>Your Rights under the DPDP Act 2023</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    As a Data Principal under Indian law, you possess inviolable rights:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--ink-muted)]">
                    <li><strong>Right to Access &amp; Portability:</strong> Export all your ledger and cashbook entries anytime via the 1-click &ldquo;Export CSV&rdquo; or &ldquo;Export JSON&rdquo; buttons.</li>
                    <li><strong>Right to Correction &amp; Erasure:</strong> Modify or permanently delete any customer, transaction, or business profile instantly. Because data is local, deletion clears data from your device storage immediately.</li>
                    <li><strong>Right of Grievance Redressal:</strong> Contact our designated Grievance Officer below.</li>
                  </ul>
                </section>

                {/* Privacy Clause 4: Grievance Officer */}
                <section className="space-y-2 pt-2 border-t border-[var(--surface-border)]">
                  <h3 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <span>Statutory Grievance Redressal Officer (Rule 3(11) of IT Rules, 2021)</span>
                  </h3>
                  <p className="text-[var(--ink-muted)]">
                    In compliance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, 2023, the details of our designated Grievance Redressal Officer are as follows:
                  </p>
                  <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] space-y-1">
                    <p className="font-bold text-xs text-[var(--ink)]">Officer Name: Naitik Gurjar</p>
                    <p className="text-xs text-[var(--ink-muted)]">Designation: Data Protection &amp; Legal Grievance Officer</p>
                    <p className="text-xs text-[var(--ink-muted)]">Email: <a href="mailto:grievance@ucred.app" className="text-[var(--brand-accent)] font-semibold underline">grievance@ucred.app</a></p>
                    <p className="text-xs text-[var(--ink-muted)]">Address: Ucred Digital Technologies, Madhya Pradesh, India</p>
                    <p className="text-[11px] text-[var(--ink-muted)] italic pt-1">
                      Response Timeline: Grievances are formally acknowledged within twenty-four to thirty-six (24–36) hours and redressed within fifteen (15) days as mandated by Indian statute.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:px-6 border-t border-[var(--surface-border)] bg-[var(--surface)] flex items-center justify-between gap-3 shrink-0 pb-safe">
            <span className="text-[11px] font-medium text-[var(--ink-muted)]">
              Ucred Legal Compliance v1.0
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 rounded-full bg-[var(--surface-subtle)] text-[var(--ink)] text-xs font-bold active:scale-95 transition"
              >
                Close
              </button>
              {onAgreeAndContinue && (
                <button
                  type="button"
                  onClick={() => {
                    onAgreeAndContinue();
                    onClose();
                  }}
                  className="min-h-[40px] px-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold active:scale-95 transition"
                >
                  Agree &amp; Continue
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
