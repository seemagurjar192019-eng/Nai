'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  Filter,
  MessageCircle,
  Mic,
  Plus,
  Repeat,
  UserPlus,
  Volume2,
  Wallet,
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
  CustomerTrustScore,
  DailyGallaPulse,
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
  gallaPulse: DailyGallaPulse;
  trustScoresByAccount: Record<string, CustomerTrustScore>;
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
  onOpenCounterMode: () => void;
  onOpenParchiScanner: () => void;
  onOpenGalla: () => void;
  onOpenDailySummary: () => void;
}

const FILTER_OPTIONS: Array<{ id: LedgerFilterChip; label: string }> = [
  { id: 'customer', label: 'All Customers' },
  { id: 'supplier', label: 'All Suppliers' },
  { id: 'due-today', label: 'Due Today' },
  { id: 'pending-due', label: 'Pending Due' },
  { id: 'upcoming-due', label: 'Upcoming Due' },
  { id: 'defaulters', label: 'Defaulters (Overdue)' },
  { id: 'high-risk', label: 'High Trust Risk (<50)' },
];

const SORT_OPTIONS: Array<{ id: SortByOption; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'recovery-priority', label: 'Recovery Priority (Smart)' },
  { id: 'latest-activity', label: 'Latest Activity' },
  { id: 'due-amount', label: 'Due Amount (Highest First)' },
  { id: 'last-payment', label: 'Last Payment' },
];

