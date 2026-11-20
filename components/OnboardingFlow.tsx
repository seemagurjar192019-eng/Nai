'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Edit2,
  KeyRound,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  Sun,
  UserCheck,
} from 'lucide-react';
import { indianMobileSchema, otpCodeSchema } from '@/lib/design-system';
import { LANGUAGE_OPTIONS, UCRED_LOGO_PATH, getUIStrings } from '@/lib/i18n';
import type { AppearanceMode, LanguageCode } from '@/lib/types';

export type OnboardingStep =
  | 'splash'
  | 'language'
  | 'login'
  | 'verified'
  | 'welcome'
  | 'setup-business';

interface OnboardingFlowProps {
  step: OnboardingStep;
  language: LanguageCode;
  appearance: AppearanceMode;
  mobileNumber: string;
  otpSentTo: string | null;
  otpResendCooldown: number;
  authError: string;
  authBusy: boolean;
  onSelectLanguage: (lang: LanguageCode) => void;
  onToggleAppearance: () => void;
  onMobileChange: (phone: string) => void;
  onSendOtp: (phoneDigits: string) => Promise<void>;
  onVerifyOtp: (otpCode: string) => Promise<void>;
  onResetOtp: () => void;
  onWelcomeDone: () => void;
  onCreateBusiness: (payload: {
    name: string;
    category: string;
    upiId: string;
  }) => void;
  onStepChange: (step: OnboardingStep) => void;
}

