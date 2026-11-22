'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Delete,
  Edit3,
  Eye,
  EyeOff,
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
  buildTransactionSlipMessage,
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
import { getPersonaCapabilities, type PersonaCapabilities } from '@/lib/persona';
import type {
  Business,
  CashbookMode,
  CustomerTrustScore,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  TxDirection,
} from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';

export interface PartyStatementViewProps {
  account: LedgerAccount;
  business: Business;
  language: LanguageCode;
  transactions: LedgerTransaction[];
  trustScore?: CustomerTrustScore;
  capabilities?: PersonaCapabilities;
  hideBalance?: boolean;
  onToggleHideBalance?: () => void;
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

const DETAIL_SPRING = { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.85 };
const ACCORDION_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

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

/**
 * Z-Axis Foreground Party Statement View (`layoutId={`party-card-${account.id}`}`).
 * Chronological financial timeline cards with tap-to-expand inline accordion drawer
 * ('Edit', 'Delete (with Undo)', 'Share WhatsApp Slip') and swipe-right dismiss gesture.
 */
export const PartyStatementView: React.FC<PartyStatementViewProps> = ({
  account,
  business,
  language,
  transactions,
  trustScore,
  capabilities: capabilitiesProp,
  hideBalance = false,
  onToggleHideBalance,
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
  const prefersReducedMotion = useReducedMotion();
  const sheetDragControls = useDragControls();
  const capabilities = useMemo(
    () => capabilitiesProp || getPersonaCapabilities(account.personaContext || 'kirana'),
    [capabilitiesProp, account.personaContext]
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'given' | 'received' | 'photos'>(
    'all'
  );
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [swipeBackX, setSwipeBackX] = useState(0);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
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

  // Swipe-right scrub back to cockpit without interfering with vertical timeline scroll
  const bindSwipeBack = useDrag(
    ({ down, movement: [mx], velocity: [vx], tap }) => {
      if (tap) return;
      if (down) {
        if (mx > 0) setSwipeBackX(Math.min(180, mx * 0.72));
      } else {
        if (mx > 90 || (mx > 45 && vx > 0.45)) {
          haptics.swipe();
          setSwipeBackX(0);
          onBack();
        } else {
          setSwipeBackX(0);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      threshold: 14,
    }
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewImage) setPreviewImage(null);
      else if (showDueModal && !dueSaving) setShowDueModal(false);
      else if (showQrModal) setShowQrModal(false);
      else if (showProfileDrawer && !profileSaving) setShowProfileDrawer(false);
      else if (calcDirection && !calcSaving) setCalcDirection(null);
      else onBack();
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
    onBack,
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
    haptics.tap();
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
    haptics.tap();
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
    haptics.tap();
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
          syncToGalla: capabilities.showGalla && syncGallaMode ? { mode: syncGallaMode } : null,
        });
      }
      haptics.success();
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
      // Ignore speech error
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
      <div className="fixed inset-0 z-50 bg-black/50 flex justify-center">
        <div className="w-full max-w-[460px] spatial-shell-bg flex-1 flex flex-col justify-between p-4 pb-safe shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  setCalcDirection(null);
                }}
                aria-label="Back to ledger"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div
                style={{ backgroundColor: getAvatarColor(account.name) }}
                className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0 shadow-sm"
              >
                {account.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-display text-base font-extrabold text-[var(--ink)] leading-tight">
                  {editingTx ? `Edit · ${account.name}` : account.name}
                </h2>
                <p
                  className={`text-xs font-bold font-tabular ${
                    calcDirection === 'given'
                      ? 'text-[var(--credit-red)]'
                      : 'text-[var(--debit-green)]'
                  }`}
                >
                  {calcDirection === 'given' ? 'Credit (Given)' : 'Payment Received'} ·{' '}
                  {hideBalance ? '₹••••' : formatINR(absBal)} {balLabel}
                </p>
              </div>
            </div>
            {editingTx && (
              <div className="flex gap-1.5">
                {(['received', 'given'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setCalcDirection(d);
                    }}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold active:scale-95 transition ${
                      calcDirection === d
                        ? d === 'given'
                          ? 'bg-[var(--credit-red)] text-white shadow-sm'
                          : 'bg-[var(--debit-green)] text-white shadow-sm'
                        : 'spatial-card text-[var(--ink)]'
                    }`}
                  >
                    {d === 'given' ? 'Given' : 'Received'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="py-4 text-center space-y-1.5">
            <div
              className={`font-display text-5xl font-extrabold font-tabular tracking-tight ${
                calcDirection === 'given'
                  ? 'text-[var(--credit-red)]'
                  : 'text-[var(--debit-green)]'
              }`}
            >
              ₹{calcExpr}
            </div>
            {/[+\-×]/.test(calcExpr) && (
              <p className="text-sm font-bold font-tabular text-[var(--ink-muted)]">
                = {formatINR(calcNumericAmount)}
              </p>
            )}
            {calcLimitWarning && (
              <p className="inline-flex items-center gap-1.5 text-xs font-bold font-tabular text-[var(--alert-amber)] bg-[var(--alert-tint)] rounded-2xl px-3.5 py-1.5 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Limit {formatINR(calcLimitWarning.limit)} exceeded by{' '}
                  {formatINR(calcLimitWarning.excess)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-2xl spatial-card px-3.5 min-h-[48px]">
              <Receipt className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
              <input
                type="text"
                value={calcNote}
                onChange={(e) => setCalcNote(e.target.value)}
                placeholder="Add Notes (e.g. 2kg chini, atta)"
                className="flex-1 bg-transparent text-sm font-medium text-[var(--ink)] outline-none"
              />
              <button
                type="button"
                onClick={handleDictateNote}
                aria-label="Speak note"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--brand-accent)] hover:bg-[var(--brand-tint)] active:scale-95 transition"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between gap-2 rounded-2xl spatial-card px-3.5 min-h-[46px] text-xs font-bold text-[var(--ink)] cursor-pointer">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[var(--brand-accent)]" />
                  <span>Date</span>
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
                className="flex items-center justify-between gap-2 rounded-2xl spatial-card px-3.5 min-h-[46px] text-xs font-bold text-[var(--ink)] active:scale-95 transition"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[var(--brand-accent)]" />
                  <span>{calcBillImage ? 'Photo Added ✓' : 'Add Photo'}</span>
                </span>
                <span className="text-[var(--brand-accent)] text-base leading-none">+</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBillPhotoChange}
                className="hidden"
              />
            </div>

            {!editingTx && capabilities.showGalla && (
              <div className="flex items-center justify-between gap-2 rounded-2xl spatial-card px-3.5 py-2">
                <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                  Sync to Today&apos;s Galla
                </span>
                <div className="flex items-center gap-1.5">
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
                      onClick={() => {
                        haptics.tap();
                        setSyncGallaMode(opt.id);
                      }}
                      className={`min-h-[34px] px-3 rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                        syncGallaMode === opt.id
                          ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                          : 'bg-[var(--app-bg)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {calcError && (
              <p className="text-xs font-bold text-[var(--credit-red)] text-center">{calcError}</p>
            )}

            <div className="flex gap-2.5 pt-1">
              {calcDirection === 'given' && capabilities.showGstBills && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setCalcDirection(null);
                    onOpenCreateBill(account.name, account.phone);
                  }}
                  className="min-h-[52px] px-4 rounded-2xl spatial-card text-sm font-bold text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition"
                >
                  <FileText className="w-4 h-4 text-[var(--brand-accent)]" />
                  <span>Create Bill</span>
                </button>
              )}
              <button
                type="button"
                disabled={calcSaving}
                onClick={handleConfirmCalc}
                className="flex-1 min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-base flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
              >
                <Check className="w-5 h-5" />
                <span>{calcSaving ? 'Saving...' : 'Confirm'}</span>
              </button>
            </div>
          </div>

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
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-md'
                      : isOp
                        ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                        : 'spatial-card text-[var(--ink)]'
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

  let runningRowIdx = 0;

  return (
    <motion.div
      layoutId={`party-card-${account.id}`}
      transition={DETAIL_SPRING}
      drag={prefersReducedMotion ? false : 'y'}
      dragControls={sheetDragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.42 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 95 || info.velocity.y > 420) {
          haptics.swipe();
          onBack();
        }
      }}
      {...(bindSwipeBack() as Record<string, unknown>)}
      style={{
        x: prefersReducedMotion ? 0 : swipeBackX,
        touchAction: 'pan-y',
      }}
      className="flex flex-col h-full rounded-[34px] spatial-card overflow-hidden bg-[var(--surface)] will-change-transform"
    >
      {/* Drag-Down Pull Bar for Z-Axis Sheet Dismiss */}
      <div
        onPointerDown={(e) => sheetDragControls.start(e)}
        aria-label="Pull down to close statement"
        className="no-print pt-2 pb-0.5 flex justify-center bg-[var(--surface)] cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)]" />
      </div>

      {/* Statement Header Bar */}
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, a, input')) return;
          sheetDragControls.start(e);
        }}
        className="no-print bg-[var(--surface)] shadow-[0_6px_18px_-10px_rgba(15,23,42,0.08)] px-3 py-2 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onBack();
            }}
            aria-label="Back to Ledger"
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            style={{ backgroundColor: getAvatarColor(account.name) }}
            className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0 shadow-xs"
          >
            {account.name.charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setEditName(account.name);
              setEditPhone(account.phone);
              setEditDueDate(account.dueDate);
              setEditPromiseDate(account.promiseDate || '');
              setEditPromiseNote(account.promiseNote || '');
              setEditCreditLimit(account.creditLimit ? String(account.creditLimit) : '');
              setConfirmDeleteCustomer(false);
              setShowProfileDrawer(true);
            }}
            className="text-left min-w-0 min-h-[44px] flex flex-col justify-center"
          >
            <h2 className="font-display text-base font-extrabold text-[var(--ink)] truncate">
              {account.name}
            </h2>
            <p className="text-[11px] font-semibold text-[var(--brand-accent)] truncate">
              {trustScore && account.kind === 'customer'
                ? `Trust ${trustScore.score}%`
                : 'View Profile'}
              {account.creditLimit ? ` · Limit ₹${account.creditLimit.toLocaleString('en-IN')}` : ''}
              {account.promiseDate ? ` · Promise ${account.promiseDate}` : ''}
            </p>
          </button>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onToggleHideBalance && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onToggleHideBalance();
              }}
              aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {onOpenParchiScanner && capabilities.focus !== 'personal' && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenParchiScanner();
              }}
              aria-label="Scan Receipt"
              title="Scan Receipt (AI)"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              window.print();
            }}
            aria-label="Print PDF Statement"
            title="Print / Save PDF Statement"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSearchOpen((v) => !v);
            }}
            aria-label="Search entries"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="no-print bg-[var(--surface)] px-4 py-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or ₹ amount..."
            className="w-full min-h-[42px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          />
        </div>
      )}

      {/* Timeline Filter Strip */}
      {transactions.length > 0 && (
        <div className="no-print bg-[var(--surface)] px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'given', label: 'Credit' },
              { id: 'received', label: 'Received' },
              { id: 'photos', label: 'Photos' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                haptics.tap();
                setTimelineFilter(f.id);
              }}
              className={`min-h-[34px] px-3.5 rounded-full text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
                timelineFilter === f.id
                  ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                  : 'bg-[var(--app-bg)] text-[var(--ink-muted)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="no-print mx-3 mt-2 rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError('')}
            aria-label="Dismiss error"
            className="min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Printable Header Summary */}
      <div className="hidden print:block p-6 border-b border-slate-300">
        <h1 className="text-2xl font-bold">{business.name} — Party Statement</h1>
        <p className="text-sm">
          Party: {account.name} {account.phone ? `(${account.phone})` : ''} | Net Balance:{' '}
          {formatINR(absBal)} {balLabel}
        </p>
      </div>

      {/* Chronological Financial Timeline Cards (Zero Chat Bubbles — Tap Row to Expand Accordion) */}
      <div className="flex-1 bg-[var(--app-bg)] p-3.5 space-y-4 overflow-y-auto no-scrollbar">
        {timeline.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[var(--ink-muted)] max-w-xs">
              All entries with {account.name} are private on your device &amp; ready for quick
              recording.
            </p>
          </div>
        ) : (
          timeline.map((group) => (
            <div key={group.dateLabel} className="space-y-2.5">
              <div className="flex justify-center">
                <span className="text-[11px] font-extrabold text-[var(--ink-muted)] bg-[var(--surface)] shadow-xs px-3 py-1 rounded-full">
                  {group.dateLabel}
                </span>
              </div>

              {group.items.map(({ tx, runningBalance }) => {
                const isGiven = tx.direction === 'given';
                const isExpanded = expandedTxId === tx.id;
                const delaySec = Math.min(runningRowIdx++, 10) * 0.025;
                const metaParts: string[] = [formatTimeOnly(tx.billDate)];
                if (tx.createdByName) metaParts.push(tx.createdByName);
                if (tx.gallaSynced) metaParts.push('Galla');

                const slipUrl = buildWhatsAppUrl(
                  account.phone,
                  buildTransactionSlipMessage({
                    customerName: account.name,
                    direction: tx.direction,
                    amount: tx.amount,
                    newBalance: runningBalance,
                    shopName: business.name,
                    upiId: business.upiId,
                    language,
                  })
                );

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28, delay: delaySec }}
                    className="rounded-[22px] spatial-card overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => {
                        haptics.tap();
                        setExpandedTxId((prev) => (prev === tx.id ? null : tx.id));
                      }}
                      className="w-full p-3.5 flex items-start justify-between gap-3 text-left focus:outline-none"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span
                          className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 ${
                            isGiven ? 'bg-[var(--credit-red)]' : 'bg-[var(--debit-green)]'
                          }`}
                        >
                          <svg viewBox="0 0 18 18" className="w-4 h-4" fill="none" aria-hidden="true">
                            <motion.path
                              d={isGiven ? 'M9 14V4m0 0-4 4m4-4 4 4' : 'M9 4v10m0 0-4-4m4 4 4-4'}
                              stroke="currentColor"
                              strokeWidth="2.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: delaySec }}
                            />
                          </svg>
                        </span>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-extrabold uppercase tracking-wider ${
                                isGiven ? 'text-[var(--credit-red)]' : 'text-[var(--debit-green)]'
                              }`}
                            >
                              {isGiven ? 'Credit Given' : 'Payment Received'}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-[var(--ink-muted)] transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </div>

                          {(tx.note || tx.voiceRaw) && (
                            <p className="text-sm font-bold text-[var(--ink)] leading-snug break-words">
                              {tx.note || `"${tx.voiceRaw}"`}
                            </p>
                          )}

                          <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                            {metaParts.join(' · ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`font-display text-lg font-extrabold font-tabular leading-tight ${
                            isGiven ? 'text-[var(--credit-red)]' : 'text-[var(--debit-green)]'
                          }`}
                        >
                          {isGiven ? '-' : '+'}
                          {hideBalance ? '₹••••' : formatINR(tx.amount)}
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-[var(--app-bg)] text-[10px] font-bold font-tabular text-[var(--ink-muted)]">
                          Bal:{' '}
                          {hideBalance
                            ? '₹••••'
                            : `${formatINR(Math.abs(runningBalance))} ${
                                runningBalance > 0
                                  ? t.due
                                  : runningBalance < 0
                                    ? t.advance
                                    : t.settled
                              }`}
                        </span>
                      </div>
                    </button>

                    {tx.billImage && (
                      <div className="px-3.5 pb-2.5">
                        {brokenImgIds[tx.id] ? (
                          <span className="inline-block text-[11px] font-semibold text-[var(--ink-muted)] italic">
                            Photo unavailable
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(tx.billImage)}
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={tx.billImage}
                              alt="Attachment"
                              onError={() =>
                                setBrokenImgIds((prev) => ({ ...prev, [tx.id]: true }))
                              }
                              className="max-h-28 rounded-xl object-cover shadow-sm"
                            />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Accordion Drawer beneath tapped timeline entry */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`accordion-${tx.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: { duration: 0.16, ease: 'easeOut' },
                          }}
                          transition={ACCORDION_SPRING}
                          className="no-print overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 border-t border-[var(--surface-subtle)] grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => openEditCalculator(tx)}
                              className="min-h-[38px] px-2.5 rounded-xl bg-[var(--app-bg)] text-[var(--ink)] text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              disabled={deletingTxId === tx.id}
                              onClick={async () => {
                                haptics.tap();
                                setActionError('');
                                setDeletingTxId(tx.id);
                                try {
                                  await onDeleteTransaction(tx);
                                  setExpandedTxId(null);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error ? err.message : 'Failed to delete entry.'
                                  );
                                } finally {
                                  setDeletingTxId(null);
                                }
                              }}
                              className="min-h-[38px] px-2.5 rounded-xl bg-[var(--credit-tint)] text-[var(--credit-red)] text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{deletingTxId === tx.id ? 'Removing...' : 'Delete'}</span>
                            </button>

                            <a
                              href={slipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => haptics.tap()}
                              className="min-h-[38px] px-2.5 rounded-xl bg-[var(--debit-tint)] text-[var(--debit-green)] text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition"
                            >
                              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>WhatsApp Slip</span>
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Sticky Bottom Quick Strip + 2 Primary Action Buttons (+ Jama Green, + Udhaar Red, Mic) */}
      <div className="no-print bg-[var(--surface)] shadow-[0_-10px_24px_-12px_rgba(15,23,42,0.1)] px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <a
              href={account.phone ? `tel:${account.phone}` : '#'}
              onClick={(e) => {
                haptics.tap();
                if (!account.phone) {
                  e.preventDefault();
                  setShowProfileDrawer(true);
                }
              }}
              aria-label="Call party"
              className="w-10 h-10 rounded-2xl bg-[var(--app-bg)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <Phone className="w-4 h-4" />
            </a>
            <a
              href={`sms:${account.phone || ''}?body=${encodeURIComponent(reminderMsg)}`}
              onClick={() => haptics.tap()}
              aria-label="Send SMS reminder"
              className="w-10 h-10 rounded-2xl bg-[var(--app-bg)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
            <a
              href={buildWhatsAppUrl(account.phone, reminderMsg)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptics.tap()}
              aria-label="Send WhatsApp reminder"
              className="w-10 h-10 rounded-2xl bg-[var(--debit-tint)] flex items-center justify-center text-[var(--debit-green)] active:scale-95 transition"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setShowQrModal(true);
              }}
              aria-label="Show UPI QR"
              className="w-10 h-10 rounded-2xl bg-[var(--app-bg)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                setEditDueDate(account.dueDate || '');
                setEditPromiseDate(account.promiseDate || '');
                setEditPromiseNote(account.promiseNote || '');
                setShowDueModal(true);
              }}
              aria-label="Set due date or promise date"
              className="w-10 h-10 rounded-2xl bg-[var(--app-bg)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Balance {balLabel}
            </p>
            <p
              className={`font-display text-lg font-extrabold font-tabular ${
                account.balance > 0
                  ? 'text-[var(--credit-red)]'
                  : account.balance < 0
                    ? 'text-[var(--debit-green)]'
                    : 'text-[var(--ink)]'
              }`}
            >
              <OdometerNumber value={absBal} hidden={hideBalance} />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => openCalculator('received')}
            className="flex-1 min-h-[48px] rounded-2xl bg-[var(--debit-tint)] text-[var(--debit-green)] font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <ArrowDown className="w-4 h-4" />
            <span>+ Received</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptics.orbTap();
              onOpenVoiceForCustomer(account.name);
            }}
            aria-label="Voice entry for this party"
            style={{ backgroundColor: 'var(--brand)' }}
            className="w-14 min-h-[48px] rounded-2xl text-white flex items-center justify-center shrink-0 tactile-key-primary transition"
          >
            <Mic className="w-5 h-5" />
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => openCalculator('given')}
            className="flex-1 min-h-[48px] rounded-2xl bg-[var(--credit-tint)] text-[var(--credit-red)] font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <ArrowUp className="w-4 h-4" />
            <span>+ Credit</span>
          </motion.button>
        </div>
      </div>

      {/* Party Profile / Edit Bottom Sheet */}
      <AnimatePresence>
        {showProfileDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!profileSaving) setShowProfileDrawer(false);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 && !profileSaving) setShowProfileDrawer(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-6 space-y-4 max-h-[90dvh] overflow-y-auto no-scrollbar pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold flex items-center gap-2 text-[var(--ink)]">
                  <UserCog className="w-5 h-5 text-[var(--brand-accent)]" />
                  <span>Party Profile</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProfileDrawer(false)}
                  aria-label="Close profile"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => {
                      setProfileError('');
                      setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    }}
                    placeholder="9876543210"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3 text-xs font-tabular text-[var(--ink)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                      Promise-to-Pay Date
                    </label>
                    <input
                      type="date"
                      value={editPromiseDate}
                      onChange={(e) => setEditPromiseDate(e.target.value)}
                      className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3 text-xs font-tabular text-[var(--ink)] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Credit Limit (₹ Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                    placeholder="e.g. 5000 (0 = No Limit)"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold font-tabular text-[var(--ink)] outline-none"
                  />
                </div>
              </div>

              {profileError && (
                <p className="text-xs font-bold text-[var(--credit-red)]">{profileError}</p>
              )}

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
                className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold disabled:opacity-60 shadow-md active:scale-95 transition"
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>

              <div className="pt-2">
                {!confirmDeleteCustomer ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCustomer(true)}
                    className="w-full min-h-[44px] rounded-2xl text-sm font-bold text-[var(--credit-red)] hover:bg-[var(--credit-tint)] active:scale-95 transition"
                  >
                    Delete Party &amp; Ledger
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[var(--credit-red)] text-center">
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
                        className="min-h-[44px] rounded-2xl bg-[var(--credit-red)] text-white text-sm font-bold disabled:opacity-60 active:scale-95 transition"
                      >
                        {profileSaving ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCustomer(false)}
                        className="min-h-[44px] rounded-2xl bg-[var(--app-bg)] text-sm font-bold text-[var(--ink)] active:scale-95 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UPI QR Payment Bottom Sheet */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQrModal(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90) setShowQrModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-6 text-center space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Collect via UPI QR
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  aria-label="Close QR"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                {business.upiId
                  ? `UPI ID: ${business.upiId}`
                  : 'Set your real UPI ID in Settings for live payments'}
              </p>
              <div className="mx-auto w-fit p-4 bg-white rounded-3xl shadow-md">
                <QRCodeSVG value={upiUri} size={180} />
              </div>
              <p className="font-display text-xl font-extrabold font-tabular text-[var(--brand-accent)]">
                {account.balance > 0 ? formatINR(account.balance) : 'Any Amount'}
              </p>
              <a
                href={buildWhatsAppUrl(account.phone, reminderMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] rounded-2xl bg-[var(--debit-green)] text-white font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share Reminder on WhatsApp</span>
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Due Date & Promise-to-Pay Bottom Sheet */}
      <AnimatePresence>
        {showDueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!dueSaving) setShowDueModal(false);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 && !dueSaving) setShowDueModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-6 space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                Due Date &amp; Payment Promise
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Collection Due Date
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 font-tabular text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Promise-to-Pay Date
                  </label>
                  <input
                    type="date"
                    value={editPromiseDate}
                    onChange={(e) => setEditPromiseDate(e.target.value)}
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 font-tabular text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Promise Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={editPromiseNote}
                    onChange={(e) => setEditPromiseNote(e.target.value)}
                    placeholder="e.g. Kal shaam ko UPI karega"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm text-[var(--ink)]"
                  />
                </div>
              </div>
              {dueError && <p className="text-xs font-bold text-[var(--credit-red)]">{dueError}</p>}
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
                  className="min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold disabled:opacity-60 active:scale-95 transition"
                >
                  {dueSaving ? 'Saving...' : 'Save Dates'}
                </button>
                <button
                  type="button"
                  disabled={dueSaving}
                  onClick={() => setShowDueModal(false)}
                  className="min-h-[46px] rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] font-bold active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bill Image Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Attached bill"
              className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
