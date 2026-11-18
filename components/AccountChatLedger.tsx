'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Camera,
  Check,
  Delete,
  Edit3,
  FileText,
  Lock,
  MessageCircle,
  MessageSquare,
  Mic,
  Phone,
  QrCode,
  Receipt,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildReminderMessage,
  buildUpiUri,
  buildWhatsAppUrl,
  compressImageToDataUrl,
  formatDateHeading,
  formatINR,
  formatTimeOnly,
  getAvatarColor,
  getLocalDateKey,
  getUIStrings,
  isValidIndianMobile,
} from '@/lib/i18n';
import type {
  Business,
  CashbookMode,
  CustomerTrustScore,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  TxDirection,
} from '@/lib/types';

interface AccountChatLedgerProps {
  account: LedgerAccount;
  business: Business;
  language: LanguageCode;
  transactions: LedgerTransaction[];
  trustScore?: CustomerTrustScore;
  onBack: () => void;
  onAddTransaction: (payload: {
    direction: TxDirection;
    amount: number;
    note: string;
    billDate: string;
    billImage: string;
    syncToGalla?: { mode: CashbookMode } | null;
  }) => Promise<void>;
  onUpdateTransaction: (
    tx: LedgerTransaction,
    patch: {
      direction: TxDirection;
      amount: number;
      note: string;
      billDate: string;
      billImage: string;
    }
  ) => Promise<void>;
  onDeleteTransaction: (tx: LedgerTransaction) => Promise<void>;
  onUpdateAccount: (patch: {
    name?: string;
    phone?: string;
    dueDate?: string;
    creditLimit?: number;
    promiseDate?: string;
    promiseNote?: string;
  }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onOpenVoiceForCustomer: (name: string) => void;
  onOpenCreateBill: (customerName: string, customerPhone: string) => void;
  onOpenParchiScanner?: () => void;
}

const KEYPAD_BUTTONS = [
  '1', '2', '3', 'BACK',
  '4', '5', '6', '×',
  '7', '8', '9', '-',
  '.', '0', '=', '+',
] as const;

function evaluateCalcExpression(expr: string): number {
  const sanitized = expr.replace(/×/g, '*').replace(/[^0-9+\-*/.]/g, '');
  if (!sanitized) return 0;
  try {
    const tokens = sanitized.match(/(\d+(?:\.\d+)?|[+\-*/])/g);
    if (!tokens || tokens.length === 0) return 0;
    let total = parseFloat(tokens[0]) || 0;
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const next = parseFloat(tokens[i + 1]);
      if (Number.isNaN(next)) break;
      if (op === '+') total += next;
      else if (op === '-') total -= next;
      else if (op === '*') total *= next;
      else if (op === '/' && next !== 0) total /= next;
    }
    return Math.max(0, Math.round(total * 100) / 100);
  } catch {
    return 0;
  }
}

