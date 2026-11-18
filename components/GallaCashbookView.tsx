'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  MinusCircle,
  PlusCircle,
  Trash2,
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

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Ledger"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Live Galla &amp; Cashbook
            </h2>
            <p className="text-xs text-slate-500">
              Cash Drawer, UPI/Bank &amp; Daily Profit Pulse · Operator: {activeOperatorName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEntryModal('inflow')}
            className="min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cash In</span>
          </button>
          <button
            type="button"
            onClick={() => openEntryModal('outflow')}
            className="min-h-[42px] px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
          >
            <MinusCircle className="w-4 h-4" />
            <span>Expense / Out</span>
          </button>
        </div>
      </div>

      {/* Live Cash Drawer + UPI + Profit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Cash Drawer (Galla)</span>
            <Wallet className="w-4 h-4 text-[var(--brand)]" />
          </div>
          <p
            className={`text-2xl font-extrabold font-tabular ${
              pulse.cashDrawerBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatINR(pulse.cashDrawerBalance)}
          </p>
          <p className="text-[11px] font-medium text-slate-500">
            Physical cash net balance across entries
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>UPI &amp; Bank Balance</span>
            <Landmark className="w-4 h-4 text-[var(--brand)]" />
          </div>
          <p className="text-2xl font-extrabold font-tabular text-slate-900 dark:text-white">
            {formatINR(pulse.upiBankBalance)}
          </p>
          <p className="text-[11px] font-medium text-slate-500 font-tabular">
            Today In: {formatINR(pulse.todayInflow)} · Out: {formatINR(pulse.todayOutflow)}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase opacity-80">
            <span>Today&apos;s Profit Pulse</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-2xl font-extrabold font-tabular">
            {pulse.estimatedDailyProfit >= 0 ? '+' : '-'}
            {formatINR(Math.abs(pulse.estimatedDailyProfit))}
          </p>
          <p className="text-[11px] opacity-85">{pulse.profitBasisNote}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
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
              className={`min-h-[34px] px-4 rounded-lg text-xs font-bold transition ${
                dateScope === d.id
                  ? 'bg-[var(--surface)] text-[var(--brand)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
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
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition ${
                modeFilter === m.id
                  ? 'bg-[var(--surface)] text-[var(--brand)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {listError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cashbook Entries Table/List */}
      {visibleEntries.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-10 text-center space-y-3">
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">
            No Galla entries for this view yet.
          </p>
          <p className="text-xs text-slate-500">
            Record morning opening cash, walk-in cash sales, or daily shop expenses like tea, bijli, and tempo fare.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openEntryModal('inflow')}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold"
            >
              + Add Opening / Cash Sale
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] divide-y divide-[var(--surface-border)] overflow-hidden">
          {visibleEntries.map((entry) => {
            const isIn = entry.entryType === 'inflow';
            const armed = armedDeleteId === entry.id;
            return (
              <div
                key={entry.id}
                className="px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isIn
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                        : 'bg-red-50 dark:bg-red-950/50 text-red-600'
                    }`}
                  >
                    {isIn ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {entry.note || entry.category}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      {entry.category} · {entry.mode.toUpperCase()}
                      {entry.actorName ? ` · ${entry.actorName}` : ''} ·{' '}
                      {formatDateTime(entry.entryDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-base font-extrabold font-tabular ${
                      isIn ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {isIn ? '+' : '-'}
                    {formatINR(entry.amount)}
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
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                      armed
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-red-600'
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

      {/* Add Cashbook Entry Modal */}
      {modalType && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setModalType(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {modalType === 'inflow' ? 'Cash In / Galla Deposit' : 'Shop Expense / Payout'}
              </h3>
              <button type="button" onClick={() => setModalType(null)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'upi', 'bank'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`min-h-[40px] rounded-xl text-xs font-extrabold uppercase border ${
                    mode === m
                      ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                      : 'border-[var(--surface-border)]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-500 mb-1.5">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {(modalType === 'inflow' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-bold border ${
                      category === cat
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)] border-[var(--brand)]'
                        : 'border-[var(--surface-border)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full min-h-[46px] rounded-xl border-2 border-[var(--brand)] bg-transparent px-3 text-lg font-extrabold font-tabular outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-xs font-tabular font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  modalType === 'inflow' ? 'Morning opening cash / counter sale' : 'Chai, transport, electricity...'
                }
                className="w-full min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm"
              />
            </div>

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save to Galla'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
