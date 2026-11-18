'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  MessageCircle,
  Mic,
  Plus,
  SlidersHorizontal,
  UserPlus,
  Volume2,
  X,
} from 'lucide-react';
import {
  formatINR,
  getAvatarColor,
  getLocalDateKey,
  getUIStrings,
  isValidIndianMobile,
} from '@/lib/i18n';
import type {
  AccountKind,
  LanguageCode,
  LedgerAccount,
  LedgerFilterChip,
  LedgerTransaction,
  SortByOption,
  StockItem,
} from '@/lib/types';

interface LedgerViewProps {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  stockItems: StockItem[];
  language: LanguageCode;
  searchQuery: string;
  onSelectAccount: (account: LedgerAccount) => void;
  onCreateAccount: (payload: {
    kind: AccountKind;
    name: string;
    phone: string;
    dueDate: string;
    creditLimit?: number;
  }) => Promise<void>;
  onOpenCollection: () => void;
  onOpenVoiceEntry: () => void;
  onOpenDailySummary: () => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  accounts,
  transactions,
  stockItems,
  language,
  searchQuery,
  onSelectAccount,
  onCreateAccount,
  onOpenCollection,
  onOpenVoiceEntry,
  onOpenDailySummary,
}) => {
  const t = getUIStrings(language);
  const [filterChip, setFilterChip] = useState<LedgerFilterChip>('customer');
  const [sortBy, setSortBy] = useState<SortByOption>('latest-activity');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  // Add Customer / Supplier Modal (OkCredit video 01:54 - 01:57)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKind, setNewKind] = useState<AccountKind>('customer');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [addError, setAddError] = useState('');

  const todayStr = getLocalDateKey();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showSortSheet) setShowSortSheet(false);
      else if (showAddModal && !addingBusy) setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSortSheet, showAddModal, addingBusy]);

  const todayStats = useMemo(() => {
    let givenToday = 0;
    let receivedToday = 0;
    for (const tx of transactions) {
      if ((tx.billDate || '').slice(0, 10) === todayStr) {
        if (tx.direction === 'given') givenToday += tx.amount;
        else receivedToday += tx.amount;
      }
    }
    const overdueCount = accounts.filter(
      (a) => a.balance > 0 && a.dueDate !== '' && a.dueDate < todayStr
    ).length;
    const lowStockCount = stockItems.filter((s) => s.quantity <= s.lowStockThreshold).length;
    return { givenToday, receivedToday, overdueCount, lowStockCount };
  }, [transactions, accounts, stockItems, todayStr]);

  const filteredAccounts = useMemo(() => {
    let list = [...accounts];

    if (filterChip === 'customer') {
      list = list.filter((a) => a.kind === 'customer');
    } else if (filterChip === 'supplier') {
      list = list.filter((a) => a.kind === 'supplier');
    } else if (filterChip === 'due-today') {
      list = list.filter((a) => a.balance > 0 && a.dueDate === todayStr);
    } else if (filterChip === 'pending-due') {
      list = list.filter((a) => a.balance > 0);
    } else if (filterChip === 'upcoming-due') {
      list = list.filter((a) => a.balance > 0 && a.dueDate > todayStr);
    } else if (filterChip === 'defaulters') {
      list = list.filter((a) => a.balance > 0 && a.dueDate !== '' && a.dueDate < todayStr);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.phone.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'due-amount') return b.balance - a.balance;
      if (sortBy === 'last-payment') return (a.balance || 0) - (b.balance || 0);
      if (sortBy === 'recommended') return Math.abs(b.balance) - Math.abs(a.balance);
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });

    return list;
  }, [accounts, filterChip, searchQuery, sortBy, todayStr]);

  const netSum = useMemo(() => {
    return Math.round(
      filteredAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) * 100
    ) / 100;
  }, [filteredAccounts]);

  const totalUdhaar = useMemo(
    () =>
      Math.round(
        accounts
          .filter((a) => a.balance > 0)
          .reduce((sum, a) => sum + a.balance, 0) * 100
      ) / 100,
    [accounts]
  );

  const totalJama = useMemo(
    () =>
      Math.round(
        accounts
          .filter((a) => a.balance < 0)
          .reduce((sum, a) => sum + Math.abs(a.balance), 0) * 100
      ) / 100,
    [accounts]
  );

  const handleOpenAddModal = (kind: AccountKind) => {
    setNewKind(kind);
    setNewName('');
    setNewPhone('');
    setNewDueDate('');
    setNewCreditLimit('');
    setAddError('');
    setShowAddModal(true);
  };

  const handleAddSubmit = async () => {
    setAddError('');
    if (!newName.trim()) {
      setAddError('Please enter party name.');
      return;
    }
    if (newPhone && !isValidIndianMobile(newPhone)) {
      setAddError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setAddingBusy(true);
    try {
      await onCreateAccount({
        kind: newKind,
        name: newName.trim(),
        phone: newPhone.trim(),
        dueDate: newDueDate,
        creditLimit: Number(newCreditLimit) || 0,
      });
      setAddingBusy(false);
      setShowAddModal(false);
    } catch (err) {
      setAddingBusy(false);
      setAddError(err instanceof Error ? err.message : 'Failed to create account.');
    }
  };

  const chips: Array<{ id: LedgerFilterChip; label: string }> = [
    { id: 'customer', label: t.customer },
    { id: 'supplier', label: t.supplier },
    { id: 'due-today', label: t.dueToday },
    { id: 'pending-due', label: t.pendingDue },
    { id: 'upcoming-due', label: t.upcomingDue },
    { id: 'defaulters', label: t.defaulters },
  ];

  return (
    <div className="space-y-4 pb-28">
      {/* Filter Tabs (OkCredit video 00:34 / 01:05) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chips.map((chip) => {
          const active = filterChip === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilterChip(chip.id)}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 border transition ${
                active
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Dual Summary + Net Balance Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4 shadow-xs">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t.netBalance}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {filteredAccounts.length} {t.accounts}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHideBalance((v) => !v)}
              aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
              className="min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            <div className="text-right">
              <p
                className={`text-xl font-extrabold font-tabular ${
                  netSum >= 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {hideBalance ? '₹••••' : formatINR(Math.abs(netSum))}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {netSum >= 0 ? t.youGet : t.youPay}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              aria-label="Sort accounts"
              className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {t.youGet}
            </p>
            <p className="text-xl font-extrabold font-tabular text-red-600 mt-1">
              {hideBalance ? '₹••••' : formatINR(totalUdhaar)}
            </p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {t.youPay}
            </p>
            <p className="text-xl font-extrabold font-tabular text-emerald-600 mt-1">
              {hideBalance ? '₹••••' : formatINR(totalJama)}
            </p>
          </div>
        </div>
      </div>

      {/* BolBahi Daily Spoken Munim Summary Strip */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            Aaj Ka Munim Hisaab
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-tabular truncate">
            Given {hideBalance ? '₹••' : formatINR(todayStats.givenToday)} · Vasooli{' '}
            {hideBalance ? '₹••' : formatINR(todayStats.receivedToday)}
            {todayStats.overdueCount > 0 ? ` · ${todayStats.overdueCount} Overdue` : ''}
            {todayStats.lowStockCount > 0 ? ` · ${todayStats.lowStockCount} Low Stock` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenDailySummary}
          className="min-h-[38px] px-3.5 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
        >
          <Volume2 className="w-4 h-4" />
          <span>Munim Sunao</span>
        </button>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">
            No {filterChip === 'supplier' ? 'suppliers' : 'customers'} found here.
          </p>
          <p className="text-sm text-slate-500">
            Tap <strong>Voice Entry</strong> to speak an entry, or add a customer manually.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenVoiceEntry}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>{t.voiceEntry}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
              }
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{filterChip === 'supplier' ? t.addSupplier : t.addCustomer}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAccounts.map((acc) => {
            const absBal = Math.abs(acc.balance);
            const statusText =
              acc.balance > 0 ? t.due : acc.balance < 0 ? t.advance : t.settled;
            const overLimit = Boolean(
              acc.creditLimit && acc.creditLimit > 0 && acc.balance > acc.creditLimit
            );
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount(acc)}
                className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center justify-between gap-3 hover:border-[var(--brand)] transition shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: getAvatarColor(acc.name) }}
                    className="w-11 h-11 rounded-full text-white font-extrabold text-lg flex items-center justify-center shrink-0"
                  >
                    {acc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                      <span>
                        {acc.lastNote || (acc.phone ? `+91 ${acc.phone}` : 'Tap to view ledger')}
                        {overLimit ? ` · Over Limit (${formatINR(acc.creditLimit || 0)})` : ''}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-lg font-extrabold font-tabular ${
                      acc.balance > 0
                        ? 'text-red-600'
                        : acc.balance < 0
                        ? 'text-emerald-600'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {hideBalance ? '₹••' : formatINR(absBal)}
                  </p>
                  <p className={`text-xs font-semibold ${overLimit ? 'text-amber-600' : 'text-slate-500'}`}>
                    {overLimit ? 'Over Limit' : statusText}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* OkCredit Floating Quick Action Cluster (Bottom Right above Bottom Nav) */}
      <div className="no-print fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2.5">
        <button
          type="button"
          onClick={onOpenCollection}
          className="min-h-[42px] px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 shadow-md text-xs font-extrabold flex items-center gap-2 hover:scale-[1.02] transition"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>{t.oneClickVasooli}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
            }
            className="min-h-[48px] px-4 rounded-2xl bg-[var(--brand-tint)] border border-[var(--brand)] text-[var(--brand)] shadow-md text-sm font-extrabold flex items-center gap-1.5 hover:scale-[1.02] transition"
          >
            <Plus className="w-4 h-4" />
            <span>{filterChip === 'supplier' ? t.addSupplier : t.addCustomer}</span>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceEntry}
            className="min-h-[52px] px-5 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white shadow-lg text-sm font-extrabold flex items-center gap-2 voice-fab-pulse transition"
          >
            <Mic className="w-5 h-5" />
            <span>{t.voiceEntry}</span>
          </button>
        </div>
      </div>

      {/* Sort By Sheet (OkCredit video 00:44 / 01:07) */}
      {showSortSheet && (
        <div
          onClick={() => setShowSortSheet(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-3"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-lg font-extrabold">Sort By</h3>
              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(
              [
                { id: 'recommended', label: 'Recommended' },
                { id: 'last-payment', label: 'Last Payment' },
                { id: 'latest-activity', label: 'Latest Activity' },
                { id: 'due-amount', label: 'Due Amount (Highest First)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSortBy(opt.id);
                  setShowSortSheet(false);
                }}
                className={`w-full min-h-[48px] px-4 rounded-xl flex items-center justify-between text-sm font-bold ${
                  sortBy === opt.id
                    ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{opt.label}</span>
                {sortBy === opt.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Customer / Supplier Modal (OkCredit video 01:54) */}
      {showAddModal && (
        <div
          onClick={() => {
            if (!addingBusy) setShowAddModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                Add {newKind === 'supplier' ? 'Supplier' : 'Customer'} By Yourself
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewKind('customer')}
                className={`min-h-[42px] rounded-xl text-sm font-bold border ${
                  newKind === 'customer'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => setNewKind('supplier')}
                className={`min-h-[42px] rounded-xl text-sm font-bold border ${
                  newKind === 'supplier'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                Supplier
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--brand)] mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Naitik Kirana"
                  className="w-full min-h-[48px] rounded-xl border-2 border-[var(--brand)] bg-transparent px-3.5 text-base font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 text-base font-bold font-tabular outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 text-sm font-tabular outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Credit Limit ₹ (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 text-sm font-tabular font-bold outline-none"
                />
              </div>
            </div>

            {addError && <p className="text-sm font-bold text-red-600">{addError}</p>}

            <button
              type="button"
              disabled={addingBusy}
              onClick={handleAddSubmit}
              className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-white font-extrabold text-base"
            >
              {addingBusy ? 'Adding...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
