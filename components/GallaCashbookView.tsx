'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  Eye,
  EyeOff,
  Landmark,
  MinusCircle,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useBackStack } from '@/hooks/useBackStack';
import { formatDateTime, formatINR, getLocalDateKey } from '@/lib/i18n';
import { computeDailyGallaPulse } from '@/lib/ucred-intelligence';
import type {
  BillDocument,
  CashbookEntry,
  CashbookEntryType,
  CashbookMode,
  LedgerTransaction,
  StockItem,
} from '@/lib/types';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
import { SNAPPY_SPRING, calculateStaggerDelay } from './motion/SpatialMotionEngine';

interface GallaCashbookViewProps {
  cashbookEntries: CashbookEntry[];
  transactions: LedgerTransaction[];
  bills: BillDocument[];
  stockItems: StockItem[];
  activeOperatorName: string;
  hideBalance?: boolean;
  onToggleHideBalance?: () => void;
  onAddEntry: (payload: {
    entryType: CashbookEntryType;
    mode: CashbookMode;
    category: string;
    amount: number;
    note: string;
    entryDate: string;
  }) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onBack?: () => void;
}

const INFLOW_CATEGORIES = ['Cash Sale', 'Opening Cash', 'Collection', 'Other Income'];
const OUTFLOW_CATEGORIES = ['Expense', 'Staff & Petty', 'Supplier Payment', 'Rent & Utilities', 'Withdrawal'];
const SEG_SPRING = SNAPPY_SPRING;

