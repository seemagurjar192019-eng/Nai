'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  Eye,
  EyeOff,
  Filter,
  Landmark,
  Mic,
  Package,
  Plus,
  Sparkles,
  UserPlus,
  Users,
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
import { computeNetCashflowSummary } from '@/lib/ucred-intelligence';
import type {
  AccountKind,
  CashbookMode,
  CustomerTrustScore,
  DailyGallaPulse,
  LanguageCode,
  LedgerAccount,
  LedgerFilterChip,
  LedgerTransaction,
  SortByOption,
  StockItem,
  TxDirection,
} from '@/lib/types';

interface LedgerViewProps {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  stockItems: StockItem[];
  language: LanguageCode;
  searchQuery: string;
  gallaPulse: DailyGallaPulse;
  trustScoresByAccount: Record<string, CustomerTrustScore>;
  selectedAccountId?: string | null;
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  addPartySignal?: number;
  onSelectAccount: (account: LedgerAccount) => void;
  onCreateAccount: (payload: {
    kind: AccountKind;
    name: string;
    phone: string;
    dueDate: string;
    creditLimit?: number;
  }) => Promise<void>;
  onQuickTransaction: (
    account: LedgerAccount,
    payload: {
      direction: TxDirection;
      amount: number;
      note: string;
      syncToGalla?: { mode: CashbookMode } | null;
    }
  ) => Promise<void>;
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

const RING_RADIUS = 19;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SPRING_FAST = { type: 'spring' as const, stiffness: 420, damping: 28 };
const SPRING_SHEET = { type: 'spring' as const, stiffness: 360, damping: 32 };

function TrustAvatarRing({
  name,
  score,
  hasTrust,
  size = 'md',
}: {
  name: string;
  score: number;
  hasTrust: boolean;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.max(0, Math.min(100, hasTrust ? score : 100));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  const strokeColor = !hasTrust
    ? 'var(--brand-accent)'
    : clamped >= 70
      ? 'var(--debit-green)'
      : clamped >= 50
        ? 'var(--alert-amber)'
        : 'var(--credit-red)';
  const outerCls = size === 'sm' ? 'w-11 h-11' : 'w-12 h-12';
  const innerCls = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-base';

  return (
    <div className={`relative ${outerCls} shrink-0 flex items-center justify-center`}>
      <svg viewBox="0 0 44 44" className={`${outerCls} -rotate-90`} aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeWidth="2.8"
          fill="none"
          className="stroke-[var(--surface-subtle)]"
        />
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeWidth="2.8"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="trust-ring-draw"
          style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div
        style={{ backgroundColor: getAvatarColor(name) }}
        className={`absolute ${innerCls} rounded-full text-white font-extrabold flex items-center justify-center shadow-sm`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  accounts,
  transactions,
  stockItems,
  language,
  searchQuery,
  gallaPulse,
  trustScoresByAccount,
  selectedAccountId,
  hideBalance,
  onToggleHideBalance,
  addPartySignal = 0,
  onSelectAccount,
  onCreateAccount,
  onQuickTransaction,
  onOpenCollection,
  onOpenVoiceEntry,
  onOpenParchiScanner,
  onOpenGalla,
  onOpenDailySummary,
}) => {
  const t = getUIStrings(language);
  const [filterChip, setFilterChip] = useState<LedgerFilterChip>('customer');
  const [sortBy, setSortBy] = useState<SortByOption>('latest-activity');
  const [showFilterSortSheet, setShowFilterSortSheet] = useState(false);
  const [pulseIdx, setPulseIdx] = useState(0);
  const deckRef = useRef<HTMLDivElement | null>(null);

  // Add Customer / Supplier Bottom Sheet
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKind, setNewKind] = useState<AccountKind>('customer');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Inline + ₹ Quick-Entry Bottom Sheet
  const [quickEntryAccount, setQuickEntryAccount] = useState<LedgerAccount | null>(null);
  const [quickDirection, setQuickDirection] = useState<TxDirection>('given');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickGallaMode, setQuickGallaMode] = useState<CashbookMode | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');
  const quickAmountInputRef = useRef<HTMLInputElement | null>(null);
  const filterChipRef = useRef<LedgerFilterChip>(filterChip);

  const todayStr = getLocalDateKey();

  useEffect(() => {
    filterChipRef.current = filterChip;
  }, [filterChip]);

  useEffect(() => {
    if (!addPartySignal) return;
    const timer = setTimeout(() => {
      setNewKind(filterChipRef.current === 'supplier' ? 'supplier' : 'customer');
      setNewName('');
      setNewPhone('');
      setNewDueDate('');
      setNewCreditLimit('');
      setAddError('');
      setShowAddModal(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [addPartySignal]);

  useEffect(() => {
    if (!quickEntryAccount) return;
    const timer = setTimeout(() => {
      quickAmountInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [quickEntryAccount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickEntryAccount && !quickSaving) setQuickEntryAccount(null);
      else if (showFilterSortSheet) setShowFilterSortSheet(false);
      else if (showAddModal && !addingBusy) setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickEntryAccount, quickSaving, showFilterSortSheet, showAddModal, addingBusy]);

  const cashflow = useMemo(() => computeNetCashflowSummary(accounts), [accounts]);

  const todayStats = useMemo(() => {
    let givenToday = 0;
    let receivedToday = 0;
    for (const tx of transactions) {
      if ((tx.billDate || '').slice(0, 10) === todayStr) {
        if (tx.direction === 'given') givenToday += tx.amount;
        else receivedToday += tx.amount;
      }
    }
    const overdueAccs = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate !== '' && a.dueDate <= todayStr
    );
    const overdueAmount = overdueAccs.reduce((s, a) => s + a.balance, 0);
    const highRiskAccs = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && (trustScoresByAccount[a.id]?.score ?? 100) < 50
    );
    const topRecoveryParty =
      accounts
        .filter((a) => a.kind === 'customer' && a.balance > 0)
        .sort(
          (a, b) =>
            (trustScoresByAccount[b.id]?.priorityScore || 0) -
            (trustScoresByAccount[a.id]?.priorityScore || 0)
        )[0] || null;
    const lowStockCount = stockItems.filter((s) => s.quantity <= s.lowStockThreshold).length;
    return {
      givenToday,
      receivedToday,
      overdueCount: overdueAccs.length,
      overdueAmount,
      highRiskCount: highRiskAccs.length,
      topRecoveryParty,
      lowStockCount,
    };
  }, [transactions, accounts, stockItems, todayStr, trustScoresByAccount]);

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

  const openQuickEntrySheet = (acc: LedgerAccount) => {
    setQuickEntryAccount(acc);
    setQuickDirection('given');
    setQuickAmount('');
    setQuickNote('');
    setQuickGallaMode(null);
    setQuickError('');
  };

  const handleSaveQuickEntry = async () => {
    if (!quickEntryAccount) return;
    setQuickError('');
    const amt = Math.round((Number(quickAmount) || 0) * 100) / 100;
    if (amt <= 0) {
      setQuickError('Enter an amount greater than ₹0.');
      quickAmountInputRef.current?.focus();
      return;
    }
    setQuickSaving(true);
    try {
      await onQuickTransaction(quickEntryAccount, {
        direction: quickDirection,
        amount: amt,
        note: quickNote.trim(),
        syncToGalla: quickGallaMode ? { mode: quickGallaMode } : null,
      });
      setQuickEntryAccount(null);
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setQuickSaving(false);
    }
  };

  const scrollToPulseCard = (index: number) => {
    setPulseIdx(index);
    const el = deckRef.current;
    if (!el) return;
    const card = el.children[index] as HTMLElement | undefined;
    if (card) {
      el.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
    }
  };

  const activeFilterLabel =
    FILTER_OPTIONS.find((f) => f.id === filterChip)?.label || 'All Customers';
  const hasSecondaryFilter = filterChip !== 'customer' && filterChip !== 'supplier';

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;
  const netTitle = netPositive
    ? 'Net Receivable'
    : netNegative
      ? 'Net Payable'
      : 'All Settled';

  return (
    <div className="space-y-4 pb-6">
      {/* Horizontal Swipeable Pulse Deck (Snap 3D Spatial Cards) */}
      <div className="space-y-2">
        <div
          ref={deckRef}
          onScroll={(e) => {
            const target = e.currentTarget;
            const width = target.clientWidth || 360;
            const nextIdx = Math.round(target.scrollLeft / (width * 0.85));
            if (nextIdx !== pulseIdx && nextIdx >= 0 && nextIdx <= 2) {
              setPulseIdx(nextIdx);
            }
          }}
          aria-label="Business Pulse Deck"
          className="flex overflow-x-auto snap-x snap-mandatory scroll-pl-4 gap-3 -mx-4 px-4 no-scrollbar pb-1"
        >
          {/* Card 1: Net Cashflow Hero Bento Card */}
          <section className="snap-start w-[91%] max-w-[91%] shrink-0 rounded-[28px] spatial-hero ring-1 ring-white/90 dark:ring-white/10 p-4 space-y-3.5 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -top-16 -right-14 w-44 h-44 rounded-full bg-indigo-500/12 dark:bg-blue-500/12 blur-2xl pointer-events-none"
            />

            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    netPositive
                      ? 'bg-[var(--debit-green)]'
                      : netNegative
                        ? 'bg-[var(--credit-red)]'
                        : 'bg-[var(--brand-accent)]'
                  }`}
                />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)] truncate">
                  {netTitle} · {accounts.length} {t.accounts}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={onToggleHideBalance}
                  aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
                  className="min-w-[40px] min-h-[40px] rounded-full bg-[var(--app-bg)]/85 hover:bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)]"
                >
                  {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={onOpenDailySummary}
                  className="min-h-[38px] px-3 rounded-full bg-[var(--brand-tint)] text-[var(--brand-accent)] text-[11px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                >
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Munim Sunao</span>
                </motion.button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={`font-display text-[30px] leading-none font-extrabold font-tabular tracking-tight ${
                    netPositive
                      ? 'text-[var(--debit-green)]'
                      : netNegative
                        ? 'text-[var(--credit-red)]'
                        : 'text-[var(--ink)]'
                  }`}
                >
                  {hideBalance
                    ? '₹••••'
                    : `${netNegative ? '-' : ''}${formatINR(Math.abs(cashflow.netCashflow))}`}
                </p>
                <span className="text-[11px] font-bold font-tabular text-[var(--ink-muted)]">
                  {cashflow.receivableSharePct}% Lena · {cashflow.payableSharePct}% Dena
                </span>
              </div>

              <div
                aria-label="Receivable versus payable ratio"
                className="h-2.5 w-full rounded-full bg-[var(--surface-subtle)] overflow-hidden flex p-0.5 gap-0.5"
              >
                <div
                  style={{ width: `${cashflow.receivableSharePct}%` }}
                  className="h-full rounded-full bg-[var(--debit-green)] transition-all duration-500 ease-out"
                />
                <div
                  style={{ width: `${cashflow.payableSharePct}%` }}
                  className="h-full rounded-full bg-[var(--credit-red)] transition-all duration-500 ease-out"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[var(--debit-tint)] px-2.5 py-2 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--debit-green)]">
                  <ArrowDown className="w-3 h-3 shrink-0" />
                  <span>Lena</span>
                </div>
                <p className="font-display text-xs font-extrabold font-tabular text-[var(--debit-green)] truncate">
                  {hideBalance ? '₹••••' : formatINR(cashflow.totalReceivable)}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--credit-tint)] px-2.5 py-2 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--credit-red)]">
                  <ArrowUp className="w-3 h-3 shrink-0" />
                  <span>Dena</span>
                </div>
                <p className="font-display text-xs font-extrabold font-tabular text-[var(--credit-red)] truncate">
                  {hideBalance ? '₹••••' : formatINR(cashflow.totalPayable)}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.94 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenGalla}
                className="rounded-2xl bg-[var(--brand-tint)] px-2.5 py-2 text-left space-y-0.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                  <Wallet className="w-3 h-3 shrink-0" />
                  <span className="truncate">Galla</span>
                </div>
                <p className="font-display text-xs font-extrabold font-tabular text-[var(--brand-accent)] truncate">
                  {hideBalance ? '₹••••' : formatINR(gallaPulse.cashDrawerBalance)}
                </p>
              </motion.button>
            </div>
          </section>

          {/* Card 2: Live Galla Cash vs UPI & Daily Profit Card */}
          <section className="snap-start w-[91%] max-w-[91%] shrink-0 rounded-[28px] spatial-hero ring-1 ring-white/90 dark:ring-white/10 p-4 space-y-3.5 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -bottom-14 -right-10 w-40 h-40 rounded-full bg-emerald-500/12 blur-2xl pointer-events-none"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
                    Live Galla &amp; Profit
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate max-w-[165px]">
                    {gallaPulse.todayStr}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenGalla}
                className="min-h-[38px] px-3 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm"
              >
                <span>Open Galla</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-[var(--app-bg)] p-3 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)] inline-flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-[var(--brand-accent)]" />
                  <span>Cash Drawer</span>
                </p>
                <p className="font-display text-lg font-extrabold font-tabular text-[var(--ink)]">
                  {hideBalance ? '₹••••' : formatINR(gallaPulse.cashDrawerBalance)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--app-bg)] p-3 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)] inline-flex items-center gap-1">
                  <Landmark className="w-3 h-3 text-[var(--brand-accent)]" />
                  <span>UPI / Bank</span>
                </p>
                <p className="font-display text-lg font-extrabold font-tabular text-[var(--ink)]">
                  {hideBalance ? '₹••••' : formatINR(gallaPulse.upiBankBalance)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--debit-tint)]/75 px-3.5 py-2.5 text-xs font-tabular">
              <span className="font-bold text-[var(--ink)]">Today Est. Profit</span>
              <span
                className={`font-extrabold text-sm ${
                  gallaPulse.estimatedDailyProfit >= 0
                    ? 'text-[var(--debit-green)]'
                    : 'text-[var(--credit-red)]'
                }`}
              >
                {hideBalance
                  ? '₹••••'
                  : `${gallaPulse.estimatedDailyProfit >= 0 ? '+' : '-'}${formatINR(
                      Math.abs(gallaPulse.estimatedDailyProfit)
                    )}`}
              </span>
            </div>
          </section>

          {/* Card 3: Today's Vasooli Priority & Recovery Radar */}
          <section className="snap-start w-[91%] max-w-[91%] shrink-0 rounded-[28px] spatial-hero ring-1 ring-white/90 dark:ring-white/10 p-4 space-y-3.5 relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -top-14 -right-10 w-40 h-40 rounded-full bg-amber-500/12 blur-2xl pointer-events-none"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[var(--alert-tint)] text-[var(--alert-amber)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
                    Today&apos;s Vasooli Priority
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    Smart Recovery Radar
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenCollection}
                className="min-h-[38px] px-3 rounded-full bg-[var(--debit-green)] text-white text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm"
              >
                <span>Collect Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[var(--credit-tint)]/80 px-2.5 py-2 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-[var(--credit-red)]">
                  Overdue
                </p>
                <p className="font-display text-sm font-extrabold font-tabular text-[var(--credit-red)] truncate">
                  {todayStats.overdueCount} · {hideBalance ? '₹••' : formatINR(todayStats.overdueAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--alert-tint)] px-2.5 py-2 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-[var(--alert-amber)]">
                  Trust &lt; 50
                </p>
                <p className="font-display text-sm font-extrabold font-tabular text-[var(--alert-amber)]">
                  {todayStats.highRiskCount} Parties
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--app-bg)] px-2.5 py-2 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-[var(--ink-muted)] inline-flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>Low Stock</span>
                </p>
                <p className="font-display text-sm font-extrabold font-tabular text-[var(--ink)]">
                  {todayStats.lowStockCount} Items
                </p>
              </div>
            </div>

            {todayStats.topRecoveryParty ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => onSelectAccount(todayStats.topRecoveryParty!)}
                className="w-full flex items-center justify-between gap-2 rounded-2xl bg-[var(--app-bg)] px-3.5 py-2.5 text-left"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink)] truncate">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--alert-amber)] shrink-0" />
                  <span className="truncate">Top Priority: {todayStats.topRecoveryParty.name}</span>
                </span>
                <span className="text-xs font-extrabold font-tabular text-[var(--credit-red)] shrink-0">
                  {hideBalance ? '₹••••' : formatINR(todayStats.topRecoveryParty.balance)}
                </span>
              </motion.button>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--debit-tint)]/75 px-3.5 py-2.5 text-xs font-bold text-[var(--debit-green)]">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Today Vasooli Collected</span>
                </span>
                <span className="font-extrabold font-tabular">
                  {hideBalance ? '₹••••' : formatINR(todayStats.receivedToday)}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* Pulse Deck Indicator Dots */}
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Pulse cards">
          {['Cashflow', 'Live Galla', 'Vasooli Radar'].map((label, idx) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={pulseIdx === idx}
              aria-label={`Show ${label} card`}
              onClick={() => scrollToPulseCard(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                pulseIdx === idx
                  ? 'w-5 bg-[var(--brand-accent)]'
                  : 'w-1.5 bg-[var(--ink-muted)]/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Sliding Spring Pill Segmented Control (Customer / Supplier) + Filter & Sort */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative grid grid-cols-2 rounded-2xl bg-[var(--surface-subtle)] p-1 flex-1 max-w-[235px] shadow-inner">
          <button
            type="button"
            onClick={() => setFilterChip('customer')}
            className={`relative min-h-[40px] px-3 rounded-xl text-xs font-extrabold transition-colors ${
              filterChip === 'customer'
                ? 'text-[var(--brand)] dark:text-[var(--brand-accent)]'
                : 'text-[var(--ink-muted)]'
            }`}
          >
            {filterChip === 'customer' && !hasSecondaryFilter && (
              <motion.span
                layoutId="ledgerKindPill"
                transition={SPRING_FAST}
                className="absolute inset-0 rounded-xl bg-[var(--surface)] shadow-sm"
              />
            )}
            <span className="relative z-10">{t.customer}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterChip('supplier')}
            className={`relative min-h-[40px] px-3 rounded-xl text-xs font-extrabold transition-colors ${
              filterChip === 'supplier'
                ? 'text-[var(--brand)] dark:text-[var(--brand-accent)]'
                : 'text-[var(--ink-muted)]'
            }`}
          >
            {filterChip === 'supplier' && !hasSecondaryFilter && (
              <motion.span
                layoutId="ledgerKindPill"
                transition={SPRING_FAST}
                className="absolute inset-0 rounded-xl bg-[var(--surface)] shadow-sm"
              />
            )}
            <span className="relative z-10">{t.supplier}</span>
          </button>
        </div>

        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={SPRING_FAST}
          type="button"
          onClick={() => setShowFilterSortSheet(true)}
          className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 ${
            hasSecondaryFilter || sortBy !== 'latest-activity'
              ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-sm'
              : 'spatial-card ring-1 ring-white/80 dark:ring-white/10 text-[var(--ink)]'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter & Sort'}</span>
        </motion.button>
      </div>

      {/* 2-Column Spatial Bento Party Grid or Clean Guided First-Action Strip */}
      {accounts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING_FAST}
          className="rounded-[28px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
              Ready For Live Shop Records
            </p>
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
              Start Your Real Shop Khata
            </h2>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              Your ledger starts completely clean. Add your first customer or supplier, speak an
              entry in Hindi or Hinglish, or snap a parchi slip.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() =>
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
              }
              className="min-h-[48px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2 shadow-md"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>{filterChip === 'supplier' ? 'Add First Supplier' : 'Add First Customer'}</span>
            </motion.button>

            <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenVoiceEntry}
                className="min-h-[46px] px-3 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span>Speak First Entry</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenParchiScanner}
                className="min-h-[46px] px-3 rounded-2xl bg-[var(--app-bg)] text-xs font-bold text-[var(--ink)] flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                <span>Scan First Parchi</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : filteredAccounts.length === 0 ? (
        <div className="rounded-[28px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-8 text-center space-y-3">
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No {filterChip === 'supplier' ? 'suppliers' : 'parties'} matched this view.
          </p>
          <p className="text-sm text-[var(--ink-muted)]">
            Tap the <strong>Munim Voice Orb</strong> to speak an entry, scan a parchi, or add a
            party manually.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={SPRING_FAST}
              type="button"
              onClick={onOpenVoiceEntry}
              className="min-h-[44px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-2 shadow-sm"
            >
              <Mic className="w-4 h-4" />
              <span>{t.voiceEntry}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() =>
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
              }
              className="min-h-[44px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] text-xs font-bold inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-[var(--brand-accent)]" />
              <span>{filterChip === 'supplier' ? t.addSupplier : t.addCustomer}</span>
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredAccounts.map((acc, idx) => {
            const absBal = Math.abs(acc.balance);
            const statusText =
              acc.balance > 0 ? t.due : acc.balance < 0 ? t.advance : t.settled;
            const overLimit = Boolean(
              acc.creditLimit && acc.creditLimit > 0 && acc.balance > acc.creditLimit
            );
            const trust = trustScoresByAccount[acc.id];
            const hintText =
              trust && acc.kind === 'customer'
                ? `Trust ${trust.score}/100`
                : acc.lastNote || (acc.phone ? `+91 ${acc.phone}` : 'Tap for ledger');
            const isSelected = Boolean(selectedAccountId && selectedAccountId === acc.id);

            return (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  ...SPRING_FAST,
                  delay: Math.min(idx, 12) * 0.04,
                }}
                className={`relative rounded-[24px] min-h-[146px] shadow-[0_10px_25px_-8px_rgba(15,23,42,0.08)] dark:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.6)] ${
                  isSelected
                    ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand-accent)]/50'
                    : 'bg-[var(--surface)] ring-1 ring-white/85 dark:ring-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAccount(acc)}
                  aria-label={`Open ${acc.name} khata`}
                  className="w-full h-full p-3.5 flex flex-col justify-between gap-3 text-left rounded-[24px] active:scale-[0.98] transition"
                >
                  {/* Top Row: Trust Avatar Ring (reserves right padding for + ₹ button) */}
                  <div className="flex items-start pr-12">
                    <TrustAvatarRing
                      name={acc.name}
                      score={trust?.score ?? 100}
                      hasTrust={Boolean(trust && acc.kind === 'customer')}
                      size="sm"
                    />
                  </div>

                  {/* Middle Row: Party Name + Trust/Hint */}
                  <div className="min-w-0 w-full space-y-0.5">
                    <p className="text-[15px] font-extrabold text-[var(--ink)] leading-snug truncate">
                      {acc.name}
                    </p>
                    <p
                      className={`text-[11px] font-semibold truncate ${
                        trust?.band === 'high-risk' && acc.balance > 0
                          ? 'text-[var(--credit-red)]'
                          : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {overLimit ? `Over Limit · ${formatINR(acc.creditLimit || 0)}` : hintText}
                    </p>
                  </div>

                  {/* Bottom Row: Large Tabular Balance + Status Pill */}
                  <div className="w-full flex items-baseline justify-between gap-1.5 pt-1 border-t border-black/5 dark:border-white/5">
                    <p
                      className={`font-display text-lg font-extrabold font-tabular truncate ${
                        acc.balance > 0
                          ? 'text-[var(--credit-red)]'
                          : acc.balance < 0
                            ? 'text-[var(--debit-green)]'
                            : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {hideBalance ? '₹••••' : formatINR(absBal)}
                    </p>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                        overLimit
                          ? 'text-[var(--alert-amber)]'
                          : acc.balance > 0
                            ? 'text-[var(--credit-red)]/85'
                            : acc.balance < 0
                              ? 'text-[var(--debit-green)]/85'
                              : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {overLimit ? 'Limit' : statusText}
                    </span>
                  </div>
                </button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => openQuickEntrySheet(acc)}
                  aria-label={`Quick ₹ entry for ${acc.name}`}
                  className="absolute top-2.5 right-2.5 z-10 min-w-[44px] min-h-[44px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] font-extrabold text-xs inline-flex items-center justify-center gap-0.5 shadow-inner"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>₹</span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Inline + ₹ Quick-Entry Spring Bottom Sheet (<2s Rush-Hour Counter Logging) */}
      <AnimatePresence>
        {quickEntryAccount && (
          <motion.div
            key="quick-entry-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Quick entry for ${quickEntryAccount.name}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!quickSaving) setQuickEntryAccount(null);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center backdrop-blur-sm"
          >
            <motion.div
              key="quick-entry-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (!quickSaving && info.offset.y > 110) {
                  setQuickEntryAccount(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet ring-1 ring-white/80 dark:ring-white/10 p-6 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto cursor-grab" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TrustAvatarRing
                    name={quickEntryAccount.name}
                    score={trustScoresByAccount[quickEntryAccount.id]?.score ?? 100}
                    hasTrust={Boolean(
                      trustScoresByAccount[quickEntryAccount.id] &&
                        quickEntryAccount.kind === 'customer'
                    )}
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-extrabold text-[var(--ink)] truncate">
                      {quickEntryAccount.name}
                    </h3>
                    <p
                      className={`text-xs font-bold font-tabular ${
                        quickEntryAccount.balance > 0
                          ? 'text-[var(--credit-red)]'
                          : quickEntryAccount.balance < 0
                            ? 'text-[var(--debit-green)]'
                            : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      Current: {hideBalance ? '₹••••' : formatINR(Math.abs(quickEntryAccount.balance))}{' '}
                      {quickEntryAccount.balance > 0
                        ? t.due
                        : quickEntryAccount.balance < 0
                          ? t.advance
                          : t.settled}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={quickSaving}
                  onClick={() => setQuickEntryAccount(null)}
                  aria-label="Close quick entry"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tactile 2-Way Udhaar vs Jama Toggle */}
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => setQuickDirection('given')}
                  className={`min-h-[48px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-1.5 ${
                    quickDirection === 'given'
                      ? 'bg-[var(--credit-red)] text-white shadow-md'
                      : 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 shrink-0" />
                  <span>Given (Udhaar)</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => setQuickDirection('received')}
                  className={`min-h-[48px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-1.5 ${
                    quickDirection === 'received'
                      ? 'bg-[var(--debit-green)] text-white shadow-md'
                      : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                  }`}
                >
                  <ArrowDown className="w-4 h-4 shrink-0" />
                  <span>Received (Jama)</span>
                </motion.button>
              </div>

              {/* Large Auto-Focused Numeric Amount Input */}
              <div className="rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-4 py-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-[var(--brand-accent)]">
                <span
                  className={`font-display text-3xl font-extrabold ${
                    quickDirection === 'given'
                      ? 'text-[var(--credit-red)]'
                      : 'text-[var(--debit-green)]'
                  }`}
                >
                  ₹
                </span>
                <input
                  ref={quickAmountInputRef}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={quickAmount}
                  onChange={(e) => {
                    setQuickError('');
                    setQuickAmount(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !quickSaving) {
                      void handleSaveQuickEntry();
                    }
                  }}
                  placeholder="0"
                  className="w-full bg-transparent font-display text-3xl font-extrabold font-tabular text-[var(--ink)] outline-none"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[100, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setQuickError('');
                      const nextVal = Math.round(((Number(quickAmount) || 0) + preset) * 100) / 100;
                      setQuickAmount(String(nextVal));
                    }}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[var(--surface-subtle)] text-xs font-extrabold font-tabular text-[var(--ink)] whitespace-nowrap active:scale-95 transition"
                  >
                    +₹{preset}
                  </button>
                ))}
                {quickEntryAccount.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickError('');
                      setQuickDirection('received');
                      setQuickAmount(String(Math.round(quickEntryAccount.balance * 100) / 100));
                    }}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[var(--debit-tint)] text-xs font-extrabold font-tabular text-[var(--debit-green)] whitespace-nowrap active:scale-95 transition"
                  >
                    Clear Due ({formatINR(quickEntryAccount.balance)})
                  </button>
                )}
              </div>

