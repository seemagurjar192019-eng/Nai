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
  Sparkles,
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
  AccentTheme,
  AppNotificationItem,
  AppearanceMode,
  Business,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
} from '@/lib/types';

export type SecondaryRoute =
  | 'settings'
  | 'business-profile'
  | 'account-summary'
  | 'multi-device'
  | 'help-support'
  | 'galla'
  | 'staff-audit';

interface MoreDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (
    target: SecondaryRoute | 'bills' | 'stock' | 'collection' | 'scan-parchi'
  ) => void;
}

export const MoreDrawerSheet: React.FC<MoreDrawerProps> = ({ open, onClose, onNavigate }) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="More options"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">More</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings');
              }}
              className="min-h-[40px] px-3 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Palette className="w-4 h-4 text-[var(--brand)]" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close more menu"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary 3 Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('account-summary');
            }}
            className="rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] p-4 flex flex-col items-center gap-2 text-center hover:border-[var(--brand)] transition"
          >
            <span className="w-10 h-10 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <User className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold">Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('business-profile');
            }}
            className="rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] p-4 flex flex-col items-center gap-2 text-center hover:border-[var(--brand)] transition"
          >
            <span className="w-10 h-10 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <Store className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold">Business Profile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('help-support');
            }}
            className="rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] p-4 flex flex-col items-center gap-2 text-center hover:border-[var(--brand)] transition"
          >
            <span className="w-10 h-10 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold">Help &amp; Support</span>
          </button>
        </div>

        {/* Business Tools Grid */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Ucred Power Tools
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('galla');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Wallet className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Galla Cashbook</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('scan-parchi');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Camera className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Scan Parchi (AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('staff-audit');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <UserCheck className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Staff &amp; Audit Log</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('stock');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Package className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Stock Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('bills');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Receipt className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Bills &amp; Quotes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('collection');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <MessageCircle className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">1-Click Vasooli</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('multi-device');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Laptop className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">Multi Device Sync</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings');
              }}
              className="min-h-[54px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center gap-3 text-left hover:border-[var(--brand)] transition"
            >
              <Lock className="w-5 h-5 text-[var(--brand)] shrink-0" />
              <span className="text-sm font-bold">App PIN &amp; Theme</span>
            </button>
          </div>

          <Link
            href="/privacy"
            onClick={onClose}
            className="w-full min-h-[48px] px-3.5 rounded-2xl border border-[var(--surface-border)] flex items-center justify-center gap-2 text-xs font-bold hover:border-[var(--brand)] transition"
          >
            <ShieldCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
            <span>Privacy Policy, Terms &amp; Account Deletion Info</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

