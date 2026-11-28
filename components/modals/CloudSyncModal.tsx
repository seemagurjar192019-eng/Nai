'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CloudUpload,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useBackStack } from '@/hooks/useBackStack';
import { haptics } from '@/utils/haptics';
import { APPLE_EASE, SPATIAL_SPRING } from '../motion/SpatialMotionEngine';

export interface CloudSyncModalProps {
  open: boolean;
  onClose: () => void;
  authBusy: boolean;
  authError: string;
  syncSuccessMsg: string;
  hasGuestRecords: boolean;
  activeAccountsCount: number;
  activeTransactionsCount: number;
  activeBillsCount: number;
  syncEmailInput: string;
  onChangeSyncEmailInput: (val: string) => void;
  emailLinkSentTo: string;
  onGoogleSignIn: () => void;
  onSendEmailLink: (email: string) => void;
  emailConfirmPrompt: boolean;
  onCloseEmailConfirm: () => void;
  emailConfirmInput: string;
  onChangeEmailConfirmInput: (val: string) => void;
  onConfirmCrossBrowserEmailLink: () => void;
  onOpenLegal?: (tab?: 'terms' | 'privacy') => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  open,
  onClose,
  authBusy,
  authError,
  syncSuccessMsg,
  hasGuestRecords,
  activeAccountsCount,
  activeTransactionsCount,
  activeBillsCount,
  syncEmailInput,
  onChangeSyncEmailInput,
  emailLinkSentTo,
  onGoogleSignIn,
  onSendEmailLink,
  emailConfirmPrompt,
  onCloseEmailConfirm,
  emailConfirmInput,
  onChangeEmailConfirmInput,
  onConfirmCrossBrowserEmailLink,
  onOpenLegal,
}) => {
  useBackStack(open && !authBusy, onClose);
  useBackStack(emailConfirmPrompt && !authBusy, onCloseEmailConfirm);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termError, setTermError] = useState('');

  const handleAttemptGoogle = () => {
    if (!agreedToTerms) {
      setTermError('Please agree to Terms of Service & Privacy Policy to continue.');
      haptics.tap();
      return;
    }
    setTermError('');
    onGoogleSignIn();
  };

  const handleAttemptEmailLink = (email: string) => {
    if (!agreedToTerms) {
      setTermError('Please agree to Terms of Service & Privacy Policy to continue.');
      haptics.tap();
      return;
    }
    setTermError('');
    onSendEmailLink(email);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cloud Backup and Sign-In"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: APPLE_EASE } }}
            onClick={() => {
              if (!authBusy) onClose();
            }}
            className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPATIAL_SPRING}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 && !authBusy) onClose();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[28px] bg-[var(--surface)] border-t border-[var(--glass-border)] shadow-2xl p-6 space-y-4 pb-safe max-h-[92dvh] overflow-y-auto no-scrollbar"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ background: 'var(--munim-gradient)' }}
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-inner shrink-0"
                  >
                    <CloudUpload className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                      Google &amp; Gmail Sign-In
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] font-semibold">
                      Secure Cloud Backup &amp; Cross-Device Sync
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onClose}
                  aria-label="Close sign-in sheet"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {hasGuestRecords && !syncSuccessMsg && (
                <div className="rounded-2xl bg-[var(--brand-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--brand-accent)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {activeAccountsCount} parties, {activeTransactionsCount} entries &amp;{' '}
                    {activeBillsCount} bills ready to sync safely.
                  </span>
                </div>
              )}

              {syncSuccessMsg ? (
                <div className="rounded-2xl bg-[var(--debit-tint)] p-4 text-center space-y-2">
                  <Check className="w-7 h-7 mx-auto text-[var(--debit-green)]" />
                  <p className="text-sm font-extrabold text-[var(--debit-green)]">
                    {syncSuccessMsg}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Terms & Conditions Agreement Checkbox (Mandatory before sign-in) */}
                  <div className="rounded-2xl bg-[var(--surface-subtle)] p-3.5 border border-[var(--glass-border)]">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="pt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => {
                            haptics.tap();
                            setAgreedToTerms(e.target.checked);
                            if (e.target.checked) setTermError('');
                          }}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            agreedToTerms
                              ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]'
                              : 'border-[var(--ink-muted)]/40 bg-[var(--app-bg)]'
                          }`}
                        >
                          {agreedToTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--ink)] leading-snug select-text">
                        I agree to Ucred&rsquo;s{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpenLegal?.('terms');
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
                            onOpenLegal?.('privacy');
                          }}
                          className="font-bold underline text-[var(--brand-accent)] hover:opacity-80"
                        >
                          Privacy Policy
                        </button>
                        .
                      </div>
                    </label>
                  </div>

                  {termError && (
                    <p role="alert" className="text-xs font-bold text-[var(--credit-red)] px-1">
                      {termError}
                    </p>
                  )}

                  {/* Google One-Tap / Popup Sign In */}
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      haptics.tap();
                      handleAttemptGoogle();
                    }}
                    className="tactile-key-primary w-full min-h-[52px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-sm flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition shadow-md"
                  >
                    <span className="w-5 h-5 rounded-full bg-white text-[#4F46E5] font-black text-xs flex items-center justify-center shadow-xs">
                      G
                    </span>
                    <span>{authBusy ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                    <span className="flex-shrink mx-3 text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
                      Or Gmail OTP Link
                    </span>
                    <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                  </div>

                  {/* Gmail OTP / Email Verification Link */}
                  <div className="rounded-2xl bg-[var(--app-bg)] p-3.5 space-y-2.5 border border-[var(--glass-border)]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                      <span className="text-xs font-extrabold text-[var(--ink)]">
                        Sign in with Email Verification Link
                      </span>
                    </div>

                    {emailLinkSentTo ? (
                      <p className="rounded-xl bg-[var(--debit-tint)] p-3 text-xs font-bold text-[var(--debit-green)] leading-relaxed">
                        Verification link sent to <span className="underline">{emailLinkSentTo}</span>.
                        Open that email on this browser to sign in instantly!
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={syncEmailInput}
                          onChange={(e) => onChangeSyncEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !authBusy) {
                              handleAttemptEmailLink(syncEmailInput);
                            }
                          }}
                          placeholder="your-email@gmail.com"
                          className="flex-1 min-h-[46px] rounded-xl bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--ink)] outline-none ring-1 ring-[var(--glass-border)] focus:ring-2 focus:ring-[var(--brand)]"
                        />
                        <button
                          type="button"
                          disabled={authBusy}
                          onClick={() => {
                            haptics.tap();
                            handleAttemptEmailLink(syncEmailInput);
                          }}
                          className="min-h-[46px] px-4 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs font-extrabold text-[var(--ink)] hover:bg-[var(--brand-tint)] disabled:opacity-60 active:scale-95 transition"
                        >
                          Send Link
                        </button>
                      </div>
                    )}
                  </div>

                  {authError && (
                    <p
                      role="alert"
                      className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)] leading-relaxed"
                    >
                      {authError}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {emailConfirmPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Email Address"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-[var(--surface)] border border-[var(--glass-border)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                Confirm Your Email
              </h3>
              <button
                type="button"
                onClick={onCloseEmailConfirm}
                aria-label="Cancel email confirmation"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Enter the email address you used to request your sign-in link to complete cloud backup
              sync.
            </p>
            <input
              type="email"
              value={emailConfirmInput}
              onChange={(e) => onChangeEmailConfirmInput(e.target.value)}
              placeholder="your-email@gmail.com"
              className="w-full min-h-[46px] rounded-xl bg-[var(--app-bg)] px-3.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
            {authError && <p className="text-xs font-bold text-[var(--credit-red)]">{authError}</p>}
            <button
              type="button"
              disabled={authBusy}
              onClick={onConfirmCrossBrowserEmailLink}
              className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold disabled:opacity-60"
            >
              {authBusy ? 'Verifying...' : 'Complete Sign-In'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