export const GallaCashbookView: React.FC<GallaCashbookViewProps> = ({
  cashbookEntries,
  transactions,
  bills,
  stockItems,
  activeOperatorName,
  hideBalance = false,
  onToggleHideBalance,
  onAddEntry,
  onDeleteEntry,
  onBack,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const todayStr = getLocalDateKey();
  const [dateScope, setDateScope] = useState<'today' | 'all'>('today');
  const [modeFilter, setModeFilter] = useState<'all' | CashbookMode>('all');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [listError, setListError] = useState('');

  const [modalType, setModalType] = useState<CashbookEntryType | null>(null);
  const [mode, setMode] = useState<CashbookMode>('cash');
  const [category, setCategory] = useState('Cash Sale');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showDenomSheet, setShowDenomSheet] = useState(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({
    500: '',
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    1: '',
  });
  const [denomPosting, setDenomPosting] = useState(false);

  useBackStack(Boolean(modalType && !saving), () => setModalType(null));
  useBackStack(showDenomSheet && !denomPosting, () => setShowDenomSheet(false));

  const denomNotes = useMemo(() => [500, 200, 100, 50, 20, 10, 1] as const, []);
  const denomTotal = useMemo(() => {
    return denomNotes.reduce((sum, face) => {
      const count = Math.max(0, Math.floor(Number(denomCounts[face]) || 0));
      return sum + face * count;
    }, 0);
  }, [denomCounts, denomNotes]);

  const pulse = useMemo(
    () =>
      computeDailyGallaPulse({
        todayStr,
        cashbookEntries,
        transactions,
        bills,
        stockItems,
      }),
    [todayStr, cashbookEntries, transactions, bills, stockItems]
  );

  const visibleEntries = useMemo(() => {
    return [...cashbookEntries]
      .filter((e) => {
        if (dateScope === 'today' && e.entryDate.slice(0, 10) !== todayStr) return false;
        if (modeFilter !== 'all' && e.mode !== modeFilter) return false;
        return true;
      })
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [cashbookEntries, dateScope, modeFilter, todayStr]);

  const openEntryModal = (type: CashbookEntryType) => {
    haptics.tap();
    setModalType(type);
    setMode('cash');
    setCategory(type === 'inflow' ? 'Cash Sale' : 'Expense');
    setAmount('');
    setNote('');
    setEntryDate(todayStr);
    setFormError('');
  };

  const handleSave = async () => {
    if (!modalType) return;
    setFormError('');
    const num = Math.round((Number(amount) || 0) * 100) / 100;
    if (num <= 0) {
      setFormError('Enter an amount greater than ₹0.');
      return;
    }
    setSaving(true);
    try {
      const nowTime = new Date().toTimeString().slice(0, 8);
      const isoDate = new Date(`${entryDate || todayStr}T${nowTime}`).toISOString();
      await onAddEntry({
        entryType: modalType,
        mode,
        category,
        amount: num,
        note: note.trim(),
        entryDate: isoDate,
      });
      haptics.success();
      setModalType(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save cashbook entry.');
    } finally {
      setSaving(false);
    }
  };

  const profitPositive = pulse.estimatedDailyProfit >= 0;

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[44px] min-h-[44px] rounded-full liquid-glass flex items-center justify-center active:scale-95 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--ink)]" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ink)] truncate">
              Cashbook
            </h2>
            <p className="text-xs font-medium text-[var(--ink-muted)] truncate">
              Cash drawer, UPI &amp; daily pulse · {activeOperatorName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setShowDenomSheet(true);
            }}
            aria-label="Count Cash Notes"
            className="min-h-[44px] px-3 rounded-full liquid-glass inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] active:scale-95 transition shrink-0"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
          {onToggleHideBalance && (
            <button
              type="button"
              onClick={onToggleHideBalance}
              aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
              className="min-w-[44px] min-h-[44px] rounded-full liquid-glass flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] active:scale-95 transition shrink-0"
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Top 50/50 Split Actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={SEG_SPRING}
          type="button"
          onClick={() => openEntryModal('inflow')}
          className="min-h-[48px] px-4 rounded-full bg-[var(--debit-green)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>Cash In</span>
        </motion.button>
        <motion.button
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={SEG_SPRING}
          type="button"
          onClick={() => openEntryModal('outflow')}
          className="min-h-[48px] px-4 rounded-full bg-[var(--credit-red)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition"
        >
          <MinusCircle className="w-4 h-4 shrink-0" />
          <span>Expense</span>
        </motion.button>
      </div>

      {/* Balances + Daily Profit Pulse (Unified Monochrome Ceramic Tiles) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-[22px] ios27-ceramic-tile p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--ink-muted)] tracking-wide">
              Cash Drawer
            </span>
            <span className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <p
            className={`font-display text-xl font-extrabold font-tabular ${
              pulse.cashDrawerBalance >= 0
                ? 'text-[var(--debit-green)]'
                : 'text-[var(--credit-red)]'
            }`}
          >
            {hideBalance ? '₹••••' : formatINR(pulse.cashDrawerBalance)}
          </p>
          <p className="text-[11px] font-medium text-[var(--ink-muted)] leading-snug">
            Physical cash net balance
          </p>
        </div>

        <div className="rounded-[22px] ios27-ceramic-tile p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--ink-muted)] tracking-wide">
              UPI &amp; Bank
            </span>
            <span className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <p className="font-display text-xl font-extrabold font-tabular text-[var(--ink)]">
            {hideBalance ? '₹••••' : formatINR(pulse.upiBankBalance)}
          </p>
          <p className="text-[11px] font-medium text-[var(--ink-muted)] font-tabular leading-snug">
            In {hideBalance ? '₹••' : formatINR(pulse.todayInflow)} · Out{' '}
            {hideBalance ? '₹••' : formatINR(pulse.todayOutflow)}
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 rounded-[22px] ios27-ceramic-tile p-4 flex lg:flex-col items-center lg:items-stretch justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                {profitPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Today&apos;s Profit Pulse
              </span>
            </div>
            <p className="text-xs font-medium text-[var(--ink-muted)] leading-snug">
              {pulse.profitBasisNote}
            </p>
          </div>
          <p
            className={`font-display text-2xl font-extrabold font-tabular shrink-0 ${
              profitPositive ? 'text-[var(--debit-green)]' : 'text-[var(--credit-red)]'
            }`}
          >
            {hideBalance
              ? '₹••••'
              : `${profitPositive ? '+' : '-'}${formatINR(Math.abs(pulse.estimatedDailyProfit))}`}
          </p>
        </div>
      </div>

      {/* Unified Pill Segmented Scope & Mode Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative grid grid-cols-2 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1 min-w-[165px]">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'all', label: 'All Dates' },
            ] as const
          ).map((d) => {
            const active = dateScope === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setDateScope(d.id);
                }}
                className={`relative min-h-[40px] px-3 rounded-full text-xs font-semibold z-10 transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'gallaDateScopeSeg'}
                    transition={SEG_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                  />
                )}
                <span className="relative z-10">{d.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative grid grid-cols-4 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1 flex-1 min-w-[230px]">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'cash', label: 'Cash' },
              { id: 'upi', label: 'UPI' },
              { id: 'bank', label: 'Bank' },
            ] as const
          ).map((m) => {
            const active = modeFilter === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setModeFilter(m.id);
                }}
                className={`relative min-h-[40px] px-2 rounded-full text-xs font-semibold z-10 transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'gallaModeSeg'}
                    transition={SEG_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                  />
                )}
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {listError && (
        <div className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError('')} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cashbook Entries Inset Group */}
      {visibleEntries.length === 0 ? (
        <div className="rounded-[22px] ios27-inset-group p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No cashbook entries yet
          </p>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed max-w-xs mx-auto">
            Record morning opening cash, walk-in cash sales, or daily expenses like transport and utilities.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openEntryModal('inflow')}
              className="min-h-[44px] px-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold tactile-key-primary active:scale-95 transition"
            >
              Add Cash Entry
            </button>
          </div>
        </div>
      ) : (
        <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {visibleEntries.map((entry, idx) => {
              const isIn = entry.entryType === 'inflow';
              const armed = armedDeleteId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ ...SEG_SPRING, delay: calculateStaggerDelay(idx) }}
                  className="px-4 py-3.5 min-h-[64px] flex items-center justify-between gap-3 hover:bg-[var(--surface-subtle)]/50 transition-colors will-change-transform"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                      {isIn ? (
                        <ArrowDownLeft className="w-4 h-4 stroke-[2]" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 stroke-[2]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--ink)] leading-snug truncate">
                        {entry.note || entry.category}
                      </p>
                      <p className="text-[11px] font-medium text-[var(--ink-muted)] leading-snug mt-0.5 truncate">
                        {entry.category} · {entry.mode.toUpperCase()}
                        {entry.actorName ? ` · ${entry.actorName}` : ''} ·{' '}
                        {formatDateTime(entry.entryDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`font-display text-sm sm:text-base font-semibold font-tabular ${
                        isIn ? 'text-[var(--debit-green)]' : 'text-[var(--credit-red)]'
                      }`}
                    >
                      {hideBalance
                        ? '₹••••'
                        : `${isIn ? '+' : '-'}${formatINR(entry.amount)}`}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (armed) {
                          setListError('');
                          try {
                            await onDeleteEntry(entry.id);
                            setArmedDeleteId(null);
                          } catch (err) {
                            setListError(
                              err instanceof Error ? err.message : 'Failed to delete entry.'
                            );
                          }
                        } else {
                          setArmedDeleteId(entry.id);
                        }
                      }}
                      aria-label="Delete cashbook entry"
                      className={`min-w-[44px] min-h-[44px] px-2.5 rounded-full text-xs font-semibold flex items-center justify-center active:scale-95 transition ${
                        armed
                          ? 'bg-[var(--credit-red)] text-white'
                          : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                      }`}
                    >
                      {armed ? 'Delete?' : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Cashbook Entry Detent Sheet */}
      <DetentSheetOverlay
        open={Boolean(modalType)}
        onClose={() => {
          if (!saving) setModalType(null);
        }}
        title={modalType === 'inflow' ? 'Cash In / Deposit' : 'Shop Expense / Payout'}
        subtitle={activeOperatorName}
        initialDetent="peek"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'upi', 'bank'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`min-h-[44px] rounded-full text-xs font-semibold uppercase active:scale-95 transition border ${
                  mode === m
                    ? 'bg-[var(--brand)] text-[var(--brand-fg)] border-transparent'
                    : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div>
            <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1.5">
              Category
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(modalType === 'inflow' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[40px] px-3.5 rounded-full text-xs font-semibold active:scale-95 transition border ${
                    category === cat
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] border-transparent shadow-xs'
                      : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-lg font-extrabold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-xs font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                modalType === 'inflow'
                  ? 'Morning opening cash / counter sale'
                  : 'Tea, transport, utilities...'
              }
              className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          {formError && <p className="text-xs font-bold text-[var(--credit-red)]">{formError}</p>}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full min-h-[50px] rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-semibold text-sm tactile-key-primary disabled:opacity-60 active:scale-95 transition"
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </DetentSheetOverlay>

      {/* Cash Drawer Note & Coin Denomination Counter Sheet */}
      <DetentSheetOverlay
        open={showDenomSheet}
        onClose={() => {
          if (!denomPosting) setShowDenomSheet(false);
        }}
        title="Note & Coin Counter"
        subtitle="Count galla drawer cash accurately"
        initialDetent="full"
      >
        <div className="space-y-3.5 pb-safe">
          <div className="rounded-2xl bg-[var(--app-bg)] px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-muted)]">Counted Total</span>
            <span className="font-display text-2xl font-extrabold font-tabular text-[var(--debit-green)]">
              {formatINR(denomTotal)}
            </span>
          </div>

          <div className="ios27-inset-group rounded-2xl divide-y divide-[var(--glass-border)] overflow-hidden">
            {denomNotes.map((face) => {
              const count = Math.max(0, Math.floor(Number(denomCounts[face]) || 0));
              const lineTotal = face * count;
              return (
                <div
                  key={face}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 font-tabular"
                >
                  <span className="w-16 text-sm font-bold text-[var(--ink)] shrink-0">
                    {face === 1 ? 'Coins ₹' : `₹${face}`}
                  </span>
                  <span className="text-xs text-[var(--ink-muted)]">×</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={denomCounts[face] ?? ''}
                    onChange={(e) =>
                      setDenomCounts((prev) => ({
                        ...prev,
                        [face]: e.target.value.replace(/\D/g, '').slice(0, 5),
                      }))
                    }
                    placeholder="0"
                    className="w-20 min-h-[40px] rounded-xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-2.5 text-center text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                  <span className="flex-1 text-right text-sm font-bold text-[var(--ink)]">
                    {formatINR(lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={denomPosting}
              onClick={() =>
                setDenomCounts({ 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 1: '' })
              }
              className="min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)]"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={denomPosting || denomTotal <= 0}
              onClick={async () => {
                if (denomTotal <= 0) return;
                setDenomPosting(true);
                try {
                  const summary = denomNotes
                    .filter((f) => (Number(denomCounts[f]) || 0) > 0)
                    .map((f) => `${f === 1 ? 'Coins' : `₹${f}`}×${Number(denomCounts[f])}`)
                    .join(', ');
                  await onAddEntry({
                    entryType: 'inflow',
                    mode: 'cash',
                    category: 'Opening Cash',
                    amount: denomTotal,
                    note: `Denom: ${summary}`,
                    entryDate: new Date().toISOString(),
                  });
                  haptics.success();
                  setShowDenomSheet(false);
                } finally {
                  setDenomPosting(false);
                }
              }}
              className="min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold disabled:opacity-50 active:scale-95 transition"
            >
              {denomPosting ? 'Posting...' : 'Post as Opening Cash'}
            </button>
          </div>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
