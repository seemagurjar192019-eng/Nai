'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  CloudUpload,
  Copy,
  CreditCard,
  Download,
  EyeOff,
  FileSpreadsheet,
  Fingerprint,
  Laptop,
  Lock,
  LogOut,
  Moon,
  QrCode,
  Server,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Store,
  Sun,
  Timer,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildUpiUri,
  formatINR,
  isValidGstNumber,
  isValidIndianMobile,
  isValidUpiId,
  verifyStoredPin,
} from '@/lib/i18n';
import {
  getPinCooldownSeconds,
  recordPinFailure,
  resetPinGuard,
  type AutoLockSeconds,
} from '@/lib/security';
import type {
  AppNotificationItem,
  AppearanceMode,
  Business,
  LedgerAccount,
  LedgerTransaction,
} from '@/lib/types';
import {
  getHapticsEnabled,
  getSoundEnabled,
  haptics,
  setHapticsEnabled,
  setSoundEnabled,
} from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
import { PWAInstallButton } from './PwaControls';

export type SecondaryRoute =
  | 'settings'
  | 'business-profile'
  | 'account-summary'
  | 'multi-device'
  | 'help-support'
  | 'galla'
  | 'staff-audit';

export type MoreTarget =
  | SecondaryRoute
  | 'bills'
  | 'stock'
  | 'collection'
  | 'scan-parchi';

export type ThemeAccentId = 'sapphire' | 'rose' | 'onyx';

const SPRING_TACTILE = { type: 'spring' as const, stiffness: 460, damping: 28 };
const SEG_SPRING = { type: 'spring' as const, stiffness: 420, damping: 30 };

function InsetSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
      {children}
    </p>
  );
}

function SpringSwitch({
  checked,
}: {
  checked: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <span
      className={`w-[50px] h-[30px] rounded-full p-[3px] transition-colors flex items-center shrink-0 ${
        checked ? 'bg-[var(--debit-green)] justify-end' : 'bg-[var(--surface-subtle)] justify-start'
      }`}
    >
      <motion.span
        layout={!prefersReducedMotion}
        transition={SEG_SPRING}
        className="w-6 h-6 rounded-full bg-white shadow-sm"
      />
    </span>
  );
}

interface SettingsViewProps {
  appearance: AppearanceMode;
  accentTheme?: ThemeAccentId;
  mobileNumber: string;
  verifiedPhone: string;
  workspaceBadge?: string;
  business: Business;
  appLockPin: string;
  vaultMode?: 'auto' | 'pin';
  isGuestMode?: boolean;
  showBackButton?: boolean;
  autoLockSeconds?: AutoLockSeconds;
  privacyCurtainEnabled?: boolean;
  webAuthnSupported?: boolean;
  passkeyEnabled?: boolean;
  onOpenCloudSync?: () => void;
  onOpenWorkspaces?: () => void;
  onOpenBusinessProfile?: () => void;
  onBack?: () => void;
  onChangeAppearance: (mode: AppearanceMode) => Promise<void>;
  onSelectAccentTheme?: (theme: ThemeAccentId) => Promise<void> | void;
  onSaveMobile: (phone: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onSavePin: (pin: string) => Promise<void>;
  onChangeAutoLockSeconds?: (seconds: AutoLockSeconds) => void;
  onTogglePrivacyCurtain?: (enabled: boolean) => void;
  onTogglePasskey?: (enable: boolean) => Promise<boolean>;
  onGetRecoveryKey?: () => Promise<string>;
  onConfigureVaultMode?: (mode: 'auto' | 'pin', vaultPin?: string) => Promise<void>;
  onExportCsv: () => void;
  onExportJson: () => void;
  onRestoreJson: (file: File, options?: { mode?: 'merge' | 'replace' }) => Promise<void>;
  onClearAll: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appearance,
  accentTheme = 'sapphire',
  mobileNumber,
  verifiedPhone,
  workspaceBadge = 'Retail Store',
  business,
  appLockPin,
  vaultMode = 'auto',
  isGuestMode = false,
  showBackButton = true,
  autoLockSeconds = 0,
  privacyCurtainEnabled = false,
  webAuthnSupported = false,
  passkeyEnabled = false,
  onOpenCloudSync,
  onOpenWorkspaces,
  onOpenBusinessProfile,
  onBack,
  onChangeAppearance,
  onSelectAccentTheme,
  onSaveMobile,
  onSaveUpiId,
  onSavePin,
  onChangeAutoLockSeconds,
  onTogglePrivacyCurtain,
  onTogglePasskey,
  onGetRecoveryKey,
  onConfigureVaultMode,
  onExportCsv,
  onExportJson,
  onRestoreJson,
  onClearAll,
  onDeleteAccount,
  onLogout,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeSheet, setActiveSheet] = useState<
    | null
    | 'account'
    | 'security'
    | 'appearance'
    | 'sounds'
    | 'payments'
    | 'backup'
    | 'clear-data'
    | 'delete-account'
  >(null);

  const [phoneInput, setPhoneInput] = useState(mobileNumber);
  const [upiInput, setUpiInput] = useState(business.upiId || '');
  const [pinInput, setPinInput] = useState('');
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sheetError, setSheetError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [soundEnabled, setSoundState] = useState<boolean>(() => getSoundEnabled());
  const [hapticsEnabled, setHapticsState] = useState<boolean>(() => getHapticsEnabled());
  const [recoveryKeyValue, setRecoveryKeyValue] = useState('');
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const activeTheme: ThemeAccentId =
    appearance === 'dark' ? 'onyx' : accentTheme === 'rose' ? 'rose' : 'sapphire';

  const autoLockLabel =
    autoLockSeconds === 60
      ? '1m'
      : autoLockSeconds === 300
        ? '5m'
        : autoLockSeconds === 900
          ? '15m'
          : 'Off';

  const securityRightValue = appLockPin
    ? autoLockSeconds > 0
      ? `PIN · ${autoLockLabel}`
      : 'PIN On'
    : passkeyEnabled
      ? 'Passkey'
      : 'Off';