interface SettingsViewProps {
  language: LanguageCode;
  accentTheme: AccentTheme;
  appearance: AppearanceMode;
  mobileNumber: string;
  business: Business;
  appLockPin: string;
  userEmail: string;
  onBack: () => void;
  onChangeLanguage: (lang: LanguageCode) => Promise<void>;
  onChangeAccent: (accent: AccentTheme) => Promise<void>;
  onChangeAppearance: (mode: AppearanceMode) => Promise<void>;
  onSaveMobile: (phone: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onSavePin: (pin: string) => Promise<void>;
  onLoadDemo: () => Promise<void>;
  onExportCsv: () => void;
  onExportJson: () => void;
  onRestoreJson: (file: File) => Promise<void>;
  onClearAll: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  accentTheme,
  appearance,
  mobileNumber,
  business,
  appLockPin,
  userEmail,
  onBack,
  onChangeLanguage,
  onChangeAccent,
  onChangeAppearance,
  onSaveMobile,
  onSaveUpiId,
  onSavePin,
  onLoadDemo,
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
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-extrabold text-slate-800 dark:text-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Settings</span>
        </button>
        {statusMsg && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]">
            {statusMsg}
          </span>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
        >
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Brand Theme & Dark Mode */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[var(--brand)]" />
          <h2 className="text-base font-extrabold">Theme &amp; Appearance</h2>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">Brand Accent</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={async () => {
                await onChangeAccent('obsidian');
                flash('Ucred Obsidian theme applied');
              }}
              className={`min-h-[50px] px-3.5 rounded-xl border-2 flex items-center justify-between text-xs sm:text-sm font-bold transition ${
                accentTheme === 'obsidian'
                  ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
                  : 'border-[var(--surface-border)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#161514] border border-[#E5DEC9]" />
                <span>Ucred Obsidian</span>
              </span>
              {accentTheme === 'obsidian' && <Check className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={async () => {
                await onChangeAccent('green');
                flash('OkCredit Green theme applied');
              }}
              className={`min-h-[50px] px-3.5 rounded-xl border-2 flex items-center justify-between text-xs sm:text-sm font-bold transition ${
                accentTheme === 'green'
                  ? 'border-[#008037] bg-[#E8F5EE] text-[#008037]'
                  : 'border-[var(--surface-border)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#008037]" />
                <span>OkCredit Green</span>
              </span>
              {accentTheme === 'green' && <Check className="w-4 h-4 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={async () => {
                await onChangeAccent('crimson');
                flash('Crimson theme applied');
              }}
              className={`min-h-[50px] px-3.5 rounded-xl border-2 flex items-center justify-between text-xs sm:text-sm font-bold transition ${
                accentTheme === 'crimson'
                  ? 'border-[#9A1B1E] bg-[#FCECEC] text-[#9A1B1E]'
                  : 'border-[var(--surface-border)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#9A1B1E]" />
                <span>Ucred Crimson</span>
              </span>
              {accentTheme === 'crimson' && <Check className="w-4 h-4 shrink-0" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">App Mode</p>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Laptop },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={async () => {
                    await onChangeAppearance(m.id);
                    flash(`${m.label} mode saved`);
                  }}
                  className={`min-h-[44px] rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 ${
                    appearance === m.id
                      ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                      : 'border-[var(--surface-border)]'
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
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-3">
        <h2 className="text-base font-extrabold">App Language</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={async () => {
                await onChangeLanguage(opt.code);
                flash(`Language set to ${opt.englishName}`);
              }}
              className={`min-h-[44px] px-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between ${
                language === opt.code
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'border-[var(--surface-border)]'
              }`}
            >
              <span>{opt.nativeName}</span>
              {language === opt.code && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </section>

      {/* Section 3: Shop Mobile, UPI QR & PIN Lock */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-4">
        <h2 className="text-base font-extrabold">Account, UPI &amp; Security</h2>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500">Shop Mobile Number</label>
          <div className="flex gap-2">
            <input
              type="tel"
              maxLength={10}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              className="flex-1 min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold font-tabular outline-none"
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
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold"
            >
              Save
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500">
            Shop UPI ID (for Live Collection QR Codes)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={upiInput}
              onChange={(e) => setUpiInput(e.target.value)}
              placeholder="sharma@okicici"
              className="flex-1 min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold outline-none"
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
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Save UPI</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-500">
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
                className="text-xs font-bold text-red-600 hover:underline"
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
              className="flex-1 min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold font-tabular outline-none"
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
              className="min-h-[44px] px-4 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{appLockPin ? 'Update PIN' : 'Set PIN'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Data Management */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[var(--brand)]" />
          <h2 className="text-base font-extrabold">Data &amp; Backup Management</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busyAction === 'demo'}
            onClick={async () => {
              setBusyAction('demo');
              await onLoadDemo();
              setBusyAction('');
              flash('Demo customers, Galla & staff loaded');
            }}
            className="min-h-[46px] px-4 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{busyAction === 'demo' ? 'Loading Demo...' : 'Load Demo Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportCsv();
              flash('CSV exported');
            }}
            className="min-h-[46px] px-4 rounded-xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--brand)]" />
            <span>Export Data (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportJson();
              flash('JSON backup downloaded');
            }}
            className="min-h-[46px] px-4 rounded-xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-[var(--brand)]" />
            <span>Download JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={() => restoreRef.current?.click()}
            className="min-h-[46px] px-4 rounded-xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4 text-[var(--brand)]" />
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
              className="w-full min-h-[44px] rounded-xl border border-red-200 dark:border-red-900 text-red-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Business Data</span>
            </button>
          ) : (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
              <p className="text-xs font-bold text-red-700 dark:text-red-300 text-center">
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
                  className="min-h-[40px] rounded-lg bg-red-600 text-white text-xs font-bold"
                >
                  {busyAction === 'clear' ? 'Clearing...' : 'Yes, Clear All'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[40px] rounded-lg bg-[var(--surface)] text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: About, Legal & Permanent Account Deletion */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-extrabold">Ucred — Smart Voice Khata &amp; Galla OS</p>
          <p className="text-xs text-slate-500">
            Synced privately via Google ({userEmail || 'Authenticated'}). Your shop data stays 100%
            private.
          </p>
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-bold text-[var(--brand)]">
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

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[48px] rounded-2xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>

        {!confirmDeleteAcc ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteAcc(true)}
            className="w-full min-h-[44px] rounded-xl border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Delete Account &amp; All Cloud Data</span>
          </button>
        ) : (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-red-700 dark:text-red-300 text-center leading-relaxed">
              This permanently erases ALL businesses, customers, transactions, bills, Galla, staff,
              stock, and removes your Ucred account. Export a JSON backup first!
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyAction === 'delete-account'}
                onClick={() => runSafely('delete-account', onDeleteAccount)}
                className="min-h-[42px] rounded-xl bg-red-600 text-white text-xs font-extrabold disabled:opacity-60"
              >
                {busyAction === 'delete-account' ? 'Deleting Account...' : 'Delete Permanently'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteAcc(false)}
                className="min-h-[42px] rounded-xl bg-[var(--surface)] text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
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
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-extrabold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Business Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCardModal(true)}
          className="min-h-[40px] px-3.5 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] text-xs font-extrabold inline-flex items-center gap-1.5"
        >
          <CreditCard className="w-4 h-4" />
          <span>Share Business Card</span>
        </button>
      </div>

      {/* Business Card Preview */}
      <div className="rounded-3xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)] text-[var(--brand-fg)] p-6 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-current/15 flex items-center justify-center font-extrabold text-xl">
              {(name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-extrabold">{name || 'My Shop'}</h2>
              <p className="text-xs opacity-85">
                {category || 'General Store'} · {businessType || 'Retail'}
              </p>
            </div>
          </div>
          <Building2 className="w-7 h-7 opacity-70" />
        </div>
        <div className="text-xs space-y-1 opacity-90 pt-2 border-t border-current/20">
          {phone && <p>Mobile: +91 {phone}</p>}
          {gstNumber && <p>GSTIN: {gstNumber}</p>}
          {address && <p>{address}</p>}
        </div>
      </div>

      {/* Profile Form */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Business / Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mobile Number</label>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-tabular font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">GST Number</label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-tabular uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="shopname@okicici"
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Business Type</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Retailer / Wholesaler"
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Kirana / Medical / Hardware"
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Shop Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Main Market Road, Near Bus Stand"
            className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">About Shop</label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Fresh groceries & daily essentials"
              className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
            />
          </div>
        </div>

        {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm disabled:opacity-60"
        >
          {saving ? 'Saving Profile...' : savedToast ? 'Saved ✓' : 'Save Business Profile'}
        </button>

        {canDeleteBusiness && onDeleteBusiness && (
          <div className="pt-2 border-t border-[var(--surface-border)]">
            {!confirmDeleteBiz ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteBiz(true)}
                className="w-full min-h-[42px] rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Delete This Business ({business.name})
              </button>
            ) : (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                <p className="text-xs font-bold text-red-700 dark:text-red-300 text-center">
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
                    className="min-h-[40px] rounded-lg bg-red-600 text-white text-xs font-bold"
                  >
                    {deletingBiz ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBiz(false)}
                    className="min-h-[40px] rounded-lg bg-[var(--surface)] text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Digital Visiting Card</h3>
              <button type="button" onClick={() => setShowCardModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] p-5 space-y-2 text-left">
              <p className="text-xl font-extrabold">{name || 'My Shop'}</p>
              <p className="text-xs opacity-90">{about || category}</p>
              {phone && <p className="text-xs font-tabular">Tel: +91 {phone}</p>}
              {address && <p className="text-xs">{address}</p>}
            </div>
            {upiId && (
              <div className="mx-auto w-fit p-3 bg-white rounded-2xl border border-slate-200">
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
              className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold flex items-center justify-center gap-2"
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
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 min-h-[44px] text-sm font-extrabold"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Account Summary &amp; Backup</span>
      </button>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Customer Khata</h2>
          <span className="text-xs font-bold text-slate-500">{customers.length} customers</span>
        </div>
        <div className="grid grid-cols-2 gap-3 font-tabular">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3">
            <p className="text-xs font-bold text-red-700 dark:text-red-300">You Get</p>
            <p className="text-xl font-extrabold text-red-600">{formatINR(custDue)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Advance</p>
            <p className="text-xl font-extrabold text-emerald-600">{formatINR(custAdv)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Supplier Khata</h2>
          <span className="text-xs font-bold text-slate-500">{suppliers.length} suppliers</span>
        </div>
        <p className="text-2xl font-extrabold font-tabular text-[var(--brand)]">
          {formatINR(suppDue)}
        </p>
        <p className="text-xs text-slate-500">
          Total recorded ledger entries across this business: {transactions.length}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onExportJson}
          className="min-h-[50px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Download JSON Backup</span>
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          className="min-h-[50px] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] font-extrabold text-sm flex items-center justify-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-[var(--brand)]" />
          <span>Export CSV Statement</span>
        </button>
      </div>
    </div>
  );
};

export const MultiDeviceView: React.FC<{
  userEmail: string;
  mobileNumber: string;
  onBack: () => void;
}> = ({ userEmail, mobileNumber, onBack }) => (
  <div className="max-w-xl mx-auto space-y-5 pb-24">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] text-sm font-extrabold"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>Multi-Device Cloud Sync</span>
    </button>

    <div className="rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
        <Laptop className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-extrabold">Your Khata is Live Across Mobile &amp; Desktop</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        Every customer entry, voice transaction, parchi scan, Galla cash entry, GST bill, and stock
        change syncs automatically to Cloud Firestore with offline IndexedDB persistence.
      </p>

      <div className="rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Cloud Account</span>
          <span className="font-bold">{userEmail || 'Signed In'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Shop Mobile</span>
          <span className="font-bold font-tabular">
            {mobileNumber ? `+91 ${mobileNumber}` : 'Not set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Sync Status</span>
          <span className="font-bold text-emerald-600">Real-Time Encrypted</span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Sign in with this same Google Account on your counter tablet, second phone, or shop laptop
        to access live updates together.
      </p>
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-[var(--surface)] border-l border-[var(--surface-border)] h-full p-5 flex flex-col gap-4 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-lg font-extrabold">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
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
              className={`min-h-[38px] rounded-xl text-xs font-bold border ${
                tab === t.id
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'border-[var(--surface-border)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 flex-1">
          {visible.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              No notifications in this tab.
            </p>
          ) : (
            visible.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 space-y-2.5 ${
                  item.read
                    ? 'bg-[var(--app-bg)] border-[var(--surface-border)]'
                    : 'bg-[var(--surface)] border-[var(--brand)]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold">{item.title}</h3>
                    <span className="text-[11px] text-slate-400">{item.timeLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFav(item.id)}
                    aria-label="Star notification"
                    className="p-1.5 rounded-lg text-amber-500"
                  >
                    <Star className={`w-4 h-4 ${item.fav ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
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
                    className="min-h-[36px] px-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold"
                  >
                    {item.actionLabel}
                  </button>
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => onToggleRead(item.id)}
                      className="text-xs font-semibold text-slate-500 hover:underline"
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
  <div className="max-w-2xl mx-auto space-y-4 pb-24">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 min-h-[44px] text-sm font-extrabold"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>Help &amp; Support</span>
    </button>

    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-2">
        <div className="flex items-center gap-2 text-[var(--brand)] font-extrabold text-sm">
          <BookOpen className="w-4 h-4" />
          <span>Hybrid Voice Entry &amp; Counter Queue Examples</span>
        </div>
        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
          <li>&quot;Ramesh do hazaar udhaar&quot; → Instant offline ₹2,000 Given (Udhaar)</li>
          <li>&quot;Mohan se paanch sau mila&quot; → Instant ₹500 Received (Jama)</li>
          <li>
            &quot;Ramesh ka bill 2kg chini 90 aur 1kg atta 45&quot; → AI Voice Bill Draft
          </li>
          <li>Hands-Free Counter Mode → Auto-saves and stays listening during shop rush</li>
        </ul>
      </div>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 space-y-2">
        <div className="flex items-center gap-2 text-[var(--brand)] font-extrabold text-sm">
          <ShieldCheck className="w-4 h-4" />
          <span>Ucred Powerhouse Suite — Free &amp; Private</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Ucred combines AI Parchi Photo Scanning, Live Galla Cashbook &amp; Daily Profit Pulse,
          Customer Trust Scores, Staff Munim Counter Logs, Multi-Business Khata, GST Bills, and
          1-Click WhatsApp UPI Vasooli inside your private Google Cloud account.
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
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 text-center space-y-5 shadow-xl">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">Enter 4-Digit App PIN</h1>
          <p className="text-xs text-slate-500 mt-1">Ucred Security Lock</p>
        </div>

        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`w-4 h-4 rounded-full border-2 ${
                entered.length > idx
                  ? 'bg-[var(--brand)] border-[var(--brand)]'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
          ))}
        </div>

        {(error || cooldownSec > 0) && (
          <p className="text-xs font-bold text-red-600">
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
                className="min-h-[52px] rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] text-lg font-extrabold font-tabular hover:bg-[var(--brand-tint)] disabled:opacity-40 transition"
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
              setError(err instanceof Error ? err.message : 'Google re-verification failed.');
            } finally {
              setResetBusy(false);
            }
          }}
          className="text-xs font-bold text-[var(--brand)] hover:underline disabled:opacity-50"
        >
          {resetBusy ? 'Verifying Google account...' : 'Forgot PIN? Reset via Google Sign-In'}
        </button>
      </div>
    </div>
  );
};
