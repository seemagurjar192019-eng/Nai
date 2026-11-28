'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, FileText, Check, ArrowRight, Scale, ExternalLink } from 'lucide-react';
import { TermsAndPrivacyModal } from './TermsAndPrivacyModal';
import { haptic } from '@/utils/haptics';

interface LegalConsentGateProps {
  onConsentGiven?: () => void;
}

const CONSENT_STORAGE_KEY = 'ucred_legal_consent_v1';

function subscribeConsent(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('ucred:consent_changed', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('ucred:consent_changed', callback);
  };
}

function getConsentSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return Boolean(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

export const LegalConsentGate: React.FC<LegalConsentGateProps> = ({ onConsentGiven }) => {
  const hasConsented = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerSnapshot);
  const [agreed, setAgreed] = useState(false);
  const [openLegalModal, setOpenLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');

  const handleConfirmConsent = () => {
    if (!agreed) return;
    haptic.success();
    try {
      localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          acceptedAt: new Date().toISOString(),
          version: '1.0',
          locale: 'en_IN',
        })
      );
      window.dispatchEvent(new Event('ucred:consent_changed'));
    } catch {
      // Ignore storage errors
    }
    onConsentGiven?.();
  };

  const handleOpenLegal = (tab: 'terms' | 'privacy') => {
    haptic.tap();
    setLegalModalTab(tab);
    setOpenLegalModal(true);
  };

  if (hasConsented) {
    return (
      <TermsAndPrivacyModal
        open={openLegalModal}
        onClose={() => setOpenLegalModal(false)}
        initialTab={legalModalTab}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 select-none">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[460px] bg-[var(--app-bg)] text-[var(--ink)] rounded-t-[32px] sm:rounded-[32px] border border-[var(--surface-border)] shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
          >
            {/* Top Emblem */}
            <div className="p-6 pt-7 text-center space-y-3 bg-[var(--surface-subtle)] border-b border-[var(--glass-border)]">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] flex items-center justify-center shadow-md">
                <Scale className="w-7 h-7 stroke-[1.9]" />
              </div>
              <div className="space-y-1">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-[var(--ink)]">
                  Welcome to Ucred
                </h1>
                <p className="text-xs text-[var(--ink-muted)] max-w-xs mx-auto leading-relaxed">
                  Voice Ledger, Receipt Scanner &amp; Cashbook OS for Indian Shopkeepers
                </p>
              </div>
            </div>

            {/* Scrollable Privacy & Compliance Pillars */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--ink)]">Local-First Storage · Zero Server Surveillance</p>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                      Your customer records, credit transactions, and bill images remain sandboxed on your device. Ucred never sells or monetizes your ledger entries.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-1 border-t border-[var(--glass-border)]">
                  <div className="w-7 h-7 rounded-lg bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--ink)]">Digital Bookkeeping Utility (Non-Banking Tool)</p>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                      Ucred is an assistive record-keeping tool. It is not an NBFC or bank, and does not lend money, hold deposits, or guarantee debt recovery.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mandatory Checkbox */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-xs">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      id="legal-terms-checkbox"
                      checked={agreed}
                      onChange={(e) => {
                        haptic.tap();
                        setAgreed(e.target.checked);
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        agreed
                          ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]'
                          : 'border-[var(--ink-muted)]/40 bg-[var(--app-bg)]'
                      }`}
                    >
                      {agreed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--ink)] leading-snug select-text">
                    I am 18+ and have read, understood, and agree to Ucred&rsquo;s{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenLegal('terms');
                      }}
                      className="font-bold underline text-[var(--brand-accent)] hover:opacity-80"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenLegal('privacy');
                      }}
                      className="font-bold underline text-[var(--brand-accent)] hover:opacity-80"
                    >
                      Privacy Policy (DPDP Act 2023)
                    </button>
                    . I acknowledge that I am solely responsible for regular device backups.
                  </div>
                </label>
              </div>
            </div>

            {/* Bottom Continue Button */}
            <div className="p-5 sm:p-6 pt-2 bg-[var(--surface)] border-t border-[var(--surface-border)] pb-safe">
              <button
                type="button"
                disabled={!agreed}
                onClick={handleConfirmConsent}
                className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
              >
                <span>Agree &amp; Get Started</span>
                <ArrowRight className="w-4 h-4 stroke-[2.2]" />
              </button>

              <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] text-[var(--ink-muted)]">
                <button
                  type="button"
                  onClick={() => handleOpenLegal('terms')}
                  className="hover:underline"
                >
                  View Terms
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('privacy')}
                  className="hover:underline"
                >
                  View Privacy Policy
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <TermsAndPrivacyModal
        open={openLegalModal}
        onClose={() => setOpenLegalModal(false)}
        initialTab={legalModalTab}
      />
    </>
  );
};