export const LedgerView: React.FC<LedgerViewProps> = ({
  accounts,
  transactions,
  stockItems,
  language,
  searchQuery,
  gallaPulse,
  trustScoresByAccount,
  onSelectAccount,
  onCreateAccount,
  onOpenCollection,
  onOpenVoiceEntry,
  onOpenCounterMode,
  onOpenParchiScanner,
  onOpenGalla,
  onOpenDailySummary,
}) => {
  const t = getUIStrings(language);
  const [filterChip, setFilterChip] = useState<LedgerFilterChip>('customer');
  const [sortBy, setSortBy] = useState<SortByOption>('latest-activity');
  const [showFilterSortSheet, setShowFilterSortSheet] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  // Add Customer / Supplier Modal
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
      if (showFilterSortSheet) setShowFilterSortSheet(false);
      else if (quickActionsOpen) setQuickActionsOpen(false);
      else if (showAddModal && !addingBusy) setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFilterSortSheet, quickActionsOpen, showAddModal, addingBusy]);

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
    } else if (filterChip === 'high-risk') {
      list = list.filter(
        (a) => a.balance > 0 && (trustScoresByAccount[a.id]?.score ?? 100) < 50
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.phone.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'recovery-priority') {
        const pa = trustScoresByAccount[a.id]?.priorityScore || 0;
        const pb = trustScoresByAccount[b.id]?.priorityScore || 0;
        return pb - pa;
      }
      if (sortBy === 'due-amount') return b.balance - a.balance;
      if (sortBy === 'last-payment') return (a.balance || 0) - (b.balance || 0);
      if (sortBy === 'recommended') return Math.abs(b.balance) - Math.abs(a.balance);
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });

    return list;
  }, [accounts, filterChip, searchQuery, sortBy, todayStr, trustScoresByAccount]);

  const netSum = useMemo(() => {
    return (
      Math.round(filteredAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) * 100) /
      100
    );
  }, [filteredAccounts]);

  const totalUdhaar = useMemo(
    () =>
      Math.round(
        accounts.filter((a) => a.balance > 0).reduce((sum, a) => sum + a.balance, 0) * 100
      ) / 100,
    [accounts]
  );

  const totalJama = useMemo(
    () =>
      Math.round(
        accounts.filter((a) => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0) * 100
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

  const activeFilterLabel =
    FILTER_OPTIONS.find((f) => f.id === filterChip)?.label || 'All Customers';
  const hasSecondaryFilter = filterChip !== 'customer' && filterChip !== 'supplier';

  return (
    <div className="space-y-4 pb-28">
      {/* Unified Financial Pulse Strip (Ledger + Galla + Daily Profit + Munim Sunao) */}
      <section className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 shadow-xs space-y-3.5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t.netBalance} ({filteredAccounts.length} {t.accounts})
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p
                  className={`text-2xl font-extrabold font-tabular ${
                    netSum >= 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {hideBalance ? '₹••••' : formatINR(Math.abs(netSum))}
                </p>
                <span className="text-xs font-bold text-slate-500">
                  {netSum >= 0 ? t.youGet : t.youPay}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHideBalance((v) => !v)}
              aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
              className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-5 font-tabular">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">{t.youGet}</p>
              <p className="text-base font-extrabold text-red-600">
                {hideBalance ? '₹•••' : formatINR(totalUdhaar)}
              </p>
            </div>
            <div className="h-7 w-px bg-[var(--surface-border)]" />
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase">{t.youPay}</p>
              <p className="text-base font-extrabold text-emerald-600">
                {hideBalance ? '₹•••' : formatINR(totalJama)}
              </p>
            </div>
          </div>
        </div>

        {/* Live Galla + Today's Profit + Munim Sunao Strip */}
        <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 font-tabular">
              Galla Cash {hideBalance ? '₹••' : formatINR(gallaPulse.cashDrawerBalance)} · Today
              Profit{' '}
              <span
                className={
                  gallaPulse.estimatedDailyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }
              >
                {hideBalance
                  ? '₹••'
                  : `${gallaPulse.estimatedDailyProfit >= 0 ? '+' : '-'}${formatINR(
                      Math.abs(gallaPulse.estimatedDailyProfit)
                    )}`}
              </span>
            </p>
            <p className="text-[11px] font-medium text-slate-500 font-tabular truncate">
              Given {hideBalance ? '₹••' : formatINR(todayStats.givenToday)} · Vasooli{' '}
              {hideBalance ? '₹••' : formatINR(todayStats.receivedToday)}
              {todayStats.overdueCount > 0 ? ` · ${todayStats.overdueCount} Overdue` : ''}
              {todayStats.lowStockCount > 0 ? ` · ${todayStats.lowStockCount} Low Stock` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenGalla}
              className="min-h-[36px] px-3 rounded-xl border border-[var(--surface-border)] text-xs font-extrabold inline-flex items-center gap-1.5 hover:border-[var(--brand)] transition"
            >
              <Wallet className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>Open Galla</span>
            </button>
            <button
              type="button"
              onClick={onOpenDailySummary}
              className="min-h-[36px] px-3 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Munim Sunao</span>
            </button>
          </div>
        </div>
      </section>

      {/* Clean Segment & Unified Filter/Sort Strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setFilterChip('customer')}
            className={`min-h-[36px] px-4 rounded-lg text-xs sm:text-sm font-bold transition ${
              filterChip === 'customer'
                ? 'bg-[var(--surface)] text-[var(--brand)] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.customer}
          </button>
          <button
            type="button"
            onClick={() => setFilterChip('supplier')}
            className={`min-h-[36px] px-4 rounded-lg text-xs sm:text-sm font-bold transition ${
              filterChip === 'supplier'
                ? 'bg-[var(--surface)] text-[var(--brand)] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.supplier}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFilterSortSheet(true)}
          className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition ${
            hasSecondaryFilter || sortBy !== 'latest-activity'
              ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
              : 'bg-[var(--surface)] border-[var(--surface-border)] text-slate-700 dark:text-slate-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter & Sort'}</span>
        </button>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] p-8 text-center space-y-3">
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">
            No {filterChip === 'supplier' ? 'suppliers' : 'parties'} matched this view.
          </p>
          <p className="text-sm text-slate-500">
            Tap <strong>Voice &amp; Counter</strong> to speak an entry, scan a parchi, or add a
            party manually.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenVoiceEntry}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold inline-flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>{t.voiceEntry}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
              }
              className="min-h-[44px] px-4 rounded-xl border border-[var(--surface-border)] text-sm font-bold inline-flex items-center gap-2"
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
            const trust = trustScoresByAccount[acc.id];
            const subtextParts: string[] = [];
            if (trust && acc.kind === 'customer') {
              subtextParts.push(`Trust ${trust.score}/100`);
              subtextParts.push(trust.recoveryTimingHint);
            } else if (acc.lastNote) {
              subtextParts.push(acc.lastNote);
            } else if (acc.phone) {
              subtextParts.push(`+91 ${acc.phone}`);
            } else {
              subtextParts.push('Tap to view ledger');
            }
            if (overLimit) {
              subtextParts.push(`Over Limit (${formatINR(acc.creditLimit || 0)})`);
            }

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount(acc)}
                className="w-full text-left rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] px-4 py-3.5 flex items-center justify-between gap-3 hover:border-[var(--brand)] transition shadow-xs"
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
                    <p
                      className={`text-xs font-medium truncate flex items-center gap-1 ${
                        trust?.band === 'high-risk' && acc.balance > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                      <span className="truncate">{subtextParts.join(' · ')}</span>
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
                  <p
                    className={`text-xs font-semibold ${
                      overLimit ? 'text-amber-600' : 'text-slate-500'
                    }`}
                  >
                    {overLimit ? 'Over Limit' : statusText}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Managed 2-Button Thumb Dock (Voice & Counter + Quick Actions Sheet) */}
      <div className="no-print fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
        {quickActionsOpen && (
          <div className="w-60 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] shadow-2xl p-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer');
              }}
              className="w-full min-h-[42px] px-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10 text-left"
            >
              <UserPlus className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>{filterChip === 'supplier' ? t.addSupplier : t.addCustomer}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                onOpenParchiScanner();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10 text-left"
            >
              <Camera className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>Scan Parchi (AI Photo)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                onOpenGalla();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10 text-left"
            >
              <Wallet className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>Galla Cash / Expense</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                onOpenCollection();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10 text-left"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.oneClickVasooli}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                onOpenCounterMode();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold hover:bg-black/5 dark:hover:bg-white/10 text-left"
            >
              <Repeat className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>Hands-Free Counter Mode</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuickActionsOpen((v) => !v)}
            className="min-h-[50px] px-4 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] text-slate-900 dark:text-white shadow-lg text-xs sm:text-sm font-extrabold flex items-center gap-1.5 hover:border-[var(--brand)] transition"
          >
            {quickActionsOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>Quick Actions</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickActionsOpen(false);
              onOpenVoiceEntry();
            }}
            className="min-h-[50px] px-5 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] shadow-lg text-xs sm:text-sm font-extrabold flex items-center gap-2 voice-fab-pulse transition"
          >
            <Mic className="w-4 h-4" />
            <span>Voice &amp; Counter</span>
          </button>
        </div>
      </div>

      {/* Unified Filter & Sort Modal */}
      {showFilterSortSheet && (
        <div
          onClick={() => setShowFilterSortSheet(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-5 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Filter &amp; Sort Ledger</h3>
              <button
                type="button"
                onClick={() => setShowFilterSortSheet(false)}
                aria-label="Close filter and sort"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Filter Parties
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FILTER_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterChip(f.id)}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-bold border text-left flex items-center justify-between ${
                      filterChip === f.id
                        ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                        : 'border-[var(--surface-border)] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{f.label}</span>
                    {filterChip === f.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sort Order
              </p>
              <div className="space-y-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowFilterSortSheet(false);
                    }}
                    className={`w-full min-h-[46px] px-4 rounded-xl flex items-center justify-between text-sm font-bold ${
                      sortBy === opt.id
                        ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer / Supplier Modal */}
      {showAddModal && (
        <div
          onClick={() => {
            if (!addingBusy) setShowAddModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
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
                    : 'border-[var(--surface-border)]'
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
                    : 'border-[var(--surface-border)]'
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
                  className="w-full min-h-[48px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 text-base font-bold font-tabular outline-none"
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
                  className="w-full min-h-[48px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 text-sm font-tabular outline-none"
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
                  className="w-full min-h-[48px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 text-sm font-tabular font-bold outline-none"
                />
              </div>
            </div>

            {addError && <p className="text-sm font-bold text-red-600">{addError}</p>}

            <button
              type="button"
              disabled={addingBusy}
              onClick={handleAddSubmit}
              className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-base"
            >
              {addingBusy ? 'Adding...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