export const AccountChatLedger: React.FC<AccountChatLedgerProps> = ({
  account,
  business,
  language,
  transactions,
  trustScore,
  onBack,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateAccount,
  onDeleteAccount,
  onOpenVoiceForCustomer,
  onOpenCreateBill,
  onOpenParchiScanner,
}) => {
  const t = getUIStrings(language);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'given' | 'received' | 'photos'>(
    'all'
  );
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [armedDeleteTxId, setArmedDeleteTxId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [brokenImgIds, setBrokenImgIds] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');

  // Edit profile & promise-to-pay form
  const [editName, setEditName] = useState(account.name);
  const [editPhone, setEditPhone] = useState(account.phone);
  const [editDueDate, setEditDueDate] = useState(account.dueDate);
  const [editPromiseDate, setEditPromiseDate] = useState(account.promiseDate || '');
  const [editPromiseNote, setEditPromiseNote] = useState(account.promiseNote || '');
  const [editCreditLimit, setEditCreditLimit] = useState(
    account.creditLimit ? String(account.creditLimit) : ''
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [dueSaving, setDueSaving] = useState(false);
  const [dueError, setDueError] = useState('');
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(false);

  // Calculator transaction modal (Add or Edit mode)
  const [calcDirection, setCalcDirection] = useState<TxDirection | null>(null);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [calcExpr, setCalcExpr] = useState('0');
  const [calcNote, setCalcNote] = useState('');
  const [calcDate, setCalcDate] = useState(() => getLocalDateKey());
  const [calcBillImage, setCalcBillImage] = useState('');
  const [syncGallaMode, setSyncGallaMode] = useState<CashbookMode | null>(null);
  const [calcSaving, setCalcSaving] = useState(false);
  const [calcError, setCalcError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewImage) setPreviewImage(null);
      else if (showDueModal && !dueSaving) setShowDueModal(false);
      else if (showQrModal) setShowQrModal(false);
      else if (showProfileDrawer && !profileSaving) setShowProfileDrawer(false);
      else if (calcDirection && !calcSaving) setCalcDirection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    previewImage,
    showDueModal,
    dueSaving,
    showQrModal,
    showProfileDrawer,
    profileSaving,
    calcDirection,
    calcSaving,
  ]);

  // Chronological entries + running balance per transaction
  const timeline = useMemo(() => {
    const sortedAsc = [...transactions].sort((a, b) => a.billDate.localeCompare(b.billDate));
    const withRunning: Array<{ tx: LedgerTransaction; runningBalance: number }> = [];
    let running = 0;
    for (const tx of sortedAsc) {
      running += tx.direction === 'given' ? tx.amount : -tx.amount;
      running = Math.round(running * 100) / 100;
      withRunning.push({ tx, runningBalance: running });
    }

    const filtered = withRunning.filter((item) => {
      if (timelineFilter === 'given' && item.tx.direction !== 'given') return false;
      if (timelineFilter === 'received' && item.tx.direction !== 'received') return false;
      if (timelineFilter === 'photos' && !item.tx.billImage) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.tx.note.toLowerCase().includes(q) ||
          String(item.tx.amount).includes(q) ||
          item.tx.voiceRaw.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const groups: Array<{ dateLabel: string; items: typeof withRunning }> = [];
    for (const item of filtered) {
      const label = formatDateHeading(item.tx.billDate);
      const last = groups[groups.length - 1];
      if (!last || last.dateLabel !== label) {
        groups.push({ dateLabel: label, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [transactions, searchQuery, timelineFilter]);

  const openCalculator = (dir: TxDirection) => {
    setEditingTx(null);
    setCalcDirection(dir);
    setCalcExpr('0');
    setCalcNote('');
    setCalcDate(getLocalDateKey());
    setCalcBillImage('');
    setSyncGallaMode(null);
    setCalcError('');
  };

  const openEditCalculator = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setCalcDirection(tx.direction);
    setCalcExpr(String(tx.amount));
    setCalcNote(tx.note || '');
    setCalcDate((tx.billDate || '').slice(0, 10) || getLocalDateKey());
    setCalcBillImage(tx.billImage || '');
    setSyncGallaMode(null);
    setCalcError('');
  };

  const handleKeypadPress = (key: string) => {
    setCalcError('');
    if (key === 'BACK') {
      setCalcExpr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === '=') {
      const val = evaluateCalcExpression(calcExpr);
      setCalcExpr(String(val));
      return;
    }
    if (['+', '-', '×'].includes(key)) {
      setCalcExpr((prev) => {
        if (/[+\-×]$/.test(prev)) return prev.slice(0, -1) + key;
        return prev + key;
      });
      return;
    }
    if (key === '.') {
      const lastSegment = calcExpr.split(/[+\-×]/).pop() || '';
      if (lastSegment.includes('.')) return;
      setCalcExpr((prev) => prev + '.');
      return;
    }
    setCalcExpr((prev) => (prev === '0' ? key : (prev + key).slice(0, 16)));
  };

  const calcNumericAmount = evaluateCalcExpression(calcExpr);

  const calcLimitWarning = useMemo(() => {
    if (!account.creditLimit || account.creditLimit <= 0 || calcDirection !== 'given') return null;
    const base = editingTx
      ? account.balance - (editingTx.direction === 'given' ? editingTx.amount : -editingTx.amount)
      : account.balance;
    const projected = base + calcNumericAmount;
    if (projected > account.creditLimit) {
      return {
        limit: account.creditLimit,
        projected,
        excess: Math.round((projected - account.creditLimit) * 100) / 100,
      };
    }
    return null;
  }, [account.creditLimit, account.balance, calcDirection, calcNumericAmount, editingTx]);

  const handleConfirmCalc = async () => {
    if (!calcDirection) return;
    const amt = evaluateCalcExpression(calcExpr);
    if (amt <= 0) {
      setCalcError('Enter an amount greater than ₹0.');
      return;
    }
    setCalcSaving(true);
    try {
      const nowTime = new Date().toTimeString().slice(0, 8);
      const isoDate =
        editingTx && editingTx.billDate.startsWith(calcDate)
          ? editingTx.billDate
          : new Date(`${calcDate}T${nowTime}`).toISOString();

      if (editingTx) {
        await onUpdateTransaction(editingTx, {
          direction: calcDirection,
          amount: amt,
          note: calcNote.trim(),
          billDate: isoDate,
          billImage: calcBillImage,
        });
      } else {
        await onAddTransaction({
          direction: calcDirection,
          amount: amt,
          note: calcNote.trim(),
          billDate: isoDate,
          billImage: calcBillImage,
          syncToGalla: syncGallaMode ? { mode: syncGallaMode } : null,
        });
      }
      setCalcSaving(false);
      setCalcDirection(null);
      setEditingTx(null);
    } catch (err) {
      setCalcSaving(false);
      setCalcError(err instanceof Error ? err.message : 'Failed to save transaction.');
    }
  };

  const handleDictateNote = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        start: () => void;
      };
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.onresult = (ev) => {
        const spoken = ev.results?.[0]?.[0]?.transcript || '';
        if (spoken) setCalcNote((prev) => (prev ? `${prev} ${spoken}` : spoken));
      };
      rec.start();
    } catch {
      // Ignore if speech unavailable
    }
  };

  const handleBillPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setCalcBillImage(dataUrl);
    } catch {
      setCalcError('Could not process photo. Try a smaller image.');
    }
  };

  const reminderMsg = buildReminderMessage({
    customerName: account.name,
    amount: account.balance,
    shopName: business.name,
    upiId: business.upiId,
    language,
  });

  const upiUri = buildUpiUri(
    business.upiId || 'merchant@upi',
    business.name,
    account.balance > 0 ? account.balance : undefined
  );

  const absBal = Math.abs(account.balance);
  const balLabel =
    account.balance > 0 ? t.due : account.balance < 0 ? t.advance : t.settled;

  // Calculator Modal View
  if (calcDirection) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--app-bg)] flex flex-col">
        <div className="max-w-lg w-full mx-auto flex-1 flex flex-col justify-between p-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCalcDirection(null)}
                aria-label="Back to ledger"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div
                style={{ backgroundColor: getAvatarColor(account.name) }}
                className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0"
              >
                {account.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {editingTx ? `Edit · ${account.name}` : account.name}
                </h2>
                <p
                  className={`text-xs font-bold font-tabular ${
                    calcDirection === 'given' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {calcDirection === 'given' ? 'Credit Given (Udhaar)' : 'Payment Received (Jama)'} ·{' '}
                  {formatINR(absBal)} {balLabel}
                </p>
              </div>
            </div>
            {editingTx && (
              <div className="flex gap-1.5">
                {(['received', 'given'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCalcDirection(d)}
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold border ${
                      calcDirection === d
                        ? d === 'given'
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-[var(--surface-border)]'
                    }`}
                  >
                    {d === 'given' ? 'Given' : 'Received'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Big Amount Display */}
          <div className="py-4 text-center space-y-1.5">
            <div
              className={`text-5xl font-extrabold font-tabular tracking-tight ${
                calcDirection === 'given' ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              ₹{calcExpr}
            </div>
            {/[+\-×]/.test(calcExpr) && (
              <p className="text-sm font-bold font-tabular text-slate-500">
                = {formatINR(calcNumericAmount)}
              </p>
            )}
            {calcLimitWarning && (
              <p className="inline-flex items-center gap-1.5 text-xs font-bold font-tabular text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Limit {formatINR(calcLimitWarning.limit)} exceeded by{' '}
                  {formatINR(calcLimitWarning.excess)}
                </span>
              </p>
            )}
          </div>

          {/* Notes / Date / Bill Attachment / Galla Sync */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] px-3.5 min-h-[48px]">
              <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={calcNote}
                onChange={(e) => setCalcNote(e.target.value)}
                placeholder="Add Notes (e.g. 2kg chini, atta)"
                className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={handleDictateNote}
                aria-label="Speak note"
                className="min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center text-[var(--brand)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] px-3.5 min-h-[46px] text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[var(--brand)]" />
                  <span>Bill Date</span>
                </span>
                <input
                  type="date"
                  value={calcDate}
                  onChange={(e) => setCalcDate(e.target.value)}
                  className="bg-transparent text-xs font-tabular outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] px-3.5 min-h-[46px] text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[var(--brand)]" />
                  <span>{calcBillImage ? 'Bill Added ✓' : 'Add Bills'}</span>
                </span>
                <span className="text-[var(--brand)] text-base leading-none">+</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBillPhotoChange}
                className="hidden"
              />
            </div>

            {!editingTx && (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] px-3.5 py-2">
                <span className="text-[11px] font-bold text-slate-500">
                  Sync to Today&apos;s Galla
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: null, label: 'Off' },
                      { id: 'cash', label: 'Cash' },
                      { id: 'upi', label: 'UPI' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setSyncGallaMode(opt.id)}
                      className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-extrabold border ${
                        syncGallaMode === opt.id
                          ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--brand-fg)]'
                          : 'border-[var(--surface-border)] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {calcError && (
              <p className="text-xs font-bold text-red-600 text-center">{calcError}</p>
            )}

            <div className="flex gap-2.5 pt-1">
              {calcDirection === 'given' && (
                <button
                  type="button"
                  onClick={() => {
                    setCalcDirection(null);
                    onOpenCreateBill(account.name, account.phone);
                  }}
                  className="min-h-[52px] px-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] text-sm font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileText className="w-4 h-4 text-[var(--brand)]" />
                  <span>Create Bill</span>
                </button>
              )}
              <button
                type="button"
                disabled={calcSaving}
                onClick={handleConfirmCalc}
                className="flex-1 min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-base flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>{calcSaving ? 'Saving...' : 'Confirm'}</span>
              </button>
            </div>
          </div>

          {/* Numeric Calculator Pad */}
          <div className="grid grid-cols-4 gap-2 pt-3">
            {KEYPAD_BUTTONS.map((btn) => {
              const isOp = ['+', '-', '×', '=', 'BACK'].includes(btn);
              return (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleKeypadPress(btn)}
                  className={`min-h-[54px] rounded-2xl font-tabular text-xl font-bold flex items-center justify-center transition active:scale-95 ${
                    btn === '='
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                      : isOp
                      ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                      : 'bg-[var(--surface)] border border-[var(--surface-border)] text-slate-900 dark:text-white'
                  }`}
                >
                  {btn === 'BACK' ? <Delete className="w-5 h-5" /> : btn}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] bg-[var(--app-bg)] rounded-3xl border border-[var(--surface-border)] overflow-hidden">
      {/* Ledger Chat Top Bar */}
      <div className="no-print bg-[var(--surface)] border-b border-[var(--surface-border)] px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Ledger"
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            style={{ backgroundColor: getAvatarColor(account.name) }}
            className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0"
          >
            {account.name.charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={() => {
              setEditName(account.name);
              setEditPhone(account.phone);
              setEditDueDate(account.dueDate);
              setEditPromiseDate(account.promiseDate || '');
              setEditPromiseNote(account.promiseNote || '');
              setEditCreditLimit(account.creditLimit ? String(account.creditLimit) : '');
              setConfirmDeleteCustomer(false);
              setShowProfileDrawer(true);
            }}
            className="text-left min-w-0"
          >
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
              {account.name}
            </h2>
            <p className="text-xs font-semibold text-[var(--brand)] truncate">
              {trustScore && account.kind === 'customer'
                ? `Trust ${trustScore.score}/100 · ${trustScore.recoveryTimingHint}`
                : 'View Profile'}
              {account.creditLimit ? ` · Limit ₹${account.creditLimit.toLocaleString('en-IN')}` : ''}
              {account.promiseDate ? ` · Promise ${account.promiseDate}` : ''}
            </p>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenParchiScanner && (
            <button
              type="button"
              onClick={onOpenParchiScanner}
              aria-label="Scan Parchi"
              title="Scan Parchi (AI)"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print PDF Statement"
            title="Print / Save PDF Statement"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search entries"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="no-print bg-[var(--surface)] border-b border-[var(--surface-border)] px-4 py-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or ₹ amount..."
            className="w-full min-h-[40px] rounded-xl bg-black/5 dark:bg-white/10 px-3 text-sm outline-none"
          />
        </div>
      )}

      {/* Timeline Filter Strip */}
      {transactions.length > 0 && (
        <div className="no-print bg-[var(--surface)] border-b border-[var(--surface-border)] px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All Entries' },
              { id: 'given', label: 'Udhaar (Given)' },
              { id: 'received', label: 'Jama (Received)' },
              { id: 'photos', label: 'Bill Photos' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTimelineFilter(f.id)}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-bold whitespace-nowrap border transition ${
                timelineFilter === f.id
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'border-[var(--surface-border)] text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="no-print mx-3 mt-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Printable Header Summary (Visible in Print/PDF) */}
      <div className="hidden print:block p-6 border-b border-slate-300">
        <h1 className="text-2xl font-bold">{business.name} — Customer Statement</h1>
        <p className="text-sm">
          Party: {account.name} {account.phone ? `(${account.phone})` : ''} | Net Balance:{' '}
          {formatINR(absBal)} {balLabel}
        </p>
      </div>

      {/* 2-Column Chat-Style Timeline */}
      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
        {timeline.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 max-w-xs">
              All transactions between you and {account.name} are totally private &amp; synced
              securely.
            </p>
          </div>
        ) : (
          timeline.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              <div className="flex justify-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-[var(--surface)] border border-[var(--surface-border)] px-3 py-1 rounded-lg">
                  {group.dateLabel}
                </span>
              </div>

              {group.items.map(({ tx, runningBalance }) => {
                const isGiven = tx.direction === 'given';
                const armed = armedDeleteTxId === tx.id;
                const metaParts: string[] = [];
                if (tx.createdByName) metaParts.push(tx.createdByName);
                if (tx.gallaSynced) metaParts.push('Galla Synced');
                return (
                  <div
                    key={tx.id}
                    className={`flex flex-col ${isGiven ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] sm:max-w-[65%] rounded-2xl bg-[var(--surface)] border px-4 py-3 shadow-xs space-y-1.5 ${
                        isGiven
                          ? 'border-red-200 dark:border-red-900/60'
                          : 'border-emerald-200 dark:border-emerald-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          {isGiven ? (
                            <ArrowUp className="w-4 h-4 text-red-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span
                            className={`text-xl font-extrabold font-tabular ${
                              isGiven ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {formatINR(tx.amount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <span>{formatTimeOnly(tx.billDate)}</span>
                          <Check className="w-3.5 h-3.5 text-[var(--brand)]" />
                          <button
                            type="button"
                            onClick={() => openEditCalculator(tx)}
                            aria-label={`Edit entry ${formatINR(tx.amount)}`}
                            className="no-print ml-1 p-1 rounded text-slate-400 hover:text-[var(--brand)] transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (armed) {
                                setArmedDeleteTxId(null);
                                setActionError('');
                                try {
                                  await onDeleteTransaction(tx);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error ? err.message : 'Failed to delete entry.'
                                  );
                                }
                              } else {
                                setArmedDeleteTxId(tx.id);
                              }
                            }}
                            aria-label={`Delete entry ${formatINR(tx.amount)}`}
                            className={`no-print px-1.5 py-0.5 rounded text-[11px] font-bold transition ${
                              armed
                                ? 'bg-red-600 text-white'
                                : 'text-slate-400 hover:text-red-600'
                            }`}
                          >
                            {armed ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {(tx.note || tx.voiceRaw) && (
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {tx.note || `"${tx.voiceRaw}"`}
                        </p>
                      )}

                      {metaParts.length > 0 && (
                        <p className="text-[10px] font-semibold text-slate-400">
                          {metaParts.join(' · ')}
                        </p>
                      )}

                      {tx.billImage &&
                        (brokenImgIds[tx.id] ? (
                          <span className="inline-block text-[11px] font-semibold text-slate-400 italic pt-1">
                            Bill photo unavailable
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(tx.billImage)}
                            className="block pt-1"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={tx.billImage}
                              alt="Bill attachment"
                              onError={() =>
                                setBrokenImgIds((prev) => ({ ...prev, [tx.id]: true }))
                              }
                              className="max-h-28 rounded-lg border border-[var(--surface-border)] object-cover"
                            />
                          </button>
                        ))}
                    </div>

                    <span className="mt-1 px-1 text-[11px] font-semibold font-tabular text-slate-500 dark:text-slate-400">
                      {formatINR(Math.abs(runningBalance))}{' '}
                      {runningBalance > 0 ? t.due : runningBalance < 0 ? t.advance : t.settled}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom Quick Action Bar + Sticky Received / Voice / Given */}
      <div className="no-print bg-[var(--surface)] border-t border-[var(--surface-border)] px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <a
              href={account.phone ? `tel:${account.phone}` : '#'}
              onClick={(e) => {
                if (!account.phone) {
                  e.preventDefault();
                  setShowProfileDrawer(true);
                }
              }}
              aria-label="Call customer"
              className="w-10 h-10 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Phone className="w-4 h-4" />
            </a>
            <a
              href={`sms:${account.phone || ''}?body=${encodeURIComponent(reminderMsg)}`}
              aria-label="Send SMS reminder"
              className="w-10 h-10 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
            <a
              href={buildWhatsAppUrl(account.phone, reminderMsg)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Send WhatsApp reminder"
              className="w-10 h-10 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              aria-label="Show UPI QR"
              className="w-10 h-10 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditDueDate(account.dueDate || '');
                setEditPromiseDate(account.promiseDate || '');
                setEditPromiseNote(account.promiseNote || '');
                setShowDueModal(true);
              }}
              aria-label="Set due date or promise date"
              className="w-10 h-10 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">Balance {balLabel}</p>
            <p
              className={`text-base font-extrabold font-tabular ${
                account.balance > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {formatINR(absBal)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openCalculator('received')}
            className="flex-1 min-h-[50px] rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-extrabold text-sm flex items-center justify-center gap-1.5 transition"
          >
            <ArrowDown className="w-4 h-4" />
            <span>{t.received}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenVoiceForCustomer(account.name)}
            aria-label="Voice entry for this customer"
            className="w-14 min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] flex items-center justify-center shrink-0 shadow-sm"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => openCalculator('given')}
            className="flex-1 min-h-[50px] rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-extrabold text-sm flex items-center justify-center gap-1.5 transition"
          >
            <ArrowUp className="w-4 h-4" />
            <span>{t.given}</span>
          </button>
        </div>
      </div>

      {/* Customer Profile / Edit Modal */}
      {showProfileDrawer && (
        <div
          onClick={() => {
            if (!profileSaving) setShowProfileDrawer(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[var(--brand)]" />
                <span>Party Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileDrawer(false)}
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editPhone}
                  onChange={(e) => {
                    setProfileError('');
                    setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  }}
                  placeholder="9876543210"
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold font-tabular"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-xs font-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Promise-to-Pay Date
                  </label>
                  <input
                    type="date"
                    value={editPromiseDate}
                    onChange={(e) => setEditPromiseDate(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-xs font-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Credit Limit (₹ Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  placeholder="e.g. 5000 (0 = No Limit)"
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold font-tabular"
                />
              </div>
            </div>

            {profileError && <p className="text-xs font-bold text-red-600">{profileError}</p>}

            <button
              type="button"
              disabled={profileSaving}
              onClick={async () => {
                setProfileError('');
                if (editPhone && !isValidIndianMobile(editPhone)) {
                  setProfileError('Enter a valid 10-digit Indian mobile number.');
                  return;
                }
                setProfileSaving(true);
                try {
                  await onUpdateAccount({
                    name: editName.trim() || account.name,
                    phone: editPhone.trim(),
                    dueDate: editDueDate,
                    promiseDate: editPromiseDate,
                    creditLimit: Math.max(0, Number(editCreditLimit) || 0),
                  });
                  setShowProfileDrawer(false);
                } catch (err) {
                  setProfileError(
                    err instanceof Error ? err.message : 'Failed to save party profile.'
                  );
                } finally {
                  setProfileSaving(false);
                }
              }}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold disabled:opacity-60"
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>

            <div className="pt-2 border-t border-[var(--surface-border)]">
              {!confirmDeleteCustomer ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCustomer(true)}
                  className="w-full min-h-[44px] rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Delete Party &amp; Ledger
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-red-600 text-center">
                    Permanently delete {account.name} and all entries?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={profileSaving}
                      onClick={async () => {
                        setProfileSaving(true);
                        setProfileError('');
                        try {
                          await onDeleteAccount();
                        } catch (err) {
                          setProfileError(
                            err instanceof Error ? err.message : 'Failed to delete party.'
                          );
                          setProfileSaving(false);
                        }
                      }}
                      className="min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                    >
                      {profileSaving ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCustomer(false)}
                      className="min-h-[44px] rounded-xl bg-black/5 dark:bg-white/10 text-sm font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPI QR Payment Modal */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 text-center space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Collect via UPI QR</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {business.upiId
                ? `UPI ID: ${business.upiId}`
                : 'Set your real UPI ID in Settings for live payments'}
            </p>
            <div className="mx-auto w-fit p-4 bg-white rounded-2xl border border-slate-200">
              <QRCodeSVG value={upiUri} size={180} />
            </div>
            <p className="text-xl font-extrabold font-tabular text-[var(--brand)]">
              {account.balance > 0 ? formatINR(account.balance) : 'Any Amount'}
            </p>
            <a
              href={buildWhatsAppUrl(account.phone, reminderMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share Reminder on WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* Due Date & Promise-to-Pay Quick Picker */}
      {showDueModal && (
        <div
          onClick={() => {
            if (!dueSaving) setShowDueModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
          >
            <h3 className="text-lg font-extrabold">Due Date &amp; Payment Promise</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Collection Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Customer Promise-to-Pay Date
                </label>
                <input
                  type="date"
                  value={editPromiseDate}
                  onChange={(e) => setEditPromiseDate(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Promise Note (Optional)
                </label>
                <input
                  type="text"
                  value={editPromiseNote}
                  onChange={(e) => setEditPromiseNote(e.target.value)}
                  placeholder="e.g. Kal shaam ko UPI karega"
                  className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
                />
              </div>
            </div>
            {dueError && <p className="text-xs font-bold text-red-600">{dueError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={dueSaving}
                onClick={async () => {
                  setDueError('');
                  setDueSaving(true);
                  try {
                    await onUpdateAccount({
                      dueDate: editDueDate,
                      promiseDate: editPromiseDate,
                      promiseNote: editPromiseNote.trim(),
                    });
                    setShowDueModal(false);
                  } catch (err) {
                    setDueError(err instanceof Error ? err.message : 'Failed to save dates.');
                  } finally {
                    setDueSaving(false);
                  }
                }}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold disabled:opacity-60"
              >
                {dueSaving ? 'Saving...' : 'Save Dates'}
              </button>
              <button
                type="button"
                disabled={dueSaving}
                onClick={() => setShowDueModal(false)}
                className="min-h-[46px] rounded-xl bg-black/5 dark:bg-white/10 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Image Lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Attached bill"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
