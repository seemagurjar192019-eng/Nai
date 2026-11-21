'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Check,
  CloudUpload,
  Package,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  User,
} from 'lucide-react';
import { haptic } from '@/lib/haptic';
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
  verifiedPhone?: string;
  onOpenSignIn?: () => void;
  onComplete: (prefs: PersonaPrefs) => void;
}

const PERSONA_ICONS: Record<PersonaCategoryId, React.ComponentType<{ className?: string }>> = {
  personal: User,
  kirana: Store,
  mandi: Scale,
  wholesale: Package,
};

const SPRING_TACTILE = { type: 'spring' as const, stiffness: 460, damping: 24 };

/**
 * Real-App 3-Screen Launch Sequence:
 * - Step 1: Branded Welcome with breathing Matte Royal Indigo MunimVoiceOrb
 * - Step 2: Claude-Style Optional Sign-In (+91 Mobile OTP OR Continue as Guest)
 * - Step 3: Multi-Select Workspace Mode (Personal, Kirana, Mandi, Wholesale)
 */
export const PersonaOnboardingSheet: React.FC<PersonaOnboardingSheetProps> = ({
  initialPrefs,
  initialStep = 1,
  isSignedIn = false,
  verifiedPhone,
  onOpenSignIn,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [selected, setSelected] = useState<PersonaCategoryId[]>(
    initialPrefs.categories.length > 0 ? initialPrefs.categories : ['kirana']
  );

  const toggleCategory = (id: PersonaCategoryId) => {
    haptic.tap();
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const finishOnboarding = (cats: PersonaCategoryId[]) => {
    haptic.success();
    if (
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      try {
        void confetti({
          particleCount: 26,
          spread: 60,
          startVelocity: 22,
          scalar: 0.78,
          origin: { y: 0.7 },
          colors: ['#4F46E5', '#06B6D4', '#16A34A', '#F59E0B'],
          disableForReducedMotion: true,
        });
      } catch {
        // Ignore confetti errors
      }
    }
    const safeCats: PersonaCategoryId[] = cats.length > 0 ? cats : ['kirana'];
    onComplete({
      onboarded: true,
      categories: safeCats,
      activeFocus: safeCats[0],
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Ucred Bolne Wala Munim"
      className="absolute inset-0 z-50 bg-[#FFFFFF] dark:bg-[#16181D] flex flex-col justify-between p-6 overflow-y-auto no-scrollbar select-none"
    >
      {/* Top Bar: 3-Step Dots + Instant Skip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === dot ? 'w-6 bg-[var(--brand)]' : 'w-2 bg-[var(--surface-subtle)]'
              }`}
            />
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.94, y: 1 }}
          transition={SPRING_TACTILE}
          type="button"
          onClick={() => finishOnboarding(selected)}
          className="min-h-[36px] px-3 rounded-full bg-[var(--surface-subtle)] text-xs font-extrabold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Skip
        </motion.button>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
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
              ariaLabel="Continue to sign in or guest setup"
            />

            <div className="space-y-3 max-w-[320px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Offline Voice + Galla OS</span>
              </div>

              <h1 className="font-display text-[26px] font-extrabold text-[var(--ink)] leading-tight">
                Namaste! Aapka apna Bolne Wala Munim
              </h1>

              <p className="text-sm font-medium text-[var(--ink-muted)] leading-relaxed">
                Boliye &amp; likhiye seconds mein. Instant offline khata, parchi scan aur live
                galla — bina kisi rukawat ke.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--debit-green)] bg-[var(--debit-tint)] px-3.5 py-2 rounded-2xl">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>100% Private on Device · Optional Cloud Sync</span>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="onboarding-step-2-signin"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-6"
          >
            <div className="w-16 h-16 rounded-3xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shadow-[var(--spatial-shadow)]">
              <CloudUpload className="w-8 h-8" />
            </div>

            <div className="space-y-2.5 max-w-[320px]">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                Optional Backup
              </p>
              <h2 className="font-display text-[24px] font-extrabold text-[var(--ink)] leading-tight">
                {isSignedIn ? 'Cloud Backup Active' : 'Sign in to Sync Across Devices'}
              </h2>
              <p className="text-sm font-medium text-[var(--ink-muted)] leading-relaxed">
                {isSignedIn
                  ? `Connected cleanly as ${verifiedPhone || 'Cloud User'}. Ready to choose your workspace mode.`
                  : 'Connect your +91 mobile via SMS OTP for automatic encrypted backup, or continue straight offline as Guest.'}
              </p>
            </div>

            <div className="w-full max-w-[340px] space-y-2.5 pt-2">
              {!isSignedIn && onOpenSignIn && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96, y: 1 }}
                  transition={SPRING_TACTILE}
                  onClick={() => {
                    haptic.tap();
                    onOpenSignIn();
                  }}
                  style={{ background: 'var(--munim-gradient)' }}
                  className="tactile-key-primary w-full min-h-[54px] px-4 rounded-2xl text-white font-display font-extrabold text-sm flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Continue with +91 Mobile OTP</span>
                </motion.button>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.96, y: 1 }}
                transition={SPRING_TACTILE}
                onClick={() => {
                  haptic.tap();
                  setStep(3);
                }}
                className="w-full min-h-[52px] px-4 rounded-2xl bg-[var(--app-bg)] dark:bg-[#20232A] text-[var(--ink)] font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[var(--spatial-shadow)] cursor-pointer"
              >
                <span>{isSignedIn ? 'Choose Workspace Mode' : 'Continue as Guest'}</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="onboarding-step-3-modes"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col justify-center py-4 space-y-4"
          >
            <div className="space-y-1 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                Multi-Select Mode
              </p>
              <h2 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                Aapka Kaam Kya Hai?
              </h2>
              <p className="text-xs font-semibold text-[var(--ink-muted)]">
                Select one or more modes — voice hints &amp; tools adapt automatically.
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
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96, y: 2 }}
                    onClick={() => toggleCategory(opt.id)}
                    className={`w-full rounded-[24px] p-4 flex items-center justify-between gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand)] shadow-[var(--spatial-shadow)]'
                        : 'bg-[var(--app-bg)] dark:bg-[#20232A] shadow-[var(--spatial-shadow)]'
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
                          : 'bg-[var(--surface)] text-transparent ring-1 ring-[var(--surface-border)]'
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
        {step === 1 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94, y: 2 }}
            transition={SPRING_TACTILE}
            onClick={() => {
              haptic.tap();
              setStep(2);
            }}
            style={{ background: 'var(--munim-gradient)' }}
            className="tactile-key-primary w-full min-h-[54px] rounded-full text-white font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        )}

        {step === 2 && (
          <p className="text-[11px] font-semibold text-center text-[var(--ink-muted)]">
            Guest Mode stores data 100% locally — connect OTP anytime in Tools.
          </p>
        )}

        {step === 3 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94, y: 2 }}
            transition={SPRING_TACTILE}
            onClick={() => finishOnboarding(selected)}
            style={{ background: 'var(--munim-gradient)' }}
            className="tactile-key-primary w-full min-h-[54px] rounded-full text-white font-display font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Launch My Khata ({selected.length})</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
};