              {/* Optional Note + Galla Sync */}
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Note (e.g. Chini, Atta, UPI) — optional"
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3.5 text-sm font-medium text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                />

                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--app-bg)] px-3.5 py-2">
                  <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                    Sync to Galla
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
                        onClick={() => setQuickGallaMode(opt.id)}
                        className={`min-h-[34px] px-3 rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                          quickGallaMode === opt.id
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                            : 'bg-[var(--surface)] text-[var(--ink-muted)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {quickError && (
                <p className="text-xs font-bold text-[var(--credit-red)]">{quickError}</p>
              )}

              <motion.button
                whileTap={{ scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                disabled={quickSaving}
                onClick={handleSaveQuickEntry}
                className={`w-full min-h-[52px] rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 ${
                  quickDirection === 'received' ? 'bg-[var(--debit-green)]' : 'bg-[var(--credit-red)]'
                }`}
              >
                <Check className="w-5 h-5" />
                <span>
                  {quickSaving
                    ? 'Saving...'
                    : quickDirection === 'received'
                      ? 'Save Received (Jama)'
                      : 'Save Given (Udhaar)'}
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Filter & Sort Spring Bottom Sheet */}
      <AnimatePresence>
        {showFilterSortSheet && (
          <motion.div
            key="filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFilterSortSheet(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center backdrop-blur-sm"
          >
            <motion.div
              key="filter-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110) setShowFilterSortSheet(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet ring-1 ring-white/80 dark:ring-white/10 p-6 space-y-5 max-h-[85dvh] overflow-y-auto pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto cursor-grab" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Filter &amp; Sort Ledger
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFilterSortSheet(false)}
                  aria-label="Close filter and sort"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  Filter Parties
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FILTER_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterChip(f.id)}
                      className={`min-h-[44px] px-3 rounded-2xl text-xs font-bold text-left flex items-center justify-between active:scale-95 transition ${
                        filterChip === f.id
                          ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]/40'
                          : 'bg-[var(--app-bg)] text-[var(--ink)]'
                      }`}
                    >
                      <span className="truncate">{f.label}</span>
                      {filterChip === f.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
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
                      className={`w-full min-h-[46px] px-4 rounded-2xl flex items-center justify-between text-sm font-bold active:scale-[0.98] transition ${
                        sortBy === opt.id
                          ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                          : 'bg-[var(--app-bg)]/70 hover:bg-[var(--surface-subtle)] text-[var(--ink)]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Customer / Supplier Spring Bottom Sheet */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            key="add-party-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!addingBusy) setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center backdrop-blur-sm"
          >
            <motion.div
              key="add-party-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (!addingBusy && info.offset.y > 110) setShowAddModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet ring-1 ring-white/80 dark:ring-white/10 p-6 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto cursor-grab" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Add {newKind === 'supplier' ? 'Supplier' : 'Customer'} By Yourself
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close add party"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewKind('customer')}
                  className={`min-h-[44px] rounded-2xl text-sm font-bold active:scale-95 transition ${
                    newKind === 'customer'
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]/40'
                      : 'bg-[var(--app-bg)] text-[var(--ink)]'
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setNewKind('supplier')}
                  className={`min-h-[44px] rounded-2xl text-sm font-bold active:scale-95 transition ${
                    newKind === 'supplier'
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]/40'
                      : 'bg-[var(--app-bg)] text-[var(--ink)]'
                  }`}
                >
                  Supplier
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--brand-accent)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ramesh Kirana"
                    className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-2 ring-[var(--brand-accent)]/60 px-3.5 text-base font-bold text-[var(--ink)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3.5 text-base font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3 text-sm font-tabular text-[var(--ink)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                      Credit Limit ₹
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newCreditLimit}
                      onChange={(e) => setNewCreditLimit(e.target.value)}
                      placeholder="5000"
                      className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] ring-1 ring-black/5 dark:ring-white/10 px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none"
                    />
                  </div>
                </div>
              </div>

              {addError && <p className="text-sm font-bold text-[var(--credit-red)]">{addError}</p>}

              <motion.button
                whileTap={{ scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                disabled={addingBusy}
                onClick={handleAddSubmit}
                className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-base shadow-md"
              >
                {addingBusy ? 'Adding...' : 'Confirm'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
