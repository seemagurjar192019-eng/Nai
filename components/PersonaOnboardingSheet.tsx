'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
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
import { UCRED_LOGO_PATH, maskContactIdentifier } from '@/lib/i18n';
import {
  PERSONA_OPTIONS,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';
import { APPLE_EASE, SNAPPY_SPRING } from './motion/SpatialMotionEngine';

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

const WORKSPACE_ENGLISH_COPY: Record<PersonaCategoryId, { title: string; subtitle: string }> = {
  personal: {
    title: 'Personal Ledger',
    subtitle: 'Friends, rent, and daily expenses',
  },
  kirana: {
    title: 'Retail Store',
    subtitle: 'Customer credit, bills, and cashbook',
  },
  mandi: {
    title: 'Grain & Produce',
    subtitle: 'Weight, bags, and trade accounts',
  },
  wholesale: {
    title: 'Wholesale & Supply',
    subtitle: 'Bulk invoices, stock, and collections',
  },
};

const ALL_CATEGORY_IDS: PersonaCategoryId[] = ['personal', 'kirana', 'mandi', 'wholesale'];
const SPRING_TACTILE = SNAPPY_SPRING;
const STEP_EASE = APPLE_EASE;

/**
 * Crisp 3-Step English Onboarding:
 * 1. Welcome & Core Value (3 clean plain-English capabilities + Continue)
 * 2. Cloud Backup (Single clear primary flow + masked identity)
 * 3. Workspace Selection (Multi-select checkboxes + 1-tap Select All + clean "Open Ucred" CTA)
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
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const goStep = (next: 1 | 2 | 3) => {
    setDirection(next >= step ? 1 : -1);
    setStep(next);
  };

  const [emailInput, setEmailInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<PersonaCategoryId[]>(() =>
    initialPrefs.categories && initialPrefs.categories.length > 0
      ? initialPrefs.categories
      : ['kirana']
  );

  const maskedIdentity = verifiedIdentity ? maskContactIdentifier(verifiedIdentity) : '';
  const allSelected = selectedCategories.length === ALL_CATEGORY_IDS.length;

  const toggleCategory = (id: PersonaCategoryId) => {
    haptics.tap();
    setSelectedCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleToggleAll = () => {
    haptics.tap();
    if (allSelected) {
      const keep = selectedCategories.includes(initialPrefs.activeFocus)
        ? initialPrefs.activeFocus
        : selectedCategories[0] || 'kirana';
      setSelectedCategories([keep]);
    } else {
      setSelectedCategories([...ALL_CATEGORY_IDS]);
    }
  };

  const selectionSummary = useMemo(() => {
    if (allSelected) return 'All 4 workspaces enabled · Switch anytime from top bar';
    if (selectedCategories.length === 1) {
      return `${WORKSPACE_ENGLISH_COPY[selectedCategories[0]].title} workspace`;
    }
    return `${selectedCategories.map((id) => WORKSPACE_ENGLISH_COPY[id].title).join(' + ')}`;
  }, [allSelected, selectedCategories]);

  const finishOnboarding = () => {
    haptics.success();
    const safeCats: PersonaCategoryId[] =
      selectedCategories.length > 0 ? selectedCategories : ['kirana'];
    const focus = safeCats.includes(initialPrefs.activeFocus)
      ? initialPrefs.activeFocus
      : safeCats[0];
    onComplete({
      onboarded: true,
      categories: safeCats,
      activeFocus: focus,
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
      className="fixed inset-0 z-50 spatial-shell-bg overflow-y-auto no-scrollbar select-none"
    >
      <div className="min-h-full max-w-[440px] mx-auto w-full flex flex-col justify-between px-6 py-6">
        {/* Top Bar: Back + Step Indicator + Skip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  goStep(step === 3 ? 2 : 1);
                }}
                aria-label="Go back"
                className="w-11 h-11 rounded-full liquid-glass text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center active:scale-95 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
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
          </div>

          <motion.button
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={SPRING_TACTILE}
            type="button"
            onClick={finishOnboarding}
            className="min-h-[44px] px-4 rounded-full liquid-glass text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
          >
            Skip
          </motion.button>
        </div>

        {/* Main Step Viewport */}
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 ? (
            <motion.div
              key="onboarding-step-1"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.24, ease: STEP_EASE }}
              className="flex-1 flex flex-col items-center justify-center py-8 space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-5">
                <motion.div
                  initial={prefersReducedMotion ? undefined : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...SPRING_TACTILE, delay: 0.04 }}
                  className="w-[84px] h-[84px] rounded-[24px] overflow-hidden liquid-glass-elevated"
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

                <div className="space-y-2.5 max-w-[330px]">
                  <h1 className="font-display text-[30px] font-extrabold text-[var(--ink)] leading-[1.12] tracking-tight text-balance">
                    Simple, fast business ledger.
                  </h1>
                  <p className="text-[14px] font-medium text-[var(--ink-muted)] leading-relaxed">
                    Track credit, scan bills, and keep your daily cashbook ready.
                  </p>
                </div>
              </div>

              {/* 3 Clean Monochrome Capabilities */}
              <div className="w-full divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Voice Entries
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Speak an entry hands-free in seconds
                    </p>
                  </div>
                </div>

                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Receipt Scan &amp; Billing
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Scan paper bills and share GST invoices
                    </p>
                  </div>
                </div>

                <div className="py-3.5 flex items-center gap-3.5">
                  <span className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-[var(--ink)] leading-snug">
                      Private &amp; Backed Up
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
                      Your records stay protected on your device
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="onboarding-step-2-signin"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.24, ease: STEP_EASE }}
              className="flex-1 flex flex-col items-center justify-center py-6 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-3 max-w-[330px]">
                <div className="w-14 h-14 rounded-2xl liquid-glass-elevated text-[var(--ink)] flex items-center justify-center">
                  <CloudUpload className="w-7 h-7" />
                </div>
                <h2 className="font-display text-[24px] font-extrabold text-[var(--ink)] leading-tight text-balance">
                  {isSignedIn ? 'Cloud Backup Active' : 'Back up your ledger'}
                </h2>
                <p className="text-xs font-medium text-[var(--ink-muted)] leading-relaxed">
                  {isSignedIn
                    ? `Signed in as ${maskedIdentity || 'your account'}. Your records sync privately.`
                    : 'Sign in to sync across devices, or start offline right away.'}
                </p>
              </div>

              <div className="w-full ios27-inset-group rounded-[26px] p-4 space-y-2.5 text-left">
                {isSignedIn ? (
                  <div className="min-h-[50px] px-4 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] font-bold text-sm flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      Signed in{maskedIdentity ? ` · ${maskedIdentity}` : ''}
                    </span>
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
                      <span className="w-5 h-5 rounded-full bg-white text-[#111111] font-black text-xs flex items-center justify-center">
                        G
                      </span>
                      <span>{authBusy ? 'Connecting...' : 'Continue with Google'}</span>
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
                        className="w-full min-h-[46px] px-4 rounded-2xl bg-[var(--surface-subtle)] text-[var(--ink)] font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[var(--ink)] shrink-0" />
                        <span>Sign in with Email Link</span>
                      </motion.button>
                    ) : (
                      <div className="rounded-2xl bg-[var(--app-bg)] p-3 space-y-2">
                        {emailLinkSentTo ? (
                          <div className="text-xs font-bold text-[var(--debit-green)] bg-[var(--debit-tint)] rounded-xl p-2.5 text-center">
                            Sign-in link sent to{' '}
                            <span className="underline">
                              {maskContactIdentifier(emailLinkSentTo)}
                            </span>
                            . Open it on this device to connect.
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
                              placeholder="you@example.com"
                              className="flex-1 min-h-[44px] rounded-xl bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                            />
                            <button
                              type="button"
                              disabled={authBusy}
                              onClick={() => {
                                haptics.tap();
                                void handleEmailSubmit();
                              }}
                              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold disabled:opacity-60"
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
                      <span>Continue with Phone OTP</span>
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
              </div>

              <div className="space-y-1.5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--debit-green)] shrink-0" />
                  <span>Private and encrypted before sync</span>
                </p>
                <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                  <Link href="/privacy" className="hover:underline">
                    Privacy Policy
                  </Link>
                  {' · '}
                  <Link href="/terms" className="hover:underline">
                    Terms of Service
                  </Link>
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="onboarding-step-3"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.24, ease: STEP_EASE }}
              className="flex-1 flex flex-col justify-center py-5 space-y-4"
            >
              <div className="space-y-1.5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  Workspaces
                </p>
                <h2 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                  Choose your workspaces
                </h2>
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  Pick one or select multiple modes for how you work.
                </p>
              </div>

              {/* Quick header with Select All / Single Reset */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-[var(--ink-muted)] font-tabular">
                  {selectedCategories.length} of {ALL_CATEGORY_IDS.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="min-h-[36px] px-3 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-xs font-semibold text-[var(--ink)] active:scale-95 transition"
                >
                  {allSelected ? 'Use Single Mode' : 'Select All'}
                </button>
              </div>

              <div
                role="group"
                aria-label="Workspace selection"
                className="ios27-inset-group rounded-[26px] divide-y divide-[var(--surface-border)] overflow-hidden"
              >
                {PERSONA_OPTIONS.map((opt) => {
                  const Icon = PERSONA_ICONS[opt.id];
                  const isSelected = selectedCategories.includes(opt.id);
                  const isPrimary = isSelected && selectedCategories.length > 1 && selectedCategories[0] === opt.id;
                  const copy = WORKSPACE_ENGLISH_COPY[opt.id];
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`${copy.title}: ${copy.subtitle}`}
                      onClick={() => toggleCategory(opt.id)}
                      className={`w-full min-h-[66px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors active:bg-[var(--surface-subtle)] ${
                        isSelected ? 'bg-[var(--surface-subtle)]/75' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors border ${
                            isSelected
                              ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--surface)]'
                              : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink)]'
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-display text-sm font-extrabold text-[var(--ink)] leading-snug truncate">
                              {copy.title}
                            </p>
                            {isPrimary && (
                              <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[10px] font-semibold text-[var(--ink-muted)] shrink-0">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-[var(--ink-muted)] leading-snug mt-0.5 truncate">
                            {copy.subtitle}
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
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                            : 'border-2 border-[var(--surface-border)] text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </motion.span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] font-medium text-[var(--ink-muted)] text-center px-2 truncate">
                {selectionSummary}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Single Clear Action */}
        <div className="pt-3 pb-safe">
          {step === 1 ? (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={SPRING_TACTILE}
              onClick={() => {
                haptics.tap();
                goStep(2);
              }}
              className="tactile-key-primary w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          ) : step === 2 ? (
            isSignedIn ? (
              <motion.button
                type="button"
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                transition={SPRING_TACTILE}
                onClick={() => {
                  haptics.tap();
                  goStep(3);
                }}
                className="tactile-key-primary w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  goStep(3);
                }}
                className="w-full min-h-[48px] rounded-2xl text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
              >
                Continue Without Account &rarr;
              </button>
            )
          ) : (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={SPRING_TACTILE}
              onClick={finishOnboarding}
              className="tactile-key-primary w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Ucred</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};
