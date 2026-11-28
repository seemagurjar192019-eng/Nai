'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  KeyRound,
  Package,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useBackStack } from '@/hooks/useBackStack';
import { buildDailyMunimScript, formatINR, getAvatarColor, speakHinglish, stopSpeaking } from '@/lib/i18n';
import type { Business, LanguageCode } from '@/lib/types';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from '../motion/DetentSheetOverlay';
import { SPATIAL_SPRING } from '../motion/SpatialMotionEngine';

export interface SecondaryModalsProps {
  // Business Switcher
  bizSwitcherOpen: boolean;
  onCloseBizSwitcher: () => void;
  activeBusinesses: Business[];
  currentBusiness: Business;
  onSwitchBusiness: (id: string) => void;
  newBizName: string;
  onChangeNewBizName: (val: string) => void;
  creatingBiz: boolean;
  onCreateExtraBusiness: () => void;
  focusBadge: string;
  onOpenBusinessModes: () => void;

  // Daily Munim Summary
  dailySummaryOpen: boolean;
  onCloseDailySummary: () => void;
  dailyStats: {
    todayKey: string;
    givenToday: number;
    receivedToday: number;
    overdueCount: number;
    lowStockCount: number;
  };
  cashDrawerBalance: number;
  language: LanguageCode;
  onNavigateCollection: () => void;
  onNavigateStock: () => void;

  // OTP Re-Verification Modal
  reauthOtpTarget: 'delete-account' | 'forgot-pin' | null;
  onCloseReauthOtp: () => void;
  reauthBusy: boolean;
  reauthOtpSent: boolean;
  phoneNumberDisplay: string;
  reauthOtpCode: string;
  onChangeReauthOtpCode: (val: string) => void;
  reauthError: string;
  onResendOtpReauth: (target: 'delete-account' | 'forgot-pin') => void;
  onConfirmOtpReauth: () => void;

  // Cloud Vault PIN Unlock
  cloudVaultUnlockOpen: boolean;
  vaultUnlockBusy: boolean;
  onCloseCloudVaultUnlock: () => void;
  vaultUnlockPin: string;
  onChangeVaultUnlockPin: (val: string) => void;
  vaultUnlockError: string;
  onUseGuestMode: () => void;
  onUnlockCloudVault: () => void;
}

