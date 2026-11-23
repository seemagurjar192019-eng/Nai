'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CloudUpload,
  Lock,
  Mail,
  Mic,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  Smartphone,
  Store,
  User,
} from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { UCRED_LOGO_PATH } from '@/lib/i18n';
import {
  PERSONA_OPTIONS,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';

interface PersonaOnboardingSheetProps {
  initialPrefs: PersonaPrefs;
  initialStep?: 1 | 2 | 3;
  isSignedIn?: boolean;
  verifiedIdentity?: string;
  authBusy?: boolean;
  authError?: string;
  emailLinkSentTo?: string;
  onGoogleSignIn?: () => Promise<void>;
  onSendEmailLink?: (email: string) => Promise<void>;
  onOpenPhoneSignIn?: () => void;
  onComplete: (prefs: PersonaPrefs) => void;
}

const PERSONA_ICONS: Record<PersonaCategoryId, React.ComponentType<{ className?: string }>> = {
  personal: User,
  kirana: Store,
  mandi: Scale,
  wholesale: Package,
};

const SPRING_TACTILE = { type: 'spring' as const, stiffness: 460, damping: 28 };
const STEP_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Apple iOS 27 3-Step Launch Sequence:
 * 1. Minimalist Apple Hero Welcome (squircle mark, headline, 3 unboxed capabilities, Get Started + Skip)
 * 2. Optional Cloud Backup Sign-In (Google, Passwordless Email Link, +91 OTP, or Skip as Guest)
 * 3. Grouped Inset Workspace Mode Selection (Personal, Retail Store, Mandi, Wholesale -> Launch Ucred)
 */
export const PersonaOnboardingSheet: React.FC<PersonaOnboardingSheetProps> = ({
  initialPrefs,
  initialStep = 1,
  isSignedIn = false,
  verifiedIdentity,
  authBusy = false,
  authError = '',
  emailLinkSentTo = '',
  onGoogleSignIn,
  onSendEmailLink,
  onOpenPhoneSignIn,
  onComplete,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [selected, setSelected] = useState<PersonaCategoryId[]>(
    initialPrefs.categories.length > 0 ? initialPrefs.categories : ['kirana']
  );

  const toggleCategory = (id: PersonaCategoryId) => {
    haptics.tap();
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const finishOnboarding = (cats: PersonaCategoryId[]) => {
    haptics.success();
    const safeCats: PersonaCategoryId[] = cats.length > 0 ? cats : ['kirana'];
    onComplete({
      onboarded: true,
      categories: safeCats,
      activeFocus: safeCats[0],
    });
  };

  const handleEmailSubmit = async () => {
    const clean = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLocalError('');
    await onSendEmailLink?.(clean);
  };

  const combinedError = localError || authError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Ucred"
      className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto no-scrollbar select-none"
    >
      <div className="min-h-full max-w-[440px] mx-auto w-full flex flex-col justify-between px-6 py-6">
        {/* Top Bar: Step Progress Indicator + Instant Skip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
            {([1, 2, 3] as const).map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s ? 'w-7 bg-[var(--brand)]' : 'w-2 bg-[var(--surface-border)]'
                }`}
              />
            ))}
          </div>

          <motion.button
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={SPRING_TACTILE}
            type="button"
            onClick={() => finishOnboarding(selected)}
            className="min-h-[38px] px-3.5 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
          >
            Skip
          </motion.button>
        </div>

        {/* Main Step Viewport */}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="onboarding-step-1"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.26, ease: STEP_EASE }}
              className="flex-1 flex flex-col items-center justify-center py-8 space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-5">
                <motion.div
                  initial={prefersReducedMotion ? undefined : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...SPRING_TACTILE, delay: 0.04 }}
                  className="w-[84px] h-[84px] rounded-[24px] overflow-hidden shadow-[var(--spatial-shadow-lg)] border border-[var(--surface-border)] bg-[var(--surface)]"
                >
                  <Image
                    src={UCRED_LOGO_PATH}
                    alt="Ucred"
                    width={84}
                    height={84}
                    priority
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </motion.div>

                <div className="space-y-2.5 max-w-[340px]">
                  <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)] leading-[1.12] tracking-tight text-balance">
                    Your business ledger, reimagined.
                  </h1>
                  <p className="text-[14px] font-medium text-[var(--ink-muted)] leading-relaxed">
                    Voice khata in English &amp; Hinglish, receipt scanning, GST billing, and
                    zero-knowledge encrypted sync.
                  </p>
                </div>
              </div>

              {/* 3 Clean Unboxed Capabilities */}
              <div className="w-full divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Voice Munim in Hinglish &amp; English
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Speak entries naturally — hands-free at your counter
                    </p>
                  </div>
                </div>

                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-xl bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Receipt Scan, Bills &amp; Stock Sync
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Scan handwritten parchi notes &amp; issue 58mm or GST bills
                    </p>
                  </div>
                </div>

                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-xl bg-[var(--surface-subtle)] text-[var(--ink)] flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Zero-Knowledge AES-256 Encryption
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Your records stay encrypted on this device and in your vault
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="onboarding-step-2-signin"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.26, ease: STEP_EASE }}
              className="flex-1 flex flex-col items-center justify-center py-6 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-3 max-w-[330px]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] text-[var(--brand-accent)] flex items-center justify-center shadow-[var(--spatial-shadow)]">
                  <CloudUpload className="w-7 h-7" />
                </div>
                <h2 className="font-display text-[24px] font-extrabold text-[var(--ink)] leading-tight text-balance">
                  {isSignedIn ? 'Encrypted Cloud Connected' : 'Back up your ledger for free'}
                </h2>
                <p className="text-xs font-medium text-[var(--ink-muted)] leading-relaxed">
                  {isSignedIn
                    ? `Signed in as ${verifiedIdentity || 'your account'}. All ledger records are end-to-end encrypted.`
                    : 'Sign in with Google or Email Link for multi-device encrypted sync, or continue offline on this device.'}
                </p>
              </div>

              <div className="w-full ios27-inset-group rounded-[26px] p-4 space-y-2.5 text-left">
                {isSignedIn ? (
                  <div className="min-h-[48px] px-4 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] font-extrabold text-sm flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    <span className="truncate">Signed In · {verifiedIdentity || 'Synced'}</span>
                  </div>
                ) : (
                  <>
                    <motion.button
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                      transition={SPRING_TACTILE}
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        haptics.tap();
                        setLocalError('');
                        void onGoogleSignIn?.();
                      }}
                      className="tactile-key-primary w-full min-h-[50px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-sm flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
                    >
                      <span className="w-5 h-5 rounded-full bg-white text-[#4F46E5] font-black text-xs flex items-center justify-center">
                        G
                      </span>
                      <span>{authBusy ? 'Connecting...' : 'Continue with Google (Gmail)'}</span>
                    </motion.button>

                    {!showEmailForm ? (
                      <motion.button
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        transition={SPRING_TACTILE}
                        type="button"
                        disabled={authBusy}
                        onClick={() => {
                          haptics.tap();
                          setLocalError('');
                          setShowEmailForm(true);
                        }}
                        className="w-full min-h-[46px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                        <span>Continue with Email Link</span>
                      </motion.button>
                    ) : (
                      <div className="rounded-2xl bg-[var(--app-bg)] p-3 space-y-2">
                        {emailLinkSentTo ? (
                          <div className="text-xs font-bold text-[var(--debit-green)] bg-[var(--debit-tint)] rounded-xl p-2.5 text-center">
                            Sign-in link sent to <span className="underline">{emailLinkSentTo}</span>.
                            Open it on this device to connect.
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !authBusy) void handleEmailSubmit();
                              }}
                              placeholder="you@gmail.com"
                              className="flex-1 min-h-[44px] rounded-xl bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                            />
                            <button
                              type="button"
                              disabled={authBusy}
                              onClick={() => {
                                haptics.tap();
                                void handleEmailSubmit();
                              }}
                              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold disabled:opacity-60"
                            >
                              {authBusy ? '...' : 'Send'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        haptics.tap();
                        onOpenPhoneSignIn?.();
                      }}
                      className="w-full min-h-[44px] px-3 rounded-xl text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center gap-1.5 transition"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Or verify with +91 Mobile OTP</span>
                    </button>

                    {combinedError && (
                      <p
                        role="alert"
                        className="rounded-xl bg-[var(--credit-tint)] px-3 py-2 text-xs font-bold text-[var(--credit-red)]"
                      >
                        {combinedError}
                      </p>
                    )}
                  </>
                )}

                <div className="pt-1 border-t border-[var(--surface-border)]">
                  <motion.button
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    transition={SPRING_TACTILE}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setStep(3);
                    }}
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[var(--surface-subtle)] text-[var(--ink)] font-display font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{isSignedIn ? 'Choose Workspace Mode' : 'Skip & Continue as Guest'}</span>
                    <ArrowRight className="w-4 h-4 text-[var(--ink-muted)]" />
                  </motion.button>
                </div>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--debit-green)] shrink-0" />
                <span>End-to-end AES-256 encrypted before leaving your device</span>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="onboarding-step-3"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
              transition={{ duration: 0.26, ease: STEP_EASE }}
              className="flex-1 flex flex-col justify-center py-6 space-y-5"
            >
              <div className="space-y-1.5 text-center">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                  Workspace Setup
                </p>
                <h2 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                  How will you use Ucred?
                </h2>
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  Select one or more modes — switch anytime from the top bar.
                </p>
              </div>

              <div className="ios27-inset-group rounded-[26px] divide-y divide-[var(--surface-border)] overflow-hidden">
                {PERSONA_OPTIONS.map((opt) => {
                  const Icon = PERSONA_ICONS[opt.id];
                  const isSelected = selected.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-label={`${opt.title}: ${opt.subtitle}`}
                      aria-pressed={isSelected}
                      onClick={() => toggleCategory(opt.id)}
                      className={`w-full min-h-[68px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors active:bg-[var(--surface-subtle)] ${
                        isSelected ? 'bg-[var(--brand-tint)]/40' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          style={{
                            backgroundColor: isSelected ? opt.accentHex : opt.tintBg,
                            color: isSelected ? '#FFFFFF' : opt.accentHex,
                          }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-extrabold text-[var(--ink)] leading-snug">
                            {opt.title}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--ink-muted)] leading-snug mt-0.5">
                            {opt.subtitle}
                          </p>
                        </div>
                      </div>

                      <motion.span
                        animate={
                          prefersReducedMotion ? undefined : { scale: isSelected ? 1 : 0.88 }
                        }
                        transition={SPRING_TACTILE}
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[var(--brand)] text-white'
                            : 'border-2 border-[var(--surface-border)] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </motion.span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Tactile CTA */}
        <div className="pt-3 pb-safe space-y-2">
          {step === 1 ? (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={SPRING_TACTILE}
              onClick={() => {
                haptics.tap();
                setStep(2);
              }}
              className="tactile-key-primary w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          ) : step === 2 ? (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setStep(3);
              }}
              className="w-full min-h-[44px] text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
            >
              Skip Sign-In &amp; Choose Workspace &rarr;
            </button>
          ) : (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={SPRING_TACTILE}
              onClick={() => finishOnboarding(selected)}
              className="tactile-key-primary w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Ucred ({selected.length})</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};
