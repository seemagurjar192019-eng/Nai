'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  Camera,
  Check,
  CloudUpload,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  HelpCircle,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  Palette,
  QrCode,
  Receipt,
  Share2,
  ShieldCheck,
  Star,
  Store,
  Sun,
  Trash2,
  Upload,
  User,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LANGUAGE_OPTIONS,
  buildUpiUri,
  formatINR,
  isValidGstNumber,
  isValidIndianMobile,
  isValidUpiId,
  verifyStoredPin,
} from '@/lib/i18n';
import type {
  AppNotificationItem,
  AppearanceMode,
  Business,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
} from '@/lib/types';

import type { PersonaCapabilities } from '@/lib/persona';

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

interface MoreBentoViewProps {
  business: Business;
  appearance: AppearanceMode;
  accentTheme?: ThemeAccentId;
  verifiedPhone: string;
  activeOperatorName: string;
  isGuestMode?: boolean;
  capabilities?: PersonaCapabilities;
  onOpenCloudSync?: () => void;
  onToggleAppearance: () => void;
  onSelectAccentTheme?: (theme: ThemeAccentId) => void;
  onOpenBusinessSwitcher: () => void;
  onNavigate: (target: MoreTarget) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export const MoreBentoView: React.FC<MoreBentoViewProps> = ({
  business,
  appearance,
  accentTheme = 'sapphire',
  verifiedPhone,
  activeOperatorName,
  isGuestMode = false,
  capabilities,
  onOpenCloudSync,
  onToggleAppearance,
  onSelectAccentTheme,
  onOpenBusinessSwitcher,
  onNavigate,
  onExportCsv,
  onExportJson,
}) => {
  const showGalla = capabilities ? capabilities.showGalla : true;
  const showStock = capabilities ? capabilities.showStock : true;
  const showParchi = capabilities ? capabilities.focus !== 'personal' : true;
  const activeTheme: ThemeAccentId = appearance === 'dark' ? 'onyx' : accentTheme === 'rose' ? 'rose' : 'sapphire';
  return (
    <div className="space-y-4 pb-32 stagger-fade-up">
      {/* Hero Business & UPI Setup Card */}
      <section className="rounded-[26px] spatial-hero p-4.5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Active Shop
              </p>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isGuestMode
                    ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                    : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                }`}
              >
                {isGuestMode ? 'Guest Mode · Local' : 'Cloud Synced'}
              </span>
            </div>
            <h2 className="font-display text-lg font-extrabold text-[var(--ink)] truncate">
              {business.name}
            </h2>
            <p className="text-xs text-[var(--ink-muted)] font-tabular truncate">
              {isGuestMode ? 'Saved on this device' : verifiedPhone} · Operator: {activeOperatorName}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBusinessSwitcher}
            className="min-h-[44px] px-3.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 text-[var(--brand-fg)] text-xs font-extrabold whitespace-nowrap shrink-0 tactile-key-primary transition"
          >
            Switch Shop
          </button>
        </div>

        {isGuestMode && onOpenCloudSync && (
          <button
            type="button"
            onClick={onOpenCloudSync}
            style={{ background: 'var(--munim-gradient)' }}
            className="w-full min-h-[48px] px-4 rounded-2xl text-white flex items-center justify-between gap-3 tactile-key-primary active:scale-95 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0 text-left">
              <CloudUpload className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">Backup / Sync via Mobile OTP</p>
                <p className="text-[10px] text-indigo-100 truncate">
                  Optional — auto-merges local guest khata to cloud
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-extrabold shrink-0">
              Sync Now
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[58px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[var(--ink)] truncate">UPI QR Setup</p>
              <p className="text-[11px] text-[var(--ink-muted)] truncate">
                {business.upiId || 'Add shop UPI ID'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('business-profile')}
            className="min-h-[58px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[var(--ink)] truncate">Shop Profile</p>
              <p className="text-[11px] text-[var(--ink-muted)] truncate">
                {business.gstNumber || 'GSTIN & Card'}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Bento Group: Counter & Operations */}
      <section className="rounded-[26px] spatial-card p-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Counter Tools &amp; Logs
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('staff-audit')}
            className="min-h-[60px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[var(--ink)]">Staff Munim Logs</p>
              <p className="text-[11px] text-[var(--ink-muted)] truncate">Switch &amp; Audit</p>
            </div>
          </button>

          {showGalla && (
            <button
              type="button"
              onClick={() => onNavigate('galla')}
              className="min-h-[60px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
            >
              <span className="w-10 h-10 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--ink)]">
                  {capabilities?.gallaSegmentLabel || 'Galla'} Cashbook
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">Cash &amp; Profit</p>
              </div>
            </button>
          )}

          {showStock && (
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="min-h-[60px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
            >
              <span className="w-10 h-10 rounded-2xl bg-[var(--alert-tint)] text-[var(--alert-amber)] flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--ink)]">Stock Inventory</p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">Rates &amp; Alerts</p>
              </div>
            </button>
          )}

          {showParchi && (
            <button
              type="button"
              onClick={() => onNavigate('scan-parchi')}
              className="min-h-[60px] px-3.5 rounded-[20px] bg-[var(--surface-subtle)] flex items-center gap-2.5 text-left active:scale-95 transition"
            >
              <span
                style={{ backgroundColor: 'var(--brand)' }}
                className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 tactile-key-primary"
              >
                <Camera className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--ink)]">AI Parchi Scan</p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">Photo to Khata</p>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Bento Group: Appearance, Backup & Cloud Sync */}
      <section className="rounded-[26px] spatial-card p-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Theme &amp; Cloud Backup
        </p>

        {/* Tenmin-Style Theme Accent Selector: Sapphire Indigo | Rose | Onyx Dark */}
        {onSelectAccentTheme && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'sapphire',
                  label: 'Sapphire',
                  sub: 'Indigo',
                  dot: 'bg-[#4F46E5]',
                },
                {
                  id: 'rose',
                  label: 'Rose',
                  sub: 'Crimson',
                  dot: 'bg-[#E11D48]',
                },
                {
                  id: 'onyx',
                  label: 'Onyx',
                  sub: 'Dark',
                  dot: 'bg-[#09090B] ring-2 ring-[#E5E7EB]',
                },
              ] as const
            ).map((opt) => {
              const selected = activeTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectAccentTheme(opt.id)}
                  aria-pressed={selected}
                  className={`min-h-[54px] p-2.5 rounded-2xl flex flex-col items-start justify-between text-left active:scale-95 transition ${
                    selected
                      ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand)]'
                      : 'bg-[var(--surface-subtle)]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className={`w-4 h-4 rounded-full ${opt.dot}`} />
                    {selected && <Check className="w-3.5 h-3.5 text-[var(--brand-accent)]" />}
                  </div>
                  <div className="mt-1.5">
                    <p className="text-xs font-extrabold text-[var(--ink)] leading-tight">
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-[var(--ink-muted)]">{opt.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Instant Light / Dark Mode Switch */}
        <button
          type="button"
          onClick={onToggleAppearance}
          className="w-full min-h-[54px] px-4 rounded-[20px] bg-[var(--surface-subtle)] flex items-center justify-between gap-3 active:scale-95 transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-[var(--surface)] shadow-xs text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              {appearance === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </span>
            <div className="text-left min-w-0">
              <p className="text-xs font-extrabold text-[var(--ink)]">
                {appearance === 'dark' ? 'Onyx Dark Mode' : 'Solid Light Canvas'}
              </p>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Tap to switch between Light and Dark theme
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-bold shadow-xs shrink-0">
            {appearance === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* Cloud Backup & Exports */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onExportJson}
            className="min-h-[48px] px-3 rounded-xl bg-[var(--surface-subtle)] text-xs font-extrabold text-[var(--ink)] flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Download className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className="min-h-[48px] px-3 rounded-xl bg-[var(--surface-subtle)] text-xs font-extrabold text-[var(--ink)] flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('account-summary')}
            className="min-h-[46px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink)] flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <User className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
            <span className="truncate">Summary</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('multi-device')}
            className="min-h-[46px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink)] flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Laptop className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
            <span className="truncate">Sync</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[46px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink)] flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Lock className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
            <span className="truncate">PIN &amp; All</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Link
            href="/privacy"
            className="min-h-[40px] text-xs font-bold text-[var(--brand-accent)] hover:underline inline-flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy, Terms &amp; Account Deletion</span>
          </Link>
          <PWAInstallButton compact />
        </div>
      </section>
    </div>
  );
};