export const SecondaryModals: React.FC<SecondaryModalsProps> = ({
  bizSwitcherOpen,
  onCloseBizSwitcher,
  activeBusinesses,
  currentBusiness,
  onSwitchBusiness,
  newBizName,
  onChangeNewBizName,
  creatingBiz,
  onCreateExtraBusiness,
  focusBadge,
  onOpenBusinessModes,
  dailySummaryOpen,
  onCloseDailySummary,
  dailyStats,
  cashDrawerBalance,
  language,
  onNavigateCollection,
  onNavigateStock,
  reauthOtpTarget,
  onCloseReauthOtp,
  reauthBusy,
  reauthOtpSent,
  phoneNumberDisplay,
  reauthOtpCode,
  onChangeReauthOtpCode,
  reauthError,
  onResendOtpReauth,
  onConfirmOtpReauth,
  cloudVaultUnlockOpen,
  vaultUnlockBusy,
  onCloseCloudVaultUnlock,
  vaultUnlockPin,
  onChangeVaultUnlockPin,
  vaultUnlockError,
  onUseGuestMode,
  onUnlockCloudVault,
}) => {
  useBackStack(bizSwitcherOpen, onCloseBizSwitcher);
  useBackStack(dailySummaryOpen, onCloseDailySummary);
  useBackStack(Boolean(reauthOtpTarget) && !reauthBusy, onCloseReauthOtp);
  useBackStack(cloudVaultUnlockOpen && !vaultUnlockBusy, onCloseCloudVaultUnlock);

  const summaryScript = buildDailyMunimScript({
    givenToday: dailyStats.givenToday,
    receivedToday: dailyStats.receivedToday,
    overdueCount: dailyStats.overdueCount,
    lowStockCount: dailyStats.lowStockCount,
    shopName: currentBusiness.name,
    language,
  });

  return (
    <>
      {/* Business Switcher Bottom Sheet */}
      <AnimatePresence>
        {bizSwitcherOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseBizSwitcher}
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
                if (info.offset.y > 90) onCloseBizSwitcher();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[28px] bg-[var(--surface)] border-t border-[var(--glass-border)] shadow-2xl p-6 space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold">Switch Business</h3>
                <button
                  type="button"
                  onClick={onCloseBizSwitcher}
                  aria-label="Close switcher"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                {activeBusinesses.map((biz) => {
                  const active = biz.id === currentBusiness.id;
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => onSwitchBusiness(biz.id)}
                      className={`w-full min-h-[54px] px-4 rounded-[20px] flex items-center justify-between gap-3 active:scale-95 transition ${
                        active
                          ? 'bg-[var(--brand-tint)] ring-1 ring-[var(--brand-accent)]'
                          : 'bg-[var(--app-bg)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{ backgroundColor: getAvatarColor(biz.name) }}
                          className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center shrink-0"
                        >
                          {biz.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm truncate">{biz.name}</span>
                      </div>
                      {active && <Check className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold uppercase text-[var(--ink-muted)]">
                  Create New Business
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBizName}
                    onChange={(e) => onChangeNewBizName(e.target.value)}
                    placeholder="e.g. Sharma Wholesale"
                    className="flex-1 min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                  <button
                    type="button"
                    disabled={creatingBiz || !newBizName.trim()}
                    onClick={onCreateExtraBusiness}
                    className="min-h-[46px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onOpenBusinessModes();
                  }}
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Change Business Mode ({focusBadge})</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Business Audio Summary Modal */}
      <AnimatePresence>
        {dailySummaryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseDailySummary}
            className="no-print fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
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
                if (info.offset.y > 90) onCloseDailySummary();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[28px] bg-[var(--surface)] border-t border-[var(--glass-border)] shadow-2xl p-6 space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ background: 'var(--munim-gradient)' }}
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-inner"
                  >
                    <Volume2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">
                      Today&apos;s Business Summary
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] font-semibold">
                      {currentBusiness.name} · {dailyStats.todayKey}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseDailySummary}
                  aria-label="Close Daily Summary"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[20px] bg-[var(--credit-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">
                    Given Today
                  </p>
                  <p className="text-base font-extrabold text-[var(--credit-red)] font-tabular mt-0.5">
                    {formatINR(dailyStats.givenToday)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--debit-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">
                    Collected
                  </p>
                  <p className="text-base font-extrabold text-[var(--debit-green)] font-tabular mt-0.5">
                    {formatINR(dailyStats.receivedToday)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--brand-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">
                    Cash Drawer
                  </p>
                  <p className="text-base font-extrabold text-[var(--brand-accent)] font-tabular mt-0.5">
                    {formatINR(cashDrawerBalance)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--brand-tint)] p-3.5 text-xs font-semibold text-[var(--ink)] leading-relaxed">
                {summaryScript}
              </div>

              {(dailyStats.overdueCount > 0 || dailyStats.lowStockCount > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {dailyStats.overdueCount > 0 && (
                    <button
                      type="button"
                      onClick={onNavigateCollection}
                      className="min-h-[44px] rounded-xl bg-[var(--credit-tint)] px-3 text-xs font-extrabold text-[var(--credit-red)] flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{dailyStats.overdueCount} Overdue</span>
                    </button>
                  )}
                  {dailyStats.lowStockCount > 0 && (
                    <button
                      type="button"
                      onClick={onNavigateStock}
                      className="min-h-[44px] rounded-xl bg-[var(--alert-tint)] px-3 text-xs font-extrabold text-[var(--alert-amber)] flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>{dailyStats.lowStockCount} Low Stock</span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => speakHinglish(summaryScript, language)}
                  className="min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Replay Audio</span>
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="min-h-[48px] rounded-xl bg-[var(--surface-subtle)] text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Stop Voice</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OTP Re-Verification Modal for Sensitive Actions */}
      {reauthOtpTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile OTP Verification"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-[var(--surface)] border border-[var(--glass-border)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </span>
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {reauthOtpTarget === 'forgot-pin'
                    ? 'Verify Mobile to Reset PIN'
                    : 'Verify Mobile to Delete Account'}
                </h3>
              </div>
              <button
                type="button"
                disabled={reauthBusy}
                onClick={onCloseReauthOtp}
                aria-label="Close OTP verification"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              {reauthOtpSent
                ? `Enter the 6-digit SMS OTP sent to ${phoneNumberDisplay}.`
                : `Sending SMS verification code to ${phoneNumberDisplay}...`}
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={reauthOtpCode}
              onChange={(e) => onChangeReauthOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="● ● ● ● ● ●"
              className="w-full min-h-[52px] rounded-2xl bg-[var(--surface-subtle)] px-4 ring-2 ring-transparent focus:ring-[var(--brand-accent)] text-center text-xl font-extrabold font-tabular tracking-wider sm:tracking-[0.3em] outline-none transition whitespace-nowrap overflow-hidden text-ellipsis"
            />

            {reauthError && (
              <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
                {reauthError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={reauthBusy}
                onClick={() => onResendOtpReauth(reauthOtpTarget)}
                className="min-h-[46px] rounded-xl bg-[var(--surface-subtle)] text-[var(--ink)] text-xs font-bold active:scale-95 transition"
              >
                Resend OTP
              </button>
              <button
                type="button"
                disabled={reauthBusy || !reauthOtpSent || reauthOtpCode.length !== 6}
                onClick={onConfirmOtpReauth}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{reauthBusy ? 'Verifying...' : 'Confirm OTP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero-Knowledge Cloud Sync Vault PIN Unlock Sheet */}
      <DetentSheetOverlay
        open={cloudVaultUnlockOpen}
        onClose={() => {
          if (!vaultUnlockBusy) onCloseCloudVaultUnlock();
        }}
        title="Unlock Encrypted Cloud Vault"
        subtitle="AES-256-GCM Zero-Knowledge Sync"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4 pb-safe">
          <div className="rounded-2xl bg-[var(--brand-tint)] px-3.5 py-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[var(--brand-accent)] shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-[var(--ink)] leading-relaxed">
              Your cloud ledger is protected with a custom Vault Sync PIN. Enter it once to decrypt
              records cleanly on this device.
            </p>
          </div>
          <input
            type="password"
            value={vaultUnlockPin}
            onChange={(e) => onChangeVaultUnlockPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !vaultUnlockBusy) {
                onUnlockCloudVault();
              }
            }}
            placeholder="Enter Vault Sync PIN"
            className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-4 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          />
          {vaultUnlockError && (
            <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
              {vaultUnlockError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={vaultUnlockBusy}
              onClick={onUseGuestMode}
              className="min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)] active:scale-95 transition"
            >
              Use Guest Mode
            </button>
            <button
              type="button"
              disabled={vaultUnlockBusy || vaultUnlockPin.trim().length < 4}
              onClick={onUnlockCloudVault}
              className="min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold disabled:opacity-50 active:scale-95 transition"
            >
              {vaultUnlockBusy ? 'Decrypting...' : 'Unlock Vault'}
            </button>
          </div>
        </div>
      </DetentSheetOverlay>
    </>
  );
};
