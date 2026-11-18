'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronDown,
  Heart,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Smartphone,
  Store,
  UserCheck,
  Volume2,
} from 'lucide-react';
import { LANGUAGE_OPTIONS, getUIStrings, speakHinglish } from '@/lib/i18n';
import type { AccentTheme, LanguageCode } from '@/lib/types';

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
  accentTheme: AccentTheme;
  mobileNumber: string;
  authError: string;
  authBusy: boolean;
  onSelectLanguage: (lang: LanguageCode) => void;
  onMobileChange: (phone: string) => void;
  onGoogleLogin: () => void;
  onWelcomeDone: () => void;
  onCreateBusiness: (shopName: string) => void;
  onSkipBusiness: () => void;
  onStepChange: (step: OnboardingStep) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  step,
  language,
  accentTheme,
  mobileNumber,
  authError,
  authBusy,
  onSelectLanguage,
  onMobileChange,
  onGoogleLogin,
  onWelcomeDone,
  onCreateBusiness,
  onSkipBusiness,
  onStepChange,
}) => {
  const t = getUIStrings(language);
  const [agreed, setAgreed] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [shopNameInput, setShopNameInput] = useState('');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Welcome Audio Guide simulation synced with SpeechSynthesis
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleWelcomeAudio = () => {
    if (audioPlaying) {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setAudioPlaying(false);
      return;
    }

    setAudioPlaying(true);
    speakHinglish(
      'BolBahi mein aapka swagat hai. Agar aap ek dukandar hain aur aapka len-den udhaar mein hota hai, toh apni dukaan ka naam jod kar bol kar apna digital khata shuru karein.',
      language
    );
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    audioTimerRef.current = setInterval(() => {
      setAudioSeconds((prev) => {
        if (prev >= 34) {
          if (audioTimerRef.current) clearInterval(audioTimerRef.current);
          setAudioPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleContinueClick = () => {
    setLocalError('');
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      setLocalError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!agreed) {
      setLocalError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    onGoogleLogin();
  };

  // 1. SPLASH SCREEN (OkCredit video 00:02 - 00:05)
  if (step === 'splash') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-between bg-white dark:bg-slate-950 px-6 py-12 text-center">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="w-24 h-24 rounded-3xl bg-[var(--brand)] text-white flex items-center justify-center shadow-lg"
          >
            <BookOpenCheck className="w-12 h-12" />
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="space-y-1.5"
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t.appName}
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Voice-First Digital Khata · Built for Indian Businesses
            </p>
          </motion.div>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="grid grid-cols-3 gap-3 text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-[var(--brand)] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span>Secured</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-[var(--brand)] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </span>
              <span>Safe & Trusted</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-[var(--brand)] flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </span>
              <span>Private</span>
            </div>
          </div>

          <p className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <span>Made With</span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span>In India</span>
          </p>
        </div>
      </div>
    );
  }

  // 2. LANGUAGE SELECTION GRID (OkCredit video 00:06 - 00:07)
  if (step === 'language') {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 px-5 py-8">
        <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center">
                <BookOpenCheck className="w-5 h-5" />
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                BolBahi
              </span>
            </div>
            <Link
              href="/privacy"
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-[var(--brand)] underline underline-offset-4"
            >
              Privacy
            </Link>
          </div>

          <h1 className="text-2xl font-extrabold text-center text-slate-900 dark:text-white">
            {t.selectLanguage}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const selected = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onSelectLanguage(opt.code)}
                  className={`relative text-left rounded-2xl p-4 min-h-[84px] flex flex-col justify-center transition border-2 ${
                    selected
                      ? 'bg-[var(--brand-tint)] border-[var(--brand)] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`text-xl font-bold leading-snug ${
                      selected
                        ? 'text-[var(--brand)]'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {opt.nativeName}
                  </span>
                  {opt.englishName !== opt.nativeName && (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                      {opt.englishName}
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={() => onStepChange('login')}
              className="w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-base font-bold shadow-sm transition"
            >
              Continue ({LANGUAGE_OPTIONS.find((o) => o.code === language)?.nativeName || 'English'})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. MOBILE NUMBER + FREE REAL GOOGLE AUTH SYNC (OkCredit video 00:08 - 00:16)
  if (step === 'login') {
    const currentLangObj =
      LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 px-5 py-6">
        <div className="w-full max-w-lg mx-auto flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 pb-8">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center">
                <BookOpenCheck className="w-5 h-5" />
              </span>
              <span className="text-xl font-extrabold text-[var(--brand)]">
                BolBahi
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <span>{currentLangObj.nativeName}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-1.5 z-30">
                  {LANGUAGE_OPTIONS.slice(0, 6).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        onSelectLanguage(opt.code);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between ${
                        language === opt.code
                          ? 'bg-[var(--brand-tint)] text-[var(--brand)] font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.nativeName}</span>
                      {language === opt.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setLangMenuOpen(false);
                      onStepChange('language');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[var(--brand)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    More Languages...
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-6 my-auto pb-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {t.enterMobileTitle}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Used on your shop receipts, business card & WhatsApp reminders. Synced free via Google Account.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="ob-mobile"
                className="block text-xs font-bold uppercase tracking-wider text-[var(--brand)]"
              >
                {t.mobileLabel}
              </label>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-[var(--brand)] bg-white dark:bg-slate-900 px-3.5 min-h-[56px]">
                <Smartphone className="w-5 h-5 text-[var(--brand)] shrink-0" />
                <span className="font-tabular font-bold text-slate-500 dark:text-slate-400">
                  +91
                </span>
                <input
                  id="ob-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="7000758749"
                  className="w-full bg-transparent text-xl font-bold font-tabular text-slate-900 dark:text-white outline-none placeholder:text-slate-300"
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
              <label htmlFor="ob-agree" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.agreePrefix}{' '}
                <button
                  type="button"
                  onClick={() => setShowLegalModal('terms')}
                  className="font-semibold text-[var(--brand)] underline underline-offset-2"
                >
                  Terms
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setShowLegalModal('privacy')}
                  className="font-semibold text-[var(--brand)] underline underline-offset-2"
                >
                  Privacy Policy
                </button>
                .
              </label>
            </div>

            {(localError || authError) && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300"
              >
                {localError || authError}
              </div>
            )}

            <button
              type="button"
              disabled={authBusy}
              onClick={handleContinueClick}
              className="w-full min-h-[56px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-white text-base font-bold shadow-sm transition flex items-center justify-center gap-2"
            >
              {authBusy ? 'Verifying with Google...' : t.continueGoogle}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
              <span>Theme: {accentTheme === 'green' ? 'OkCredit Green' : 'BolBahi Crimson'}</span>
              <div className="flex items-center gap-3">
                <Link href="/terms" className="font-semibold text-[var(--brand)] hover:underline">
                  Terms
                </Link>
                <Link href="/privacy" className="font-semibold text-[var(--brand)] hover:underline">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>

        {showLegalModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {showLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy & Security'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {showLegalModal === 'terms'
                  ? 'BolBahi stores your shop ledger, customer accounts, bills, and stock privately under your authenticated account. WhatsApp & SMS reminders are initiated directly from your device.'
                  : 'Your khata records are encrypted in transit and scoped strictly to your signed-in account in Cloud Firestore, with local offline caching on your device. No third-party ad tracking is used.'}
              </p>
              <button
                type="button"
                onClick={() => setShowLegalModal(null)}
                className="w-full min-h-[44px] rounded-xl bg-[var(--brand)] text-white font-bold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. VERIFICATION SUCCESSFUL (OkCredit video 00:17 - 00:18)
  if (step === 'verified') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="w-24 h-24 rounded-full border-4 border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center"
        >
          <Check className="w-12 h-12 stroke-[3]" />
        </motion.div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {t.verificationSuccess}
        </h1>
      </div>
    );
  }

  // 5. WELCOME AUDIO INTRO (OkCredit video 00:19 - 00:26)
  if (step === 'welcome') {
    const mmss = `00:${String(audioSeconds).padStart(2, '0')}`;
    return (
      <div className="min-h-screen flex flex-col justify-between bg-white dark:bg-slate-950 px-6 py-10">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="w-40 h-40 rounded-full bg-sky-50 dark:bg-slate-900 border border-sky-100 dark:border-slate-800 flex flex-col items-center justify-center gap-2 shadow-inner">
            <Store className="w-16 h-16 text-[var(--brand)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand)]">
              Digital Khata
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t.welcomeFamily}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.welcomeSub}
            </p>
          </div>

          <div className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleWelcomeAudio}
              aria-label={audioPlaying ? 'Pause audio intro' : 'Play audio intro'}
              className="w-11 h-11 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--brand-hover)] transition"
            >
              {audioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1 space-y-1">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-[var(--brand)] transition-all"
                  style={{ width: `${Math.min(100, (audioSeconds / 34) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-tabular font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" />
                  Hinglish Guide
                </span>
                <span>{mmss} / 00:34</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onWelcomeDone();
            }}
            className="w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-base font-bold transition shadow-sm"
          >
            {t.startBtn}
          </button>
        </div>
      </div>
    );
  }

  // 6. SETUP BUSINESS NAME (OkCredit video 00:27 - 00:29)
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 px-5 py-6">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="flex items-center justify-between pb-10">
          <button
            type="button"
            onClick={() => onStepChange('welcome')}
            className="inline-flex items-center gap-2 min-h-[44px] text-sm font-bold text-slate-800 dark:text-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t.setupBusiness}</span>
          </button>

          <button
            type="button"
            onClick={onSkipBusiness}
            disabled={authBusy}
            className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-[var(--brand)] hover:bg-[var(--brand-tint)] transition"
          >
            {t.skip}
          </button>
        </div>

        <div className="space-y-6 my-auto pb-16">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
            <Store className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t.businessPrompt}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.businessSub}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-2xl border-2 border-[var(--brand)] bg-white dark:bg-slate-900 px-3.5 min-h-[56px]">
              <Store className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <input
                type="text"
                value={shopNameInput}
                onChange={(e) => setShopNameInput(e.target.value)}
                placeholder="Sharma Kirana Store"
                className="w-full bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              disabled={authBusy}
              onClick={() => onCreateBusiness(shopNameInput.trim() || 'My Shop')}
              aria-label="Save business name"
              className="w-14 h-14 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white flex items-center justify-center shrink-0 shadow-sm transition"
            >
              <Check className="w-6 h-6 stroke-[2.8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