  const appearanceRightValue =
    appearance === 'dark'
      ? 'OLED Dark'
      : activeTheme === 'rose'
        ? 'Light · Rose'
        : 'Light · Sapphire';

  const soundsRightValue =
    soundEnabled && hapticsEnabled
      ? 'On'
      : !soundEnabled && !hapticsEnabled
        ? 'Off'
        : soundEnabled
          ? 'Sound'
          : 'Haptics';

  const flash = (msg: string) => {
    setErrorMsg('');
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const runSafely = async (
    actionKey: string,
    fn: () => Promise<void>,
    successMsg?: string,
    closeSheetOnSuccess = false
  ) => {
    setErrorMsg('');
    setSheetError('');
    setBusyAction(actionKey);
    try {
      await fn();
      if (successMsg) flash(successMsg);
      if (closeSheetOnSuccess) setActiveSheet(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed. Please try again.';
      if (activeSheet) setSheetError(msg);
      else setErrorMsg(msg);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="max-w-[560px] mx-auto space-y-5 pb-32">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        {showBackButton && onBack ? (
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onBack();
            }}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-2xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Settings</span>
          </button>
        ) : (
          <div className="px-1">
            <h1 className="font-display text-2xl font-extrabold text-[var(--ink)] tracking-tight">
              Settings
            </h1>
          </div>
        )}

        {statusMsg && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--debit-tint)] text-[var(--debit-green)]">
            {statusMsg}
          </span>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between gap-2"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Dismiss error"
            className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Compact Apple Account Card */}
      <section className="ios27-inset-group rounded-[26px] p-3.5">
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            if (isGuestMode && onOpenCloudSync) {
              onOpenCloudSync();
            } else {
              setSheetError('');
              setVaultPinInput('');
              setRecoveryKeyValue('');
              setRecoveryCopied(false);
              setActiveSheet('account');
            }
          }}
          className="w-full flex items-center justify-between gap-3 text-left active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[var(--brand)] text-white font-display font-extrabold text-base flex items-center justify-center shrink-0">
              {(business.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-extrabold text-[var(--ink)] truncate">
                {business.name}
              </p>
              <p className="text-xs font-semibold text-[var(--ink-muted)] truncate">
                {isGuestMode
                  ? 'Local Device Vault · Tap to Sync Cloud'
                  : `Cloud Account · ${verifiedPhone || 'Synced'}`}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-accent)] shrink-0">
            {isGuestMode ? <span>Sign In</span> : null}
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)]" />
          </span>
        </button>
      </section>

      {/* Group 1: Shop Profile */}
      <div>
        <InsetSectionLabel>Shop Profile</InsetSectionLabel>
        <section className="ios27-inset-group rounded-[24px] divide-y divide-[var(--surface-border)] overflow-hidden">
          {onOpenBusinessProfile && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenBusinessProfile();
              }}
              className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-[29px] h-[29px] rounded-[8px] bg-[#007AFF] text-white flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--ink)] truncate">
                  Shop Profile &amp; GSTIN
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0 max-w-[140px]">
                <span className="truncate">{business.gstNumber || 'Edit'}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setPhoneInput(mobileNumber);
              setUpiInput(business.upiId || '');
              setActiveSheet('payments');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#34C759] text-white flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                UPI QR &amp; Mobile
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0 max-w-[150px]">
              <span className="truncate">{business.upiId || mobileNumber || 'Off'}</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </span>
          </button>

          {onOpenWorkspaces && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenWorkspaces();
              }}
              className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-[29px] h-[29px] rounded-[8px] bg-[#5856D6] text-white flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--ink)] truncate">
                  Workspace Modes
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0">
                <span>{workspaceBadge}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </span>
            </button>
          )}
        </section>
      </div>

      {/* Group 2: Security & Privacy */}
      <div>
        <InsetSectionLabel>Security &amp; Privacy</InsetSectionLabel>
        <section className="ios27-inset-group rounded-[24px] divide-y divide-[var(--surface-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setPinInput('');
              setActiveSheet('security');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#1C1C1E] dark:bg-[#5856D6] text-white flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                Passcode &amp; Biometrics
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0">
              <span className={appLockPin ? 'text-[var(--debit-green)]' : ''}>
                {securityRightValue}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </span>
          </button>

          {onTogglePrivacyCurtain && (
            <button
              type="button"
              role="switch"
              aria-checked={privacyCurtainEnabled}
              onClick={() => {
                const next = !privacyCurtainEnabled;
                haptics.tap();
                onTogglePrivacyCurtain(next);
                flash(next ? 'Privacy Curtain on' : 'Privacy Curtain off');
              }}
              className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-[29px] h-[29px] rounded-[8px] bg-[#FF9500] text-white flex items-center justify-center shrink-0">
                  <EyeOff className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--ink)] truncate">
                  Privacy Curtain
                </span>
              </span>
              <SpringSwitch checked={privacyCurtainEnabled} />
            </button>
          )}
        </section>
      </div>

      {/* Group 3: Preferences */}
      <div>
        <InsetSectionLabel>Preferences</InsetSectionLabel>
        <section className="ios27-inset-group rounded-[24px] divide-y divide-[var(--surface-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setActiveSheet('appearance');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#5856D6] text-white flex items-center justify-center shrink-0">
                {appearance === 'dark' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">Appearance</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0">
              <span>{appearanceRightValue}</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setActiveSheet('sounds');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#FF2D55] text-white flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                Sounds &amp; Haptics
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] shrink-0">
              <span>{soundsRightValue}</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </span>
          </button>
        </section>
      </div>

      {/* Group 4: Backups & Data */}
      <div>
        <InsetSectionLabel>Data &amp; Backups</InsetSectionLabel>
        <section className="ios27-inset-group rounded-[24px] divide-y divide-[var(--surface-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onExportCsv();
              flash('CSV exported');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#34C759] text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                Export CSV Statement
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setActiveSheet('backup');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/50 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#007AFF] text-white flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                Backup &amp; Restore
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetError('');
              setActiveSheet('clear-data');
            }}
            className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--credit-tint)]/35 transition"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-[29px] h-[29px] rounded-[8px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--credit-red)] truncate">
                Reset Shop Data
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--credit-red)] shrink-0" />
          </button>

          {!isGuestMode && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setSheetError('');
                setActiveSheet('delete-account');
              }}
              className="w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--credit-tint)]/35 transition"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-[29px] h-[29px] rounded-[8px] bg-[#FF3B30] text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--credit-red)] truncate">
                  Delete Cloud Account
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--credit-red)] shrink-0" />
            </button>
          )}
        </section>
      </div>

      {/* Minimal Footer */}
      <footer className="px-2 pt-1 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[var(--ink-muted)]">
          <span className="font-bold text-[var(--ink)]">Ucred</span>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--ink)] transition">
            Terms
          </Link>
          <Link href="/delete-account" className="hover:text-[var(--ink)] transition">
            Account Deletion
          </Link>
          <a
            href="mailto:naitik.webstudio45@gmail.com"
            className="hover:text-[var(--ink)] transition"
          >
            Support
          </a>
        </div>
        <PWAInstallButton compact />
      </footer>

      {/* Sheet 1: Cloud Account & Recovery (Quietly holds Recovery Key + Sign Out) */}
      <DetentSheetOverlay
        open={activeSheet === 'account'}
        onClose={() => setActiveSheet(null)}
        title="Cloud Account"
        subtitle={verifiedPhone || business.name}
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          {onGetRecoveryKey && (
            <div className="rounded-2xl bg-[var(--app-bg)] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-[var(--ink)]">Offline Recovery Key</p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Save offline to restore your account on any device
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    haptics.tap();
                    const key = recoveryKeyValue || (await onGetRecoveryKey());
                    setRecoveryKeyValue(key);
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(key).catch(() => {});
                      setRecoveryCopied(true);
                      setTimeout(() => setRecoveryCopied(false), 2500);
                    }
                  }}
                  className="min-h-[36px] px-3 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 active:scale-95 transition"
                >
                  {recoveryCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{recoveryCopied ? 'Copied' : recoveryKeyValue ? 'Copy' : 'Reveal'}</span>
                </button>
              </div>
              {recoveryKeyValue && (
                <p className="rounded-xl bg-[var(--surface)] px-3 py-2 text-[11px] font-mono font-bold text-[var(--ink)] break-all select-all">
                  {recoveryKeyValue}
                </p>
              )}
            </div>
          )}

          {!isGuestMode && onConfigureVaultMode && (
            <div className="ios27-inset-group rounded-2xl divide-y divide-[var(--surface-border)] overflow-hidden">
              <button
                type="button"
                disabled={busyAction === 'e2ee'}
                onClick={() =>
                  void runSafely(
                    'e2ee',
                    () => onConfigureVaultMode('auto'),
                    'Auto sync across devices active',
                    true
                  )
                }
                className="w-full p-3.5 flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">Auto-Sync Across Devices</p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Instant unlock on signed-in devices
                  </p>
                </div>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    vaultMode === 'auto'
                      ? 'bg-[var(--brand)] text-white'
                      : 'border-2 border-[var(--surface-border)]'
                  }`}
                >
                  {vaultMode === 'auto' && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
              </button>

              <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--ink)]">Multi-Device Secret PIN</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">
                      Require secret PIN when logging in on new devices
                    </p>
                  </div>
                  {vaultMode === 'pin' && (
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={vaultPinInput}
                    onChange={(e) => setVaultPinInput(e.target.value)}
                    placeholder="Enter 4+ char PIN"
                    className="flex-1 min-h-[42px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                  <button
                    type="button"
                    disabled={busyAction === 'e2ee'}
                    onClick={() => {
                      if (vaultPinInput.trim().length < 4) {
                        setSheetError('Vault PIN must be at least 4 characters or digits.');
                        return;
                      }
                      void runSafely(
                        'e2ee',
                        async () => {
                          await onConfigureVaultMode('pin', vaultPinInput.trim());
                          setVaultPinInput('');
                        },
                        'Vault PIN enabled',
                        true
                      );
                    }}
                    className="min-h-[42px] px-4 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold disabled:opacity-60"
                  >
                    {busyAction === 'e2ee' ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}

          {!isGuestMode && (
            <button
              type="button"
              onClick={() =>
                void runSafely('logout', onLogout, 'Signed out to Guest Vault', true)
              }
              className="w-full min-h-[48px] rounded-2xl bg-[var(--credit-tint)] text-[var(--credit-red)] text-sm font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </DetentSheetOverlay>

      {/* Sheet 2: Unified Passcode, Auto-Lock & Biometrics */}
      <DetentSheetOverlay
        open={activeSheet === 'security'}
        onClose={() => setActiveSheet(null)}
        title="Passcode & Biometrics"
        subtitle={appLockPin ? 'Passcode Active' : 'Passcode Off'}
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--ink-muted)]">
              4-Digit App Passcode
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={appLockPin ? 'Enter new 4-digit PIN' : 'e.g. 1234'}
              className="w-full min-h-[50px] rounded-2xl bg-[var(--surface-subtle)] px-4 text-center text-base sm:text-2xl font-extrabold font-tabular tracking-wider sm:tracking-[0.3em] text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)] whitespace-nowrap overflow-hidden text-ellipsis"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyAction === 'pin'}
                onClick={() => {
                  if (pinInput.length !== 4) {
                    setSheetError('PIN must be exactly 4 digits.');
                    return;
                  }
                  void runSafely(
                    'pin',
                    async () => {
                      await onSavePin(pinInput);
                      setPinInput('');
                    },
                    '4-Digit PIN saved',
                    true
                  );
                }}
                className="flex-1 min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm tactile-key-primary disabled:opacity-60"
              >
                {busyAction === 'pin' ? 'Saving...' : appLockPin ? 'Update PIN' : 'Enable PIN'}
              </button>
              {appLockPin && (
                <button
                  type="button"
                  disabled={busyAction === 'pin'}
                  onClick={() =>
                    void runSafely(
                      'pin',
                      async () => {
                        await onSavePin('');
                        setPinInput('');
                      },
                      'App PIN disabled',
                      true
                    )
                  }
                  className="min-h-[46px] px-4 rounded-2xl bg-[var(--credit-tint)] text-[var(--credit-red)] font-extrabold text-xs"
                >
                  Turn Off
                </button>
              )}
            </div>
          </div>

          {onChangeAutoLockSeconds && (
            <div className="space-y-2 pt-2 border-t border-[var(--surface-border)]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
                  <Timer className="w-3.5 h-3.5 text-[var(--brand-accent)]" />
                  <span>Idle Auto-Lock</span>
                </span>
                <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
                  {appLockPin ? autoLockLabel : 'Requires PIN'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[var(--surface-subtle)] p-1">
                {(
                  [
                    { sec: 0, label: 'Off' },
                    { sec: 60, label: '1m' },
                    { sec: 300, label: '5m' },
                    { sec: 900, label: '15m' },
                  ] as const
                ).map((opt) => {
                  const selected = autoLockSeconds === opt.sec;
                  return (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        onChangeAutoLockSeconds(opt.sec);
                        flash(opt.sec === 0 ? 'Auto-lock off' : `Auto-lock ${opt.label}`);
                      }}
                      className={`min-h-[36px] rounded-xl text-xs font-extrabold transition ${
                        selected
                          ? 'bg-[var(--surface)] text-[var(--brand-accent)] shadow-xs'
                          : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {webAuthnSupported && onTogglePasskey && (
            <button
              type="button"
              role="switch"
              aria-checked={passkeyEnabled}
              disabled={busyAction === 'passkey'}
              onClick={() =>
                void runSafely(
                  'passkey',
                  async () => {
                    await onTogglePasskey(!passkeyEnabled);
                  },
                  passkeyEnabled ? 'Biometric Passkey removed' : 'Biometric Passkey enabled'
                )
              }
              className="w-full pt-3 border-t border-[var(--surface-border)] flex items-center justify-between gap-3 text-left disabled:opacity-60"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Fingerprint className="w-4 h-4 text-[var(--debit-green)] shrink-0" />
                <span className="text-sm font-bold text-[var(--ink)]">
                  Face ID / Touch ID Passkey
                </span>
              </span>
              <SpringSwitch checked={passkeyEnabled} />
            </button>
          )}

          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}
        </div>
      </DetentSheetOverlay>

      {/* Sheet 3: Appearance */}
      <DetentSheetOverlay
        open={activeSheet === 'appearance'}
        onClose={() => setActiveSheet(null)}
        title="Appearance"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <div className="relative grid grid-cols-2 rounded-2xl bg-[var(--surface-subtle)] p-1">
            {(
              [
                { id: 'light', label: 'Light Canvas', icon: Sun },
                { id: 'dark', label: 'OLED Dark', icon: Moon },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              const active = appearance === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={async () => {
                    haptics.tap();
                    await onChangeAppearance(m.id);
                    flash(`${m.label} active`);
                  }}
                  className={`relative min-h-[44px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 z-10 transition-colors ${
                    active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'settingsAppearanceSeg'}
                      transition={SEG_SPRING}
                      className="absolute inset-0 rounded-xl bg-[var(--surface)] shadow-xs"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{m.label}</span>
                </button>
              );
            })}
          </div>

          {onSelectAccentTheme && (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'sapphire', label: 'Sapphire', dot: 'bg-[#4F46E5]' },
                  { id: 'rose', label: 'Rose', dot: 'bg-[#E11D48]' },
                  { id: 'onyx', label: 'Onyx', dot: 'bg-[#09090B] ring-1 ring-white/40' },
                ] as const
              ).map((opt) => {
                const selected = activeTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      void onSelectAccentTheme(opt.id);
                    }}
                    className={`min-h-[44px] px-3 rounded-xl flex items-center justify-between text-xs font-bold active:scale-95 transition ${
                      selected
                        ? 'bg-[var(--brand-tint)] ring-1 ring-[var(--brand)] text-[var(--brand-accent)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full ${opt.dot}`} />
                      <span>{opt.label}</span>
                    </span>
                    {selected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DetentSheetOverlay>

      {/* Sheet 4: Sounds & Haptics */}
      <DetentSheetOverlay
        open={activeSheet === 'sounds'}
        onClose={() => setActiveSheet(null)}
        title="Sounds & Haptics"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="ios27-inset-group rounded-2xl divide-y divide-[var(--surface-border)] overflow-hidden">
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              setSoundState(next);
              if (next) haptics.tap();
            }}
            className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <Volume2 className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
              <span className="text-sm font-bold text-[var(--ink)]">Tactile Click Sounds</span>
            </span>
            <SpringSwitch checked={soundEnabled} />
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={hapticsEnabled}
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              setHapticsState(next);
              if (next) haptics.tap();
            }}
            className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <Smartphone className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
              <span className="text-sm font-bold text-[var(--ink)]">Haptic Feedback</span>
            </span>
            <SpringSwitch checked={hapticsEnabled} />
          </button>
        </div>
      </DetentSheetOverlay>

      {/* Sheet 5: Backup & Restore */}
      <DetentSheetOverlay
        open={activeSheet === 'backup'}
        onClose={() => setActiveSheet(null)}
        title="Backup & Restore"
        subtitle={business.name}
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onExportJson();
              flash('JSON backup downloaded');
              setActiveSheet(null);
            }}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm inline-flex items-center justify-center gap-2 tactile-key-primary"
          >
            <Download className="w-4 h-4" />
            <span>Download JSON Backup</span>
          </button>

          <div className="pt-3 border-t border-[var(--surface-border)] space-y-2.5">
            <p className="text-xs font-bold text-[var(--ink-muted)]">Restore Mode</p>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--surface-subtle)] p-1">
              {(
                [
                  { id: 'merge', label: 'Merge with Current' },
                  { id: 'replace', label: 'Replace Shop Data' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setRestoreMode(m.id);
                  }}
                  className={`min-h-[38px] rounded-xl text-xs font-extrabold transition ${
                    restoreMode === m.id
                      ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={busyAction === 'restore'}
              onClick={() => restoreRef.current?.click()}
              className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] text-[var(--ink)] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              <span>
                {busyAction === 'restore' ? 'Restoring...' : 'Select Backup JSON File'}
              </span>
            </button>
            <input
              ref={restoreRef}
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                await runSafely(
                  'restore',
                  () => onRestoreJson(file, { mode: restoreMode }),
                  `Backup restored (${restoreMode})`,
                  true
                );
              }}
              className="hidden"
            />
          </div>
          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}
        </div>
      </DetentSheetOverlay>

      {/* Sheet 6: Shop Mobile & UPI QR */}
      <DetentSheetOverlay
        open={activeSheet === 'payments'}
        onClose={() => setActiveSheet(null)}
        title="Shop Mobile & UPI QR"
        subtitle="Used on reminder slips and GST bills"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--ink-muted)]">
              Shop Mobile Number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                maxLength={10}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="flex-1 min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
              <button
                type="button"
                disabled={busyAction === 'mobile'}
                onClick={() => {
                  if (phoneInput && !isValidIndianMobile(phoneInput)) {
                    setSheetError('Enter a valid 10-digit Indian mobile number.');
                    return;
                  }
                  void runSafely(
                    'mobile',
                    () => onSaveMobile(phoneInput),
                    'Mobile number updated'
                  );
                }}
                className="min-h-[46px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--ink-muted)]">
              Shop UPI ID (VPA)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
                placeholder="sharma@okicici"
                className="flex-1 min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
              <button
                type="button"
                disabled={busyAction === 'upi'}
                onClick={() => {
                  const clean = upiInput.trim();
                  if (!isValidUpiId(clean)) {
                    setSheetError('Invalid UPI ID format. Example: shopname@okicici');
                    return;
                  }
                  void runSafely('upi', () => onSaveUpiId(clean), 'UPI ID saved', true);
                }}
                className="min-h-[46px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Save UPI</span>
              </button>
            </div>
          </div>

          {business.upiId && (
            <div className="rounded-2xl bg-[var(--app-bg)] p-4 flex items-center gap-4">
              <div className="p-2 bg-white rounded-xl shrink-0">
                <QRCodeSVG value={buildUpiUri(business.upiId, business.name)} size={72} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--ink)] truncate">
                  {business.upiId}
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] leading-snug mt-0.5">
                  Included automatically on WhatsApp reminders &amp; bills.
                </p>
              </div>
            </div>
          )}

          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}
        </div>
      </DetentSheetOverlay>

      {/* Sheet 7: Confirm Reset Shop Data */}
      <DetentSheetOverlay
        open={activeSheet === 'clear-data'}
        onClose={() => setActiveSheet(null)}
        title="Reset Shop Data"
        subtitle={business.name}
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--credit-tint)] p-4 text-xs font-bold text-[var(--credit-red)] leading-relaxed">
            This will permanently erase all parties, transactions, bills, cashbook, staff logs, and
            inventory items for {business.name}. Download a JSON backup first.
          </div>
          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busyAction === 'clear'}
              onClick={() =>
                void runSafely('clear', onClearAll, 'All shop data cleared', true)
              }
              className="min-h-[48px] rounded-2xl bg-[var(--credit-red)] text-white text-xs font-extrabold disabled:opacity-60"
            >
              {busyAction === 'clear' ? 'Clearing...' : 'Yes, Reset'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSheet(null)}
              className="min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </DetentSheetOverlay>

      {/* Sheet 8: Confirm Delete Cloud Account */}
      <DetentSheetOverlay
        open={activeSheet === 'delete-account'}
        onClose={() => setActiveSheet(null)}
        title="Delete Cloud Account"
        subtitle="Permanent Action"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--credit-tint)] p-4 text-xs font-bold text-[var(--credit-red)] leading-relaxed">
            Permanently deletes ALL shops, vaults, ledger entries, and cloud account data. Export a
            JSON backup before proceeding.
          </div>
          {sheetError && <p className="text-xs font-bold text-[var(--credit-red)]">{sheetError}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busyAction === 'delete-account'}
              onClick={() => void runSafely('delete-account', onDeleteAccount, undefined, true)}
              className="min-h-[48px] rounded-2xl bg-[var(--credit-red)] text-white text-xs font-extrabold disabled:opacity-60"
            >
              {busyAction === 'delete-account' ? 'Deleting...' : 'Delete Forever'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSheet(null)}
              className="min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};

interface BusinessProfileViewProps {
  business: Business;
  canDeleteBusiness?: boolean;
  onBack: () => void;
  onSave: (patch: Partial<Business>) => Promise<void>;
  onDeleteBusiness?: () => Promise<void>;
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  business,
  canDeleteBusiness = false,
  onBack,
  onSave,
  onDeleteBusiness,
}) => {
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone);
  const [gstNumber, setGstNumber] = useState(business.gstNumber);
  const [businessType, setBusinessType] = useState(business.businessType);
  const [category, setCategory] = useState(business.category);
  const [address, setAddress] = useState(business.address);
  const [email, setEmail] = useState(business.email);
  const [about, setAbout] = useState(business.about);
  const [upiId, setUpiId] = useState(business.upiId);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteBiz, setConfirmDeleteBiz] = useState(false);
  const [deletingBiz, setDeletingBiz] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const handleSave = async () => {
    setFormError('');
    if (phone && !isValidIndianMobile(phone)) {
      setFormError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (gstNumber && !isValidGstNumber(gstNumber)) {
      setFormError('GSTIN must be 15 valid characters (e.g. 27AABCU9603R1ZM).');
      return;
    }
    if (upiId && !isValidUpiId(upiId)) {
      setFormError('Enter a valid UPI ID (e.g. shopname@okicici).');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || 'My Shop',
        phone: phone.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        businessType: businessType.trim(),
        category: category.trim(),
        address: address.trim(),
        email: email.trim(),
        about: about.trim(),
        upiId: upiId.trim(),
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-32">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-2xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCardModal(true)}
          className="min-h-[44px] px-3.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center gap-1.5 active:scale-95 transition"
        >
          <CreditCard className="w-4 h-4" />
          <span>Share Card</span>
        </button>
      </div>

      {/* Business Card Preview */}
      <div className="ios27-pass-indigo rounded-[28px] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center font-extrabold text-xl">
              {(name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold">{name || 'My Shop'}</h2>
              <p className="text-xs opacity-90">
                {category || 'General Store'} · {businessType || 'Retail'}
              </p>
            </div>
          </div>
          <Building2 className="w-7 h-7 opacity-80" />
        </div>
        <div className="text-xs space-y-1 opacity-95 pt-2">
          {phone && <p className="font-tabular">Mobile: +91 {phone}</p>}
          {gstNumber && <p className="font-tabular">GSTIN: {gstNumber}</p>}
          {address && <p>{address}</p>}
        </div>
      </div>

      {/* Profile Form */}
      <div className="ios27-inset-group rounded-[26px] p-5 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
              Business / Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
              GST Number
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-tabular uppercase text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="shopname@okicici"
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
              Business Type
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Retailer / Wholesaler"
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Kirana / Medical / Hardware"
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Shop Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Main Market Road, Near Bus Stand"
            className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">About Shop</label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Fresh groceries & daily essentials"
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>
        </div>

        {formError && <p className="text-xs font-bold text-[var(--credit-red)]">{formError}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm tactile-key-primary disabled:opacity-60 active:scale-95 transition"
        >
          {saving ? 'Saving Profile...' : savedToast ? 'Saved ✓' : 'Save Business Profile'}
        </button>

        {canDeleteBusiness && onDeleteBusiness && (
          <div className="pt-2">
            {!confirmDeleteBiz ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteBiz(true)}
                className="w-full min-h-[44px] rounded-xl bg-[var(--credit-tint)] text-xs font-bold text-[var(--credit-red)] active:scale-95 transition"
              >
                Delete This Business ({business.name})
              </button>
            ) : (
              <div className="rounded-2xl bg-[var(--credit-tint)] p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[var(--credit-red)] text-center">
                  Delete {business.name} and all its customers, bills &amp; stock?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={deletingBiz}
                    onClick={async () => {
                      setDeletingBiz(true);
                      try {
                        await onDeleteBusiness();
                      } catch (err) {
                        setFormError(
                          err instanceof Error ? err.message : 'Could not delete business.'
                        );
                        setDeletingBiz(false);
                      }
                    }}
                    className="min-h-[44px] rounded-xl bg-[var(--credit-red)] text-white text-xs font-bold shadow-sm"
                  >
                    {deletingBiz ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBiz(false)}
                    className="min-h-[44px] rounded-xl bg-[var(--surface)] text-xs font-bold text-[var(--ink)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <DetentSheetOverlay
        open={showCardModal}
        onClose={() => setShowCardModal(false)}
        title="Digital Visiting Card"
        subtitle={name || 'My Shop'}
        initialDetent="peek"
      >
        <div className="space-y-4 text-center">
          <div className="ios27-pass-indigo rounded-[24px] p-5 space-y-2 text-left">
            <p className="font-display text-xl font-extrabold">{name || 'My Shop'}</p>
            <p className="text-xs opacity-90">{about || category}</p>
            {phone && <p className="text-xs font-tabular">Tel: +91 {phone}</p>}
            {address && <p className="text-xs">{address}</p>}
          </div>
          {upiId && (
            <div className="mx-auto w-fit p-3.5 bg-white rounded-2xl shadow-md">
              <QRCodeSVG value={buildUpiUri(upiId, name)} size={140} />
            </div>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Visit ${name || 'My Shop'}${phone ? ` · Call +91 ${phone}` : ''}${
                address ? ` · ${address}` : ''
              }${upiId ? ` · Pay UPI: ${upiId}` : ''}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 text-[var(--brand-fg)] font-bold flex items-center justify-center gap-2 tactile-key-primary transition"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </a>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};

interface AccountSummaryViewProps {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  onBack: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export const AccountSummaryView: React.FC<AccountSummaryViewProps> = ({
  accounts,
  transactions,
  onBack,
  onExportJson,
  onExportCsv,
}) => {
  const customers = accounts.filter((a) => a.kind === 'customer');
  const suppliers = accounts.filter((a) => a.kind === 'supplier');
  const custDue = customers.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const custAdv = customers
    .filter((a) => a.balance < 0)
    .reduce((s, a) => s + Math.abs(a.balance), 0);
  const suppDue = suppliers.reduce((s, a) => s + Math.abs(a.balance), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-32">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-2xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Account Summary &amp; Backup</span>
      </button>

      <div className="ios27-inset-group rounded-[26px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
            Customer Khata
          </h2>
          <span className="text-xs font-bold text-[var(--ink-muted)] font-tabular">
            {customers.length} customers
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 font-tabular">
          <div className="rounded-2xl bg-[var(--debit-tint)] p-4 truncate">
            <p className="text-xs font-bold text-[var(--debit-green)]">You Get</p>
            <p className="text-base sm:text-xl font-extrabold text-[var(--debit-green)] mt-0.5 truncate">
              {formatINR(custDue)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--brand-tint)] p-4 truncate">
            <p className="text-xs font-bold text-[var(--brand-accent)]">Advance</p>
            <p className="text-base sm:text-xl font-extrabold text-[var(--brand-accent)] mt-0.5 truncate">
              {formatINR(custAdv)}
            </p>
          </div>
        </div>
      </div>

      <div className="ios27-inset-group rounded-[26px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
            Supplier Khata
          </h2>
          <span className="text-xs font-bold text-[var(--ink-muted)] font-tabular">
            {suppliers.length} suppliers
          </span>
        </div>
        <p className="text-base sm:text-2xl font-extrabold font-tabular text-[var(--credit-red)] truncate">
          {formatINR(suppDue)}
        </p>
        <p className="text-xs text-[var(--ink-muted)] font-tabular">
          Total recorded ledger entries across this business: {transactions.length}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onExportJson}
          className="min-h-[50px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
        >
          <Download className="w-4 h-4" />
          <span>Download JSON Backup</span>
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          className="min-h-[50px] rounded-2xl spatial-card font-extrabold text-sm text-[var(--ink)] flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-[var(--brand-accent)]" />
          <span>Export CSV Statement</span>
        </button>
      </div>
    </div>
  );
};

export const MultiDeviceView: React.FC<{
  verifiedPhone: string;
  mobileNumber: string;
  isGuestMode?: boolean;
  onOpenCloudSync?: () => void;
  onBack: () => void;
}> = ({ verifiedPhone, mobileNumber, isGuestMode = false, onOpenCloudSync, onBack }) => (
  <div className="max-w-xl mx-auto space-y-5 pb-32">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-2xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>Multi-Device Cloud Sync</span>
    </button>

    <div className="ios27-inset-group rounded-[28px] p-6 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
        <Laptop className="w-6 h-6" />
      </div>
      <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
        {isGuestMode
          ? 'Encrypted Local Guest Storage Active'
          : 'Your Khata is Synced with Zero-Knowledge E2EE'}
      </h2>
      <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
        {isGuestMode
          ? 'All ledger entries, Galla cashbook, bills, and stock are encrypted with AES-256 on this device. Connect free Cloud Backup anytime to sync across devices.'
          : 'Every customer entry, voice transaction, parchi scan, Galla cash entry, GST bill, and stock change is AES-256 encrypted before syncing to Cloud Firestore.'}
      </p>

      <div className="rounded-2xl bg-[var(--surface-subtle)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Mode</span>
          <span className="font-bold text-[var(--ink)]">
            {isGuestMode ? 'Guest Mode (Local E2EE)' : verifiedPhone || 'Signed In'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Shop Mobile</span>
          <span className="font-bold font-tabular text-[var(--ink)]">
            {mobileNumber
              ? `+91 ${mobileNumber}`
              : isGuestMode
                ? 'Not connected'
                : verifiedPhone || 'Not set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Encryption</span>
          <span
            className={`font-bold ${
              isGuestMode ? 'text-[var(--brand-accent)]' : 'text-[var(--debit-green)]'
            }`}
          >
            {isGuestMode ? 'AES-256 On-Device' : 'AES-256 Real-Time Sync'}
          </span>
        </div>
      </div>

      {isGuestMode && onOpenCloudSync ? (
        <button
          type="button"
          onClick={onOpenCloudSync}
          className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
        >
          <CloudUpload className="w-4 h-4" />
          <span>Connect Free Cloud Backup</span>
        </button>
      ) : (
        <p className="text-xs text-[var(--ink-muted)]">
          Sign in with this same Google, Email Link, or +91 mobile account on another phone or shop
          desktop to access your encrypted ledger live.
        </p>
      )}
    </div>
  </div>
);

interface NotificationsDrawerProps {
  open: boolean;
  items: AppNotificationItem[];
  onClose: () => void;
  onToggleRead: (id: string) => void;
  onToggleFav: (id: string) => void;
  onTriggerAction: (target: AppNotificationItem['targetAction']) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  items,
  onClose,
  onToggleRead,
  onToggleFav,
  onTriggerAction,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<'all' | 'unread' | 'fav'>('all');

  const visible = items.filter((it) => {
    if (tab === 'unread') return !it.read;
    if (tab === 'fav') return it.fav;
    return true;
  });

  return (
    <DetentSheetOverlay
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={`${items.filter((i) => !i.read).length} unread alerts`}
      initialDetent="full"
    >
      <div className="space-y-4">
        <div className="relative grid grid-cols-3 rounded-2xl bg-[var(--surface-subtle)] p-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'fav', label: 'Starred' },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative min-h-[40px] rounded-xl text-xs font-extrabold z-10 transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'notifTabSeg'}
                    transition={SEG_SPRING}
                    className="absolute inset-0 rounded-xl bg-[var(--surface)] shadow-xs"
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          {visible.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bell className="w-8 h-8 text-[var(--ink-muted)] mx-auto opacity-50" />
              <p className="text-sm font-bold text-[var(--ink-muted)]">
                No notifications in this tab.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {visible.map((item) => (
                <motion.div
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  key={item.id}
                  className={`rounded-[22px] p-4 space-y-2.5 ${
                    item.read
                      ? 'bg-[var(--surface-subtle)]'
                      : 'ios27-inset-group ring-1 ring-[var(--brand-accent)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-[var(--ink)]">{item.title}</h3>
                      <span className="text-[11px] text-[var(--ink-muted)]">{item.timeLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleFav(item.id)}
                      aria-label="Star notification"
                      className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-amber-500 active:scale-95 transition"
                    >
                      <Star className={`w-4 h-4 ${item.fav ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                  <ul className="text-xs text-[var(--ink-muted)] space-y-1 list-disc list-inside">
                    {item.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onToggleRead(item.id);
                        onTriggerAction(item.targetAction);
                        onClose();
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold tactile-key-primary active:scale-95 transition"
                    >
                      {item.actionLabel}
                    </button>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => onToggleRead(item.id)}
                        className="min-h-[40px] px-2 text-xs font-semibold text-[var(--ink-muted)] hover:underline"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </DetentSheetOverlay>
  );
};

export const HelpSupportView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="max-w-2xl mx-auto space-y-4 pb-32">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-2xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>Help &amp; Support</span>
    </button>

    <div className="space-y-3">
      <div className="ios27-inset-group rounded-[26px] p-5 space-y-2.5">
        <div className="flex items-center gap-2.5 text-[var(--brand-accent)] font-extrabold text-sm">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </span>
          <span>Hybrid Voice Entry &amp; Counter Queue Examples</span>
        </div>
        <ul className="text-sm text-[var(--ink-muted)] space-y-1.5 list-disc list-inside">
          <li>&quot;Ramesh do hazaar udhaar&quot; → Instant offline ₹2,000 Given (Udhaar)</li>
          <li>&quot;Mohan se paanch sau mila&quot; → Instant ₹500 Received (Jama)</li>
          <li>
            &quot;Ramesh ka bill 2kg chini 90 aur 1kg atta 45&quot; → Voice Bill Draft
          </li>
          <li>Hands-Free Counter Mode → Auto-saves and stays listening during shop rush</li>
        </ul>
      </div>

      <div className="ios27-inset-group rounded-[26px] p-5 space-y-2.5">
        <div className="flex items-center gap-2.5 text-[var(--brand-accent)] font-extrabold text-sm">
          <span className="w-9 h-9 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <span>Ucred Suite — Free &amp; Zero-Knowledge Private</span>
        </div>
        <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
          Ucred combines Receipt Scanning, Live Cashbook &amp; Daily Profit Pulse, Customer Trust
          Scores, Staff Counter Logs, Multi-Business Ledgers, GST Bills, and 1-Click WhatsApp UPI
          Collection inside your AES-256 encrypted local or cloud vault.
        </p>
      </div>
    </div>
  </div>
);

export const PinLockOverlay: React.FC<{
  expectedPin: string;
  uid: string;
  hasPasskey?: boolean;
  onVerifyPasskey?: () => Promise<boolean>;
  onUnlock: () => void;
  onForgotPin: () => Promise<void>;
}> = ({ expectedPin, uid, hasPasskey = false, onVerifyPasskey, onUnlock, onForgotPin }) => {
  const prefersReducedMotion = useReducedMotion();
  const [entered, setEntered] = useState('');
  const [error, setError] = useState('');
  const [cooldownSec, setCooldownSec] = useState(() => getPinCooldownSeconds());
  const [shaking, setShaking] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = setInterval(() => {
      setCooldownSec(getPinCooldownSeconds());
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  const handleDigit = async (d: string) => {
    const activeCooldown = getPinCooldownSeconds();
    if (activeCooldown > 0) {
      setCooldownSec(activeCooldown);
      return;
    }
    setError('');
    const next = (entered + d).slice(0, 4);
    setEntered(next);
    if (next.length === 4) {
      const ok = await verifyStoredPin(next, expectedPin, uid);
      if (ok) {
        resetPinGuard();
        haptics.success();
        onUnlock();
      } else {
        const res = recordPinFailure();
        setShaking(true);
        window.setTimeout(() => setShaking(false), 320);
        haptics.tap();
        if (res.cooldownSeconds > 0) {
          setCooldownSec(res.cooldownSeconds);
          setError(`Too many attempts. Locked for ${res.cooldownSeconds}s.`);
        } else {
          setError(
            res.remainingBeforeLock > 0
              ? `Incorrect PIN (${res.remainingBeforeLock} tries left).`
              : 'Incorrect PIN.'
          );
        }
        setTimeout(() => setEntered(''), 260);
      }
    }
  };

  return (
    <div className="min-h-dvh spatial-shell-bg flex flex-col items-center justify-center p-6">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                scale: 1,
                y: 0,
                x: shaking ? [0, -10, 10, -6, 6, 0] : 0,
              }
        }
        transition={{ duration: 0.3 }}
        className="w-full max-w-xs rounded-[28px] spatial-hero p-6 text-center space-y-5"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h1 className="font-display text-xl font-extrabold text-[var(--ink)]">
            Enter 4-Digit App PIN
          </h1>
          <p className="text-xs text-[var(--ink-muted)] mt-1">Ucred Security Lock</p>
        </div>

        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`w-4 h-4 rounded-full transition-all ${
                entered.length > idx
                  ? 'bg-[var(--brand-accent)] scale-110 shadow-xs'
                  : 'bg-[var(--surface-subtle)]'
              }`}
            />
          ))}
        </div>

        {(error || cooldownSec > 0) && (
          <p className="text-xs font-bold text-[var(--credit-red)]">
            {cooldownSec > 0 ? `Try again in ${cooldownSec}s` : error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) =>
            key === '' ? (
              <div key={`pin-spacer-${i}`} />
            ) : (
              <button
                key={`pin-digit-${key}`}
                type="button"
                disabled={cooldownSec > 0}
                onClick={() => {
                  haptics.tap();
                  if (key === '⌫') setEntered((p) => p.slice(0, -1));
                  else void handleDigit(key);
                }}
                className="min-h-[52px] rounded-2xl bg-[var(--surface-subtle)] text-lg font-extrabold font-tabular text-[var(--ink)] hover:bg-[var(--brand-tint)] disabled:opacity-40 active:scale-95 transition"
              >
                {key}
              </button>
            )
          )}
        </div>

        {hasPasskey && onVerifyPasskey && (
          <button
            type="button"
            disabled={passkeyBusy || cooldownSec > 0}
            onClick={async () => {
              setError('');
              setPasskeyBusy(true);
              try {
                const ok = await onVerifyPasskey();
                if (!ok) {
                  setError('Biometric verification did not complete.');
                } else {
                  resetPinGuard();
                  haptics.success();
                }
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Biometric unlock was cancelled.'
                );
              } finally {
                setPasskeyBusy(false);
              }
            }}
            className="w-full min-h-[46px] rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
          >
            <Fingerprint className="w-4 h-4" />
            <span>{passkeyBusy ? 'Verifying Biometrics...' : 'Unlock with Passkey'}</span>
          </button>
        )}

        <button
          type="button"
          disabled={resetBusy}
          onClick={async () => {
            setError('');
            setResetBusy(true);
            try {
              await onForgotPin();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Verification failed.');
            } finally {
              setResetBusy(false);
            }
          }}
          className="min-h-[44px] px-2 text-xs font-bold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
        >
          {resetBusy ? 'Verifying session...' : 'Forgot PIN? Reset / Verify'}
        </button>
      </motion.div>
    </div>
  );
};
