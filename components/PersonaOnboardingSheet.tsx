'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CloudUpload,
  Mail,
  Package,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  User,
} from 'lucide-react';
import { haptics } from '@/utils/haptics';
import {
  PERSONA_OPTIONS,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';
import { MunimVoiceOrb } from './voice/MunimVoiceOrb';

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

const SPRING_TACTILE = { type: 'spring' as const, stiffness: 460, damping: 26 };

/**
 * iOS 27 3-Screen Launch Sequence:
 * 1. Clean English Welcome (breathing Royal Indigo Voice Orb + Get Started + Skip)
 * 2. Zero-Cost Multi-Auth Screen: Google (Gmail), Passwordless Email Link, optional +91 OTP, or Skip as Guest
 * 3. Workspace Mode Multi-Select (Personal, Retail Store, Mandi, Wholesale -> Launch Ucred)
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
      className="absolute inset-0 z-50 bg-[var(--app-bg)] flex flex-col justify-between p-6 overflow-y-auto no-scrollbar select-none"
    >
      {/* Top Bar: 3-Step Pill + Instant Skip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as const).map((s) => (
            <span
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === s ? 'w-6 bg-[var(--brand)]' : 'w-2 bg-[var(--surface-subtle)]'
              }`}
            />
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.94, y: 1 }}
          transition={SPRING_TACTILE}
          type="button"
          onClick={() => finishOnboarding(selected)}
          className="min-h-[36px] px-3.5 rounded-full bg-[var(--surface)] shadow-[var(--spatial-shadow)] text-xs font-extrabold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Skip
        </motion.button>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="onboarding-step-1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-6"
          >
            <MunimVoiceOrb
              size="hero"
              onClick={() => setStep(2)}
              ariaLabel="Start Ucred setup"
            />

            <div className="space-y-3 max-w-[320px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Offline Voice Ledger &amp; Cashbook</span>
              </div>

              <h1 className="font-display text-[28px] font-extrabold text-[var(--ink)] leading-tight tracking-tight">
                Your Smart Voice Ledger
              </h1>

              <p className="text-sm font-medium text-[var(--ink-muted)] leading-relaxed">
                Speak entries in English or Hinglish, scan handwritten receipts, track overdue dues, and issue bills — private on your device or synced to your cloud.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--debit-green)] bg-[var(--debit-tint)] px-3.5 py-2 rounded-2xl">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Private On-Device Vault · Optional Cloud Backup</span>
            </div>
          </motion.div>
        ) : step === 2 ? (
          <motion.div
            key="onboarding-step-2-signin"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center text-center py-4 space-y-5"
          >
            <div className="w-16 h-16 rounded-[22px] bg-[var(--surface)] text-[var(--brand-accent)] flex items-center justify-center shadow-[var(--spatial-shadow)]">
              <CloudUpload className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-[320px]">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                Optional Cloud Backup
              </p>
              <h2 className="font-display text-[24px] font-extrabold text-[var(--ink)] leading-tight">
                {isSignedIn ? 'Cloud Backup Connected' : 'Sync safely or skip for now'}
              </h2>
              <p className="text-xs font-medium text-[var(--ink-muted)] leading-relaxed">
                {isSignedIn
                  ? `Connected to ${verifiedIdentity || 'your cloud account'}. Your ledger syncs automatically.`
                  : 'Sign in for free with Google or Email Link so you never lose records, or continue offline in Guest Mode.'}
              </p>
            </div>

            <div className="w-full max-w-[340px] rounded-[24px] bg-[var(--surface)] shadow-[var(--spatial-shadow)] p-4 space-y-2.5 text-left">
              {isSignedIn ? (
                <div className="min-h-[48px] px-4 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] font-extrabold text-sm flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span className="truncate">Signed In · {verifiedIdentity || 'Synced'}</span>
                </div>
              ) : (
                <>
                  {/* 1. Primary Zero-Cost Google (Gmail) Sign-In */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
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

                  {/* 2. Passwordless Email Verification Link */}
                  {!showEmailForm ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_TACTILE}
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        haptics.tap();
                        setLocalError('');
                        setShowEmailForm(true);
                      }}
                      className="w-full min-h-[46px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] font-display font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                      <span>Continue with Email Link</span>
                    </motion.button>
                  ) : (
                    <div className="rounded-2xl bg-[var(--app-bg)] p-3 space-y-2">
                      {emailLinkSentTo ? (
                        <div className="text-xs font-bold text-[var(--debit-green)] bg-[var(--debit-tint)] rounded-xl p-2.5 text-center">
                          Sign-in link sent to <span className="underline">{emailLinkSentTo}</span>. Open that email on this browser to finish connecting.
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !authBusy) void handleEmailSubmit();
                              }}
                              placeholder="you@gmail.com"
                              className="flex-1 min-h-[42px] rounded-xl bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                            />
                            <button
                              type="button"
                              disabled={authBusy}
                              onClick={() => {
                                haptics.tap();
                                void handleEmailSubmit();
                              }}
                              className="min-h-[42px] px-3.5 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold disabled:opacity-60"
                            >
                              {authBusy ? '...' : 'Send'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 3. Optional +91 Mobile OTP */}
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      haptics.tap();
                      onOpenPhoneSignIn?.();
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center gap-1.5"
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

              <motion.button
                whileTap={{ scale: 0.97 }}
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
          </motion.div>
        ) : (
          <motion.div
            key="onboarding-step-3"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col justify-center py-4 space-y-4"
          >
            <div className="space-y-1 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                Workspace Modes
              </p>
              <h2 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                How will you use Ucred?
              </h2>
              <p className="text-xs font-semibold text-[var(--ink-muted)]">
                Select one or more workspaces — you can switch anytime from the top bar.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {PERSONA_OPTIONS.map((opt, index) => {
                const Icon = PERSONA_ICONS[opt.id];
                const isSelected = selected.includes(opt.id);
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    aria-label={`${opt.title}: ${opt.subtitle}`}
                    aria-pressed={isSelected}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_TACTILE, delay: index * 0.04 }}
                    whileTap={{ scale: 0.97, y: 1 }}
                    onClick={() => toggleCategory(opt.id)}
                    className={`w-full rounded-[22px] p-4 flex items-center justify-between gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--surface)] ring-2 ring-[var(--brand)] shadow-[var(--spatial-shadow)]'
                        : 'bg-[var(--surface)] opacity-85 shadow-[var(--spatial-shadow)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        style={{
                          backgroundColor: isSelected ? opt.accentHex : opt.tintBg,
                          color: isSelected ? '#FFFFFF' : opt.accentHex,
                        }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-extrabold text-[var(--ink)] leading-snug">
                          {opt.title}
                        </p>
                        <p className="text-[11px] font-semibold text-[var(--ink-muted)] leading-snug mt-0.5">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>

                    <motion.span
                      animate={{ scale: isSelected ? 1.06 : 0.94 }}
                      transition={SPRING_TACTILE}
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[var(--debit-green)] text-white shadow-sm'
                          : 'bg-[var(--surface-subtle)] text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom 3D Tactile CTA */}
      <div className="pt-3 pb-safe space-y-2">
        {step === 1 ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96, y: 1 }}
            transition={SPRING_TACTILE}
            onClick={() => {
              haptics.tap();
              setStep(2);
            }}
            style={{ background: 'var(--munim-gradient)' }}
            className="tactile-key-primary w-full min-h-[54px] rounded-full text-white font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
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
            className="w-full min-h-[42px] text-xs font-extrabold text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
          >
            Skip Sign-In &amp; Choose Workspace &rarr;
          </button>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96, y: 1 }}
            transition={SPRING_TACTILE}
            onClick={() => finishOnboarding(selected)}
            style={{ background: 'var(--munim-gradient)' }}
            className="tactile-key-primary w-full min-h-[54px] rounded-full text-white font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Launch Ucred ({selected.length})</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
};