const SHOP_CATEGORIES = [
  'Kirana / Grocery',
  'Wholesale / Mandi',
  'Medical / Pharmacy',
  'Hardware & Electrical',
  'Garments / Footwear',
  'General Retail',
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  step,
  language,
  appearance,
  mobileNumber,
  otpSentTo,
  otpResendCooldown,
  authError,
  authBusy,
  onSelectLanguage,
  onToggleAppearance,
  onMobileChange,
  onSendOtp,
  onVerifyOtp,
  onResetOtp,
  onWelcomeDone,
  onCreateBusiness,
  onStepChange,
}) => {
  const t = getUIStrings(language);
  const [agreed, setAgreed] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopCategoryInput, setShopCategoryInput] = useState('Kirana / Grocery');
  const [shopUpiInput, setShopUpiInput] = useState('');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const handleSendOtpClick = async () => {
    setLocalError('');
    const digits = mobileNumber.replace(/\D/g, '');
    const check = indianMobileSchema.safeParse(digits);
    if (!check.success) {
      setLocalError(check.error.issues[0]?.message || 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!agreed) {
      setLocalError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    setOtpInput('');
    await onSendOtp(digits);
  };

  const handleVerifyOtpClick = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError('');
    const cleanOtp = otpInput.replace(/\D/g, '').slice(0, 6);
    const check = otpCodeSchema.safeParse(cleanOtp);
    if (!check.success) {
      setLocalError(check.error.issues[0]?.message || 'Enter the 6-digit SMS OTP.');
      return;
    }
    await onVerifyOtp(cleanOtp);
  };

  // 1. SPLASH SCREEN — Clean Ucred Brand Reveal
  if (step === 'splash') {
    return (
      <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col items-center justify-between spatial-shell-bg px-6 py-12 text-center">
        <div className="flex-1 flex flex-col items-center justify-center gap-5 stagger-fade-up">
          <div className="w-24 h-24 rounded-[28px] overflow-hidden spatial-hero shrink-0">
            <Image
              src={UCRED_LOGO_PATH}
              alt="Ucred"
              width={96}
              height={96}
              priority
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
              Ucred
            </h1>
            <p className="text-sm font-medium text-[var(--ink-muted)]">
              Voice Khata, AI Parchi &amp; Live Galla OS
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-5">
          <div className="grid grid-cols-3 gap-3 text-[11px] font-bold tracking-wider uppercase text-[var(--ink-muted)]">
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-2xl spatial-card text-[var(--brand-accent)] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span>OTP Verified</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-2xl spatial-card text-[var(--brand-accent)] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </span>
              <span>Cloud Synced</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-2xl spatial-card text-[var(--brand-accent)] flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </span>
              <span>100% Private</span>
            </div>
          </div>

          <p className="text-xs font-semibold text-[var(--ink-muted)]">
            Built for Indian Retail &amp; Wholesale Merchants
          </p>
        </div>
      </div>
    );
  }

  // 2. LANGUAGE SELECTION
  if (step === 'language') {
    return (
      <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col spatial-shell-bg px-5 py-7">
        <div className="w-full flex-1 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl overflow-hidden spatial-card shrink-0">
                <Image
                  src={UCRED_LOGO_PATH}
                  alt="Ucred"
                  width={40}
                  height={40}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="font-display text-xl font-extrabold text-[var(--ink)]">
                Ucred
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAppearance}
                aria-label="Toggle Light or Dark mode"
                className="min-w-[44px] min-h-[44px] rounded-xl spatial-card flex items-center justify-center text-[var(--ink)] active:scale-95 transition"
              >
                {appearance === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <Link
                href="/privacy"
                className="min-h-[44px] inline-flex items-center text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] underline underline-offset-4 px-2"
              >
                Privacy
              </Link>
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
              {t.selectLanguage}
            </h1>
            <p className="text-sm text-[var(--ink-muted)]">
              Voice entry and bills adapt cleanly to your shop language.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {LANGUAGE_OPTIONS.map((opt, idx) => {
              const selected = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onSelectLanguage(opt.code)}
                  style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                  className={`stagger-fade-up relative text-left rounded-[22px] p-4 min-h-[68px] flex flex-col justify-center active:scale-95 transition ${
                    idx === 0 ? 'col-span-2' : ''
                  } ${
                    selected
                      ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)] shadow-md'
                      : 'spatial-card'
                  }`}
                >
                  <span className="text-lg font-bold leading-snug text-[var(--ink)]">
                    {opt.nativeName}
                  </span>
                  {opt.englishName !== opt.nativeName && (
                    <span className="text-xs font-medium text-[var(--ink-muted)] mt-0.5">
                      {opt.englishName}
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 pb-safe">
            <button
              type="button"
              onClick={() => onStepChange('login')}
              className="w-full min-h-[52px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 text-[var(--brand-fg)] text-base font-bold tactile-key-primary transition"
            >
              Continue ({LANGUAGE_OPTIONS.find((o) => o.code === language)?.nativeName || 'English'})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. REAL MOBILE NUMBER + 6-DIGIT SMS OTP SIGN-IN
  if (step === 'login') {
    const currentLangObj =
      LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

    return (
      <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col spatial-shell-bg px-5 py-6">
        <div className="w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl overflow-hidden spatial-card shrink-0">
                <Image
                  src={UCRED_LOGO_PATH}
                  alt="Ucred"
                  width={40}
                  height={40}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="font-display text-xl font-extrabold text-[var(--ink)]">
                Ucred
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAppearance}
                aria-label="Toggle Light or Dark mode"
                className="min-w-[44px] min-h-[44px] rounded-xl spatial-card flex items-center justify-center text-[var(--ink)] active:scale-95 transition"
              >
                {appearance === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-xl spatial-card text-sm font-semibold text-[var(--ink)] active:scale-95 transition"
                >
                  <span>{currentLangObj.nativeName}</span>
                  <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />
                </button>
                {langMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-[22px] spatial-sheet p-1.5 z-30">
                    {LANGUAGE_OPTIONS.slice(0, 6).map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          onSelectLanguage(opt.code);
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between ${
                          language === opt.code
                            ? 'bg-[var(--brand-tint)] text-[var(--ink)] font-bold'
                            : 'text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        <span>{opt.nativeName}</span>
                        {language === opt.code && (
                          <Check className="w-4 h-4 text-[var(--brand-accent)]" />
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setLangMenuOpen(false);
                        onStepChange('language');
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[var(--brand-accent)] hover:bg-[var(--surface-subtle)]"
                    >
                      All 11 Languages...
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div className="rounded-[28px] spatial-hero p-6 sm:p-7 space-y-6 my-auto stagger-fade-up">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              {otpSentTo ? <KeyRound className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>

            {!otpSentTo ? (
              <>
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                    {t.enterMobileTitle}
                  </h1>
                  <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                    Sign in directly with your 10-digit Indian mobile number &amp; SMS OTP. No email or Gmail popup required.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="ob-mobile"
                    className="block text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]"
                  >
                    {t.mobileLabel}
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface-subtle)] ring-2 ring-[var(--brand)] px-3.5 min-h-[56px]">
                    <Smartphone className="w-5 h-5 text-[var(--brand-accent)] shrink-0" />
                    <span className="font-tabular font-bold text-[var(--ink-muted)]">
                      +91
                    </span>
                    <input
                      id="ob-mobile"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={mobileNumber}
                      onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !authBusy) void handleSendOtpClick();
                      }}
                      placeholder="9876543210"
                      className="w-full bg-transparent text-xl font-bold font-tabular text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]/40"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    id="ob-agree"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded accent-[var(--brand)] shrink-0 cursor-pointer"
                  />
                  <label htmlFor="ob-agree" className="text-sm text-[var(--ink-muted)] leading-relaxed">
                    {t.agreePrefix}{' '}
                    <button
                      type="button"
                      onClick={() => setShowLegalModal('terms')}
                      className="font-semibold text-[var(--ink)] underline underline-offset-2"
                    >
                      Terms
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setShowLegalModal('privacy')}
                      className="font-semibold text-[var(--ink)] underline underline-offset-2"
                    >
                      Privacy Policy
                    </button>
                    .
                  </label>
                </div>

                {(localError || authError) && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-sm font-semibold text-[var(--credit-red)] leading-relaxed"
                  >
                    {localError || authError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleSendOtpClick()}
                  className="w-full min-h-[52px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 disabled:opacity-60 text-[var(--brand-fg)] text-base font-bold tactile-key-primary transition flex items-center justify-center gap-2"
                >
                  {authBusy ? 'Sending OTP...' : t.sendOtp}
                </button>
              </>
            ) : (
              <form onSubmit={(e) => void handleVerifyOtpClick(e)} className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                    Enter 6-Digit SMS OTP
                  </h1>
                  <div className="flex items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
                    <span>
                      Sent to <strong className="font-tabular text-[var(--ink)]">{otpSentTo}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalError('');
                        setOtpInput('');
                        onResetOtp();
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-accent)] hover:underline"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="ob-otp"
                    className="block text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]"
                  >
                    Verification Code
                  </label>
                  <input
                    id="ob-otp"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full min-h-[58px] rounded-2xl bg-[var(--surface-subtle)] ring-2 ring-[var(--brand)] px-4 text-center text-2xl font-extrabold font-tabular tracking-[0.45em] text-[var(--ink)] outline-none placeholder:tracking-[0.3em] placeholder:text-[var(--ink-muted)]/40"
                  />
                </div>

                {(localError || authError) && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-sm font-semibold text-[var(--credit-red)] leading-relaxed"
                  >
                    {localError || authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full min-h-[52px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 disabled:opacity-60 text-[var(--brand-fg)] text-base font-bold tactile-key-primary transition"
                >
                  {authBusy ? 'Verifying OTP...' : 'Verify & Open Khata'}
                </button>

                <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-muted)]">
                  <span>Didn&apos;t receive SMS?</span>
                  <button
                    type="button"
                    disabled={otpResendCooldown > 0 || authBusy}
                    onClick={() => void handleSendOtpClick()}
                    className="min-h-[36px] inline-flex items-center gap-1.5 font-bold text-[var(--brand-accent)] disabled:opacity-50 hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend OTP'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] pt-2">
              <span>Ucred Spatial OS · {appearance === 'dark' ? 'Dark' : 'Light'}</span>
              <div className="flex items-center gap-3">
                <Link href="/terms" className="font-semibold text-[var(--ink)] hover:underline">
                  Terms
                </Link>
                <Link href="/privacy" className="font-semibold text-[var(--ink)] hover:underline">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>

        {showLegalModal && (
          <div
            onClick={() => setShowLegalModal(null)}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[28px] spatial-sheet p-6 space-y-4 sheet-slide-up"
            >
              <h2 className="font-display text-lg font-extrabold text-[var(--ink)]">
                {showLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy & Security'}
              </h2>
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                {showLegalModal === 'terms'
                  ? 'Ucred stores your shop ledger, customer accounts, bills, Galla cashbook, and stock privately under your verified phone account. WhatsApp & SMS reminders are initiated directly from your device.'
                  : 'Your khata records are encrypted in transit and scoped strictly to your verified phone UID in Cloud Firestore, with local offline caching on your device. No third-party ad tracking is used.'}
              </p>
              <button
                type="button"
                onClick={() => setShowLegalModal(null)}
                className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold tactile-key-primary active:scale-95 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. VERIFICATION SUCCESSFUL
  if (step === 'verified') {
    return (
      <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col items-center justify-center spatial-shell-bg px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="w-24 h-24 rounded-full bg-[var(--debit-tint)] text-[var(--debit-green)] shadow-lg ring-4 ring-[var(--debit-green)] flex items-center justify-center"
        >
          <Check className="w-12 h-12 stroke-[3]" />
        </motion.div>
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
          {t.verificationSuccess}
        </h1>
      </div>
    );
  }

  // 5. WELCOME TO UCRED (Clean Real Onboarding — Zero Competitor Audio Clone)
  if (step === 'welcome') {
    return (
      <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col justify-between spatial-shell-bg px-6 py-10">
        <div className="w-full flex-1 flex flex-col items-center justify-center text-center gap-6 stagger-fade-up">
          <div className="w-32 h-32 rounded-[28px] spatial-hero flex flex-col items-center justify-center gap-2 p-4">
            <span className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <Store className="w-8 h-8" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--ink-muted)]">
              Ucred OS
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
              {t.welcomeFamily}
            </h1>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              {t.welcomeSub}
            </p>
          </div>

          <div className="w-full rounded-[24px] spatial-card p-4.5 text-left space-y-2 text-xs text-[var(--ink-muted)]">
            <p className="font-bold text-[var(--ink)]">Ready for live shop operations:</p>
            <p>· Hybrid Hinglish &amp; Hindi voice entries + multi-item spoken bills</p>
            <p>· AI Parchi scanner from handwritten paper slips</p>
            <p>· Live Cash Drawer (Galla), UPI recovery &amp; Munim audit trail</p>
          </div>
        </div>

        <div className="w-full pt-4 pb-safe">
          <button
            type="button"
            onClick={onWelcomeDone}
            className="w-full min-h-[52px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 text-[var(--brand-fg)] text-base font-bold transition tactile-key-primary"
          >
            {t.startBtn}
          </button>
        </div>
      </div>
    );
  }

  // 6. SETUP REAL BUSINESS PROFILE
  return (
    <div className="max-w-[430px] mx-auto min-h-dvh relative overflow-x-hidden shadow-2xl flex flex-col spatial-shell-bg px-5 py-6">
      <div className="w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-6">
          <button
            type="button"
            onClick={() => onStepChange('welcome')}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-bold text-[var(--ink)] active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t.setupBusiness}</span>
          </button>
        </div>

        <div className="rounded-[28px] spatial-hero p-6 space-y-5 my-auto stagger-fade-up">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
              {t.businessPrompt}
            </h1>
            <p className="text-sm text-[var(--ink-muted)]">
              {t.businessSub}
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[var(--brand-accent)] mb-1">
                Shop / Business Name *
              </label>
              <input
                type="text"
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                placeholder="e.g. Sharma Kirana & General Store"
                className="w-full min-h-[50px] rounded-xl bg-[var(--surface-subtle)] ring-2 ring-[var(--brand)] px-3.5 text-base font-bold text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Business Category
              </label>
              <select
                value={shopCategoryInput}
                onChange={(e) => setShopCategoryInput(e.target.value)}
                className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              >
                {SHOP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Shop UPI ID (Optional — for Vasooli QR)
              </label>
              <input
                type="text"
                value={shopUpiInput}
                onChange={(e) => setShopUpiInput(e.target.value)}
                placeholder="e.g. sharmakirana@okicici"
                className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)] placeholder:text-[var(--ink-muted)]/50"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={authBusy || !shopNameInput.trim()}
            onClick={() =>
              onCreateBusiness({
                name: shopNameInput.trim() || 'My Shop',
                category: shopCategoryInput,
                upiId: shopUpiInput.trim(),
              })
            }
            className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-[var(--brand-fg)] font-extrabold text-base tactile-key-primary active:scale-95 transition"
          >
            {authBusy ? 'Creating Shop...' : 'Open My Ucred Cockpit'}
          </button>
        </div>
      </div>
    </div>
  );
};
