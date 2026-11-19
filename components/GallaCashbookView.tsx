'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
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

const INFLOW_CATEGORIES = ['Cash Sale', 'Opening', 'Vasooli', 'Other Income'];
const OUTFLOW_CATEGORIES = ['Expense', 'Chai / Staff', 'Supplier Pay', 'Rent / Bijli', 'Withdrawal'];

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
  const todayStr = getLocalDateKey();
  const [dateScope, setDateScope] = useState<'today' | 'all'>('today');
  const [modeFilter, setModeFilter] = useState<'all' | CashbookMode>('all');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [listError, setListError] = useState('');

  // Modal state
  const [modalType, setModalType] = useState<CashbookEntryType | null>(null);
  const [mode, setMode] = useState<CashbookMode>('cash');
  const [category, setCategory] = useState('Cash Sale');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
      setModalType(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save Galla entry.');
    } finally {
      setSaving(false);
    }
  };

  const profitPositive = pulse.estimatedDailyProfit >= 0;

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[44px] min-h-[44px] rounded-2xl spatial-card ring-1 ring-white/80 dark:ring-white/10 flex items-center justify-center active:scale-95 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--ink)]" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)] truncate">
              Live Galla &amp; Cashbook
            </h2>
            <p className="text-xs font-medium text-[var(--ink-muted)] truncate">
              Cash Drawer, UPI/Bank &amp; Profit Pulse · {activeOperatorName}
            </p>
          </div>
        </div>
        {onToggleHideBalance && (
          <button
            type="button"
            onClick={onToggleHideBalance}
            aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
            className="min-w-[44px] min-h-[44px] rounded-2xl spatial-card ring-1 ring-white/80 dark:ring-white/10 flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition shrink-0"
          >
            {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Top 50/50 Split Actions: + Cash In (Green) & - Expense / Out (Red) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openEntryModal('inflow')}
          className="min-h-[48px] px-4 rounded-2xl bg-[var(--debit-green)] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>+ Cash In</span>
        </button>
        <button
          type="button"
          onClick={() => openEntryModal('outflow')}
          className="min-h-[48px] px-4 rounded-2xl bg-[var(--credit-red)] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
        >
          <MinusCircle className="w-4 h-4 shrink-0" />
          <span>- Expense / Out</span>
        </button>
      </div>

      {/* 2-Column Spatial Bento Grid: Cash Drawer (Galla) & UPI/Bank Balance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-[var(--ink-muted)] uppercase tracking-wider">
              Cash Drawer
            </span>
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-inner shrink-0">
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

        <div className="rounded-[24px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-[var(--ink-muted)] uppercase tracking-wider">
              UPI &amp; Bank
            </span>
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-inner shrink-0">
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
      </div>

      {/* Dynamic Horizontal Today's Profit Pulse Card (Emerald if >=0, Red if <0) */}
      <div
        className={`rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-[var(--spatial-shadow)] ${
          profitPositive ? 'bg-[var(--debit-tint)]' : 'bg-[var(--credit-tint)]'
        }`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-inner shrink-0 ${
                profitPositive ? 'from-emerald-500 to-green-600' : 'from-red-500 to-rose-600'
              }`}
            >
              {profitPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </span>
            <span
              className={`text-xs font-extrabold uppercase tracking-wider ${
                profitPositive ? 'text-[var(--debit-green)]' : 'text-[var(--credit-red)]'
              }`}
            >
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

      {/* Single Horizontal Scrollable Filter Bar (Dates + Payment Modes) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'all', label: 'All Dates' },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDateScope(d.id)}
            className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-extrabold whitespace-nowrap shrink-0 active:scale-95 transition ${
              dateScope === d.id
                ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-sm'
                : 'spatial-card ring-1 ring-white/80 dark:ring-white/10 text-[var(--ink-muted)]'
            }`}
          >
            {d.label}
          </button>
        ))}

        <div className="h-5 w-px bg-[var(--surface-subtle)] shrink-0 mx-0.5" />

        {(
          [
            { id: 'all', label: 'All Modes' },
            { id: 'cash', label: 'Cash' },
            { id: 'upi', label: 'UPI' },
            { id: 'bank', label: 'Bank' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModeFilter(m.id)}
            className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-extrabold whitespace-nowrap shrink-0 active:scale-95 transition ${
              modeFilter === m.id
                ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-xs'
                : 'spatial-card ring-1 ring-white/80 dark:ring-white/10 text-[var(--ink-muted)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {listError && (
        <div className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError('')} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cashbook Entries Cards */}
      {visibleEntries.length === 0 ? (
        <div className="rounded-[28px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-8 text-center space-y-3">
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No Galla entries for this view yet.
          </p>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Record morning opening cash, walk-in cash sales, or daily shop expenses like tea,
            bijli, and tempo fare.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openEntryModal('inflow')}
              className="min-h-[44px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold shadow-sm active:scale-95 transition"
            >
              + Add Opening / Cash Sale
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleEntries.map((entry, idx) => {
            const isIn = entry.entryType === 'inflow';
            const armed = armedDeleteId === entry.id;
            return (
              <div
                key={entry.id}
                style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
                className="stagger-fade-up rounded-[22px] spatial-card ring-1 ring-white/80 dark:ring-white/10 px-3.5 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`w-10 h-10 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-inner shrink-0 ${
                      isIn ? 'from-emerald-500 to-green-600' : 'from-red-500 to-rose-600'
                    }`}
                  >
                    {isIn ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[var(--ink)] leading-snug truncate">
                      {entry.note || entry.category}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--ink-muted)] leading-snug mt-0.5">
                      {entry.category} · {entry.mode.toUpperCase()}
                      {entry.actorName ? ` · ${entry.actorName}` : ''} ·{' '}
                      {formatDateTime(entry.entryDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-base font-extrabold font-tabular ${
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
                    className={`min-w-[40px] min-h-[40px] px-2 rounded-xl text-xs font-bold flex items-center justify-center active:scale-95 transition ${
                      armed
                        ? 'bg-[var(--credit-red)] text-white'
                        : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                    }`}
                  >
                    {armed ? 'Delete?' : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Cashbook Entry Bottom Sheet */}
      {modalType && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setModalType(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet ring-1 ring-white/80 dark:ring-white/10 p-6 space-y-4 pb-safe max-h-[90dvh] overflow-y-auto"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                {modalType === 'inflow' ? 'Cash In / Galla Deposit' : 'Shop Expense / Payout'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'upi', 'bank'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`min-h-[44px] rounded-2xl text-xs font-extrabold uppercase active:scale-95 transition ${
                    mode === m
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]/40'
                      : 'bg-[var(--app-bg)] text-[var(--ink)]'
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
                    className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-bold active:scale-95 transition ${
                      category === cat
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                        : 'bg-[var(--app-bg)] text-[var(--ink)]'
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
                  className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-2 ring-[var(--brand-accent)]/60 px-3 text-lg font-extrabold font-tabular text-[var(--ink)] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3 text-xs font-tabular font-bold text-[var(--ink)]"
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
                    : 'Chai, transport, electricity...'
                }
                className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </div>

            {formError && <p className="text-xs font-bold text-[var(--credit-red)]">{formError}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm shadow-md disabled:opacity-60 active:scale-95 transition"
            >
              {saving ? 'Saving...' : 'Save to Galla'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