interface SettingsViewProps {
  language: LanguageCode;
  appearance: AppearanceMode;
  mobileNumber: string;
  verifiedPhone: string;
  business: Business;
  appLockPin: string;
  isGuestMode?: boolean;
  onOpenCloudSync?: () => void;
  onBack: () => void;
  onChangeLanguage: (lang: LanguageCode) => Promise<void>;
  onChangeAppearance: (mode: AppearanceMode) => Promise<void>;
  onSaveMobile: (phone: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onSavePin: (pin: string) => Promise<void>;
  onExportCsv: () => void;
  onExportJson: () => void;
  onRestoreJson: (file: File) => Promise<void>;
  onClearAll: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  appearance,
  mobileNumber,
  verifiedPhone,
  business,
  appLockPin,
  isGuestMode = false,
  onOpenCloudSync,
  onBack,
  onChangeLanguage,
  onChangeAppearance,
  onSaveMobile,
  onSaveUpiId,
  onSavePin,
  onExportCsv,
  onExportJson,
  onRestoreJson,
  onClearAll,
  onDeleteAccount,
  onLogout,
}) => {
  const [phoneInput, setPhoneInput] = useState(mobileNumber);
  const [upiInput, setUpiInput] = useState(business.upiId || '');
  const [pinInput, setPinInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteAcc, setConfirmDeleteAcc] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const flash = (msg: string) => {
    setErrorMsg('');
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const runSafely = async (actionKey: string, fn: () => Promise<void>, successMsg?: string) => {
    setErrorMsg('');
    setBusyAction(actionKey);
    try {
      await fn();
      if (successMsg) flash(successMsg);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="space-y-4 pb-32 stagger-fade-up">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Settings</span>
        </button>
        {statusMsg && (
          <span className="text-xs font-bold px-3.5 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-xs">
            {statusMsg}
          </span>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between gap-2 shadow-xs"
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

      {/* Section 1: Ucred Sapphire, Rose & Onyx Theme */}
      <section className="rounded-[26px] spatial-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </span>
            <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
              Ucred Display Theme
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[var(--ink-muted)]">
            {appearance === 'dark' ? 'Onyx Dark' : 'Solid Light Canvas'}
          </span>
        </div>

        <div className="rounded-2xl bg-[var(--surface-subtle)] p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center -space-x-1.5 shrink-0">
              <span className="w-5 h-5 rounded-full bg-[#4F46E5] ring-2 ring-white dark:ring-zinc-900" />
              <span className="w-5 h-5 rounded-full bg-[#06B6D4] ring-2 ring-white dark:ring-zinc-900" />
              <span className="w-5 h-5 rounded-full bg-[#F6F7FB] ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <p className="text-xs font-semibold text-[var(--ink-muted)] truncate">
              Solid Tenmin-inspired Light &amp; Onyx Dark system
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--ink-muted)] uppercase">Display Mode</p>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { id: 'light', label: 'Light Mode', icon: Sun },
                { id: 'dark', label: 'Dark Mode', icon: Moon },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={async () => {
                    await onChangeAppearance(m.id);
                    flash(`${m.label} active`);
                  }}
                  className={`min-h-[48px] rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition ${
                    appearance === m.id
                      ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)] text-[var(--brand-accent)] shadow-xs'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Language */}
      <section className="rounded-[26px] spatial-card p-5 space-y-3">
        <h2 className="font-display text-base font-extrabold text-[var(--ink)]">App Language</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={async () => {
                await onChangeLanguage(opt.code);
                flash(`Language set to ${opt.englishName}`);
              }}
              className={`min-h-[44px] px-3 rounded-xl text-left text-xs font-bold flex items-center justify-between active:scale-95 transition ${
                language === opt.code
                  ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)] text-[var(--brand-accent)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
              }`}
            >
              <span>{opt.nativeName}</span>
              {language === opt.code && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </section>

      {/* Section 3: Shop Mobile, UPI QR & PIN Lock */}
      <section className="rounded-[26px] spatial-card p-5 space-y-4">
        <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
          Account, UPI &amp; Security
        </h2>

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
              className="flex-1 min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="button"
              onClick={() => {
                if (phoneInput && !isValidIndianMobile(phoneInput)) {
                  setErrorMsg('Enter a valid 10-digit Indian mobile number.');
                  return;
                }
                void runSafely('mobile', () => onSaveMobile(phoneInput), 'Mobile number updated');
              }}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold shadow-sm active:scale-95 transition"
            >
              Save
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--ink-muted)]">
            Shop UPI ID (for Live Collection QR Codes)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={upiInput}
              onChange={(e) => setUpiInput(e.target.value)}
              placeholder="sharma@okicici"
              className="flex-1 min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="button"
              onClick={() => {
                const clean = upiInput.trim();
                if (!isValidUpiId(clean)) {
                  setErrorMsg('Invalid UPI ID format. Example: shopname@okicici');
                  return;
                }
                void runSafely('upi', () => onSaveUpiId(clean), 'UPI ID saved');
              }}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1 shadow-sm active:scale-95 transition"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Save UPI</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-[var(--ink-muted)]">
              4-Digit App Lock PIN ({appLockPin ? 'Currently Active' : 'Not Set'})
            </label>
            {appLockPin && (
              <button
                type="button"
                onClick={() =>
                  void runSafely(
                    'pin',
                    async () => {
                      await onSavePin('');
                      setPinInput('');
                    },
                    'App PIN disabled'
                  )
                }
                className="text-xs font-bold text-[var(--credit-red)] hover:underline"
              >
                Disable PIN
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={appLockPin ? 'Enter new 4 digits' : 'e.g. 1234'}
              className="flex-1 min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="button"
              onClick={() => {
                if (pinInput.length !== 4) {
                  setErrorMsg('PIN must be exactly 4 digits.');
                  return;
                }
                void runSafely(
                  'pin',
                  async () => {
                    await onSavePin(pinInput);
                    setPinInput('');
                  },
                  '4-Digit PIN secured'
                );
              }}
              className="min-h-[44px] px-4 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-sm active:scale-95 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{appLockPin ? 'Update PIN' : 'Set PIN'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Data Management */}
      <section className="rounded-[26px] spatial-card p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
            <Database className="w-4 h-4" />
          </span>
          <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
            Data &amp; Backup Management
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onExportCsv();
              flash('CSV exported');
            }}
            className="min-h-[46px] px-4 rounded-xl bg-[var(--surface-subtle)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>Export Data (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportJson();
              flash('JSON backup downloaded');
            }}
            className="min-h-[46px] px-4 rounded-xl bg-[var(--surface-subtle)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Download className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>Download JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={() => restoreRef.current?.click()}
            className="min-h-[46px] px-4 rounded-xl bg-[var(--surface-subtle)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Upload className="w-4 h-4 text-[var(--brand-accent)]" />
            <span>Restore JSON Backup</span>
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
                () => onRestoreJson(file),
                'Backup restored to cloud khata'
              );
            }}
            className="hidden"
          />
        </div>

        <div className="pt-2 space-y-2.5">
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="w-full min-h-[46px] rounded-xl bg-[var(--credit-tint)] text-[var(--credit-red)] text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Business Data</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-[var(--credit-tint)] p-3.5 space-y-2.5">
              <p className="text-xs font-bold text-[var(--credit-red)] text-center">
                Erase all customers, bills, Galla, staff, and stock for {business.name}?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyAction === 'clear'}
                  onClick={async () => {
                    await runSafely('clear', onClearAll, 'All shop data cleared');
                    setConfirmClear(false);
                  }}
                  className="min-h-[44px] rounded-xl bg-[var(--credit-red)] text-white text-xs font-bold shadow-sm"
                >
                  {busyAction === 'clear' ? 'Clearing...' : 'Yes, Clear All'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[44px] rounded-xl bg-[var(--surface)] text-xs font-bold text-[var(--ink)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: About, Cloud Backup / Legal & Account Controls */}
      <section className="rounded-[26px] spatial-card p-5 space-y-4">
        <div className="space-y-1">
          <p className="font-display text-sm font-extrabold text-[var(--ink)]">
            Ucred — Merchant Credit &amp; Galla OS
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            {isGuestMode
              ? 'Running in Instant Guest Mode (Local Device Storage). Use Clear All Business Data above to erase local Guest records, or sign in with +91 OTP anytime to sync across devices.'
              : `Synced privately via Mobile OTP (${verifiedPhone || (mobileNumber ? `+91 ${mobileNumber}` : 'Authenticated')}). Your shop data stays 100% encrypted.`}
          </p>
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-bold text-[var(--brand-accent)]">
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <Link href="/delete-account" className="hover:underline">
              Data Deletion Info
            </Link>
          </div>
        </div>

        {isGuestMode ? (
          onOpenCloudSync && (
            <button
              type="button"
              onClick={onOpenCloudSync}
              style={{ background: 'var(--munim-gradient)' }}
              className="w-full min-h-[48px] rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Connect +91 Mobile OTP &amp; Cloud Backup</span>
            </button>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={onLogout}
              className="w-full min-h-[48px] rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out (Switch to Guest Mode)</span>
            </button>

            {!confirmDeleteAcc ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteAcc(true)}
                className="w-full min-h-[46px] rounded-xl bg-[var(--credit-tint)] text-[var(--credit-red)] text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Delete Account &amp; All Cloud Data</span>
              </button>
            ) : (
              <div className="rounded-2xl bg-[var(--credit-tint)] p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[var(--credit-red)] text-center leading-relaxed">
                  This permanently erases ALL businesses, customers, transactions, bills, Galla, staff,
                  stock, and removes your Ucred account. Export a JSON backup first!
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyAction === 'delete-account'}
                    onClick={() => runSafely('delete-account', onDeleteAccount)}
                    className="min-h-[44px] rounded-xl bg-[var(--credit-red)] text-white text-xs font-extrabold shadow-sm disabled:opacity-60"
                  >
                    {busyAction === 'delete-account' ? 'Deleting Account...' : 'Delete Permanently'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAcc(false)}
                    className="min-h-[44px] rounded-xl bg-[var(--surface)] text-xs font-bold text-[var(--ink)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
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
    <div className="max-w-2xl mx-auto space-y-5 pb-32 stagger-fade-up">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCardModal(true)}
          className="min-h-[44px] px-3.5 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition"
        >
          <CreditCard className="w-4 h-4" />
          <span>Share Card</span>
        </button>
      </div>

      {/* Business Card Preview */}
      <div className="rounded-[28px] bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)] text-[var(--brand-fg)] p-6 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-hover)] flex items-center justify-center font-extrabold text-xl shadow-inner">
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
      <div className="rounded-[26px] spatial-card p-5 space-y-3.5">
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
          className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm shadow-md disabled:opacity-60 active:scale-95 transition"
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

      {showCardModal && (
        <div
          onClick={() => setShowCardModal(false)}
          className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 pt-3 pb-8 text-center space-y-4 sheet-slide-up"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--surface-subtle)]" />

            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                Digital Visiting Card
              </h3>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                aria-label="Close card"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-[24px] bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)] text-[var(--brand-fg)] p-5 space-y-2 text-left shadow-md">
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
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] active:scale-95 text-[var(--brand-fg)] font-bold flex items-center justify-center gap-2 shadow-md transition"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </a>
          </div>
        </div>
      )}
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
    <div className="max-w-2xl mx-auto space-y-4 pb-32 stagger-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Account Summary &amp; Backup</span>
      </button>

      <div className="rounded-[26px] spatial-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
            Customer Khata
          </h2>
          <span className="text-xs font-bold text-[var(--ink-muted)]">
            {customers.length} customers
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 font-tabular">
          <div className="rounded-2xl bg-[var(--debit-tint)] p-4">
            <p className="text-xs font-bold text-[var(--debit-green)]">You Get</p>
            <p className="text-xl font-extrabold text-[var(--debit-green)] mt-0.5">
              {formatINR(custDue)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--brand-tint)] p-4">
            <p className="text-xs font-bold text-[var(--brand-accent)]">Advance</p>
            <p className="text-xl font-extrabold text-[var(--brand-accent)] mt-0.5">
              {formatINR(custAdv)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] spatial-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-[var(--ink)]">
            Supplier Khata
          </h2>
          <span className="text-xs font-bold text-[var(--ink-muted)]">
            {suppliers.length} suppliers
          </span>
        </div>
        <p className="text-2xl font-extrabold font-tabular text-[var(--credit-red)]">
          {formatINR(suppDue)}
        </p>
        <p className="text-xs text-[var(--ink-muted)]">
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
  <div className="max-w-xl mx-auto space-y-5 pb-32 stagger-fade-up">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>Multi-Device Cloud Sync</span>
    </button>

    <div className="rounded-[28px] spatial-card p-6 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
        <Laptop className="w-6 h-6" />
      </div>
      <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
        {isGuestMode
          ? 'Local Guest Storage Active'
          : 'Your Khata is Live Across Mobile & Desktop'}
      </h2>
      <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
        {isGuestMode
          ? 'All your ledger entries, Galla cashbook, bills, and stock are saved offline on this device. Connect your +91 mobile via OTP whenever you want automatic cloud backup across devices.'
          : 'Every customer entry, voice transaction, parchi scan, Galla cash entry, GST bill, and stock change syncs automatically to Cloud Firestore with offline IndexedDB persistence.'}
      </p>

      <div className="rounded-2xl bg-[var(--surface-subtle)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Mode</span>
          <span className="font-bold text-[var(--ink)]">
            {isGuestMode ? 'Guest Mode (Local)' : verifiedPhone || 'Signed In'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Shop Mobile</span>
          <span className="font-bold font-tabular text-[var(--ink)]">
            {mobileNumber ? `+91 ${mobileNumber}` : isGuestMode ? 'Not connected' : verifiedPhone || 'Not set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-muted)]">Sync Status</span>
          <span
            className={`font-bold ${
              isGuestMode ? 'text-[var(--brand-accent)]' : 'text-[var(--debit-green)]'
            }`}
          >
            {isGuestMode ? 'Saved Locally on Device' : 'Real-Time Encrypted'}
          </span>
        </div>
      </div>

      {isGuestMode && onOpenCloudSync ? (
        <button
          type="button"
          onClick={onOpenCloudSync}
          style={{ background: 'var(--munim-gradient)' }}
          className="w-full min-h-[48px] rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
        >
          <CloudUpload className="w-4 h-4" />
          <span>Backup &amp; Sync via Mobile OTP</span>
        </button>
      ) : (
        <p className="text-xs text-[var(--ink-muted)]">
          Verify with this same +91 mobile number via SMS OTP on your counter tablet, second phone,
          or shop laptop to access live updates together.
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
  const [tab, setTab] = useState<'all' | 'unread' | 'fav'>('all');
  if (!open) return null;

  const visible = items.filter((it) => {
    if (tab === 'unread') return !it.read;
    if (tab === 'fav') return it.fav;
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 flex justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] spatial-sheet h-full p-5 flex flex-col gap-4 overflow-y-auto sheet-slide-up"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <h2 className="font-display text-lg font-extrabold text-[var(--ink)]">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'fav', label: 'Starred' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-xl text-xs font-bold active:scale-95 transition ${
                tab === t.id
                  ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)] text-[var(--brand-accent)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 flex-1 pb-safe">
          {visible.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)] text-center py-12">
              No notifications in this tab.
            </p>
          ) : (
            visible.map((item, idx) => (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
                className={`stagger-fade-up rounded-[22px] p-4 space-y-2.5 ${
                  item.read
                    ? 'bg-[var(--surface-subtle)]'
                    : 'spatial-card ring-2 ring-[var(--brand-accent)]'
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const HelpSupportView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="max-w-2xl mx-auto space-y-4 pb-32 stagger-fade-up">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl spatial-card text-sm font-extrabold text-[var(--ink)] active:scale-95 transition"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>Help &amp; Support</span>
    </button>

    <div className="space-y-3">
      <div className="rounded-[26px] spatial-card p-5 space-y-2.5">
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
            &quot;Ramesh ka bill 2kg chini 90 aur 1kg atta 45&quot; → AI Voice Bill Draft
          </li>
          <li>Hands-Free Counter Mode → Auto-saves and stays listening during shop rush</li>
        </ul>
      </div>

      <div className="rounded-[26px] spatial-card p-5 space-y-2.5">
        <div className="flex items-center gap-2.5 text-[var(--brand-accent)] font-extrabold text-sm">
          <span className="w-9 h-9 rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <span>Ucred Powerhouse Suite — Free &amp; Private</span>
        </div>
        <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
          Ucred combines AI Parchi Photo Scanning, Live Galla Cashbook &amp; Daily Profit Pulse,
          Customer Trust Scores, Staff Munim Counter Logs, Multi-Business Khata, GST Bills, and
          1-Click WhatsApp UPI Vasooli inside your private local or OTP-verified cloud ledger.
        </p>
      </div>
    </div>
  </div>
);

export const PinLockOverlay: React.FC<{
  expectedPin: string;
  uid: string;
  onUnlock: () => void;
  onForgotPin: () => Promise<void>;
}> = ({ expectedPin, uid, onUnlock, onForgotPin }) => {
  const [entered, setEntered] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = setInterval(() => {
      setCooldownSec((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  const handleDigit = async (d: string) => {
    if (cooldownSec > 0) return;
    setError('');
    const next = (entered + d).slice(0, 4);
    setEntered(next);
    if (next.length === 4) {
      const ok = await verifyStoredPin(next, expectedPin, uid);
      if (ok) {
        onUnlock();
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setCooldownSec(30);
          setAttempts(0);
          setError('Too many attempts. Locked for 30s.');
        } else {
          setError(`Incorrect PIN (${5 - nextAttempts} tries left).`);
        }
        setTimeout(() => setEntered(''), 250);
      }
    }
  };

  return (
    <div className="max-w-[430px] mx-auto min-h-dvh shadow-2xl spatial-shell-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs rounded-[28px] spatial-hero p-6 text-center space-y-5 sheet-slide-up">
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
              <div key={i} />
            ) : (
              <button
                key={key}
                type="button"
                disabled={cooldownSec > 0}
                onClick={() =>
                  key === '⌫' ? setEntered((p) => p.slice(0, -1)) : void handleDigit(key)
                }
                className="min-h-[52px] rounded-2xl bg-[var(--surface-subtle)] text-lg font-extrabold font-tabular text-[var(--ink)] hover:bg-[var(--brand-tint)] disabled:opacity-40 active:scale-95 transition"
              >
                {key}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={resetBusy}
          onClick={async () => {
            setError('');
            setResetBusy(true);
            try {
              await onForgotPin();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Mobile OTP re-verification failed.');
            } finally {
              setResetBusy(false);
            }
          }}
          className="min-h-[44px] px-2 text-xs font-bold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
        >
          {resetBusy ? 'Sending OTP verification...' : 'Forgot PIN? Verify Mobile via OTP'}
        </button>
      </div>
    </div>
  );
};
