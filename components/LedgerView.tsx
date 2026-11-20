'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  Delete,
  Eye,
  EyeOff,
  Filter,
  MessageSquare,
  Mic,
  Plus,
  Sparkles,
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
import {
  applyKeypadKey,
  computeNetCashflowSummary,
  getTopDuePartiesToday,
  type KeypadKey,
} from '@/lib/ucred-intelligence';
import { AnimatedRupeeNumber } from './AnimatedRupeeNumber';
import { SmartEntrySavedStage } from './SmartEntrySavedStage';
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
  recentlyUpdatedAccountId?: string | null;
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
  onSwipeRemind?: (account: LedgerAccount) => void;
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
const SPRING_FAST = { type: 'spring' as const, stiffness: 420, damping: 28 };
const SPRING_SHEET = { type: 'spring' as const, stiffness: 360, damping: 32 };
const KEYPAD_KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

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
        <motion.circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeWidth="2.8"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped / 100 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
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

interface SwipeablePartyCardProps {
  account: LedgerAccount;
  idx: number;
  trust?: CustomerTrustScore;
  hideBalance: boolean;
  isSelected: boolean;
  isRecentlySaved: boolean;
  dueLabel: string;
  advanceLabel: string;
  settledLabel: string;
  onSelect: (acc: LedgerAccount) => void;
  onQuickAdd: (acc: LedgerAccount, presetDirection: TxDirection) => void;
  onSwipeRemind?: (acc: LedgerAccount) => void;
}

const SwipeablePartyCard: React.FC<SwipeablePartyCardProps> = ({
  account,
  idx,
  trust,
  hideBalance,
  isSelected,
  isRecentlySaved,
  dueLabel,
  advanceLabel,
  settledLabel,
  onSelect,
  onQuickAdd,
  onSwipeRemind,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const bind = useDrag(
    ({ down, movement: [mx], tap }) => {
      if (tap) {
        setDragX(0);
        setIsDragging(false);
        return;
      }
      if (down) {
        const clamped = Math.max(-88, Math.min(88, mx * 0.72));
        setIsDragging(true);
        setDragX(clamped);
      } else {
        setIsDragging(false);
        setDragX(0);
        if (mx > 60) {
          onQuickAdd(account, 'received');
        } else if (mx < -60) {
          if (onSwipeRemind) onSwipeRemind(account);
          else onSelect(account);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      threshold: 10,
    }
  );

  const absBal = Math.abs(account.balance);
  const statusText =
    account.balance > 0 ? dueLabel : account.balance < 0 ? advanceLabel : settledLabel;
  const overLimit = Boolean(
    account.creditLimit && account.creditLimit > 0 && account.balance > account.creditLimit
  );
  const hintText =
    trust && account.kind === 'customer'
      ? `Trust ${trust.score}/100`
      : account.lastNote || (account.phone ? `+91 ${account.phone}` : 'Tap for ledger');

  return (
    <div className="relative rounded-[24px] overflow-hidden touch-pan-y">
      {/* Solid Underlay Swipe Hints */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[24px] flex items-center justify-between px-3 pointer-events-none bg-[var(--surface-subtle)]"
      >
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--debit-green)]">
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Receive</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--brand-accent)]">
          <span>Remind</span>
          <MessageSquare className="w-3.5 h-3.5" />
        </span>
      </div>

      <motion.div
        {...(bind() as Record<string, unknown>)}
        style={{ touchAction: 'pan-y' }}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{
          opacity: 1,
          y: 0,
          x: dragX,
          scale: isRecentlySaved ? 1.03 : 1,
        }}
        whileHover={{ y: -2 }}
        transition={
          isDragging
            ? { duration: 0 }
            : { ...SPRING_FAST, delay: Math.min(idx, 10) * 0.03 }
        }
        className={`relative rounded-[24px] min-h-[150px] spatial-card ${
          isRecentlySaved
            ? 'bg-[var(--debit-tint)] ring-2 ring-[var(--debit-green)]'
            : isSelected
              ? 'bg-[var(--brand-tint)] ring-2 ring-[var(--brand)]'
              : 'bg-[var(--surface)]'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(account)}
          aria-label={`Open ${account.name} khata`}
          className="w-full h-full p-3.5 flex flex-col justify-between gap-3 text-left rounded-[24px] active:scale-[0.98] transition"
        >
          {/* Top Row: Trust Avatar Ring */}
          <div className="flex items-start pr-12">
            <TrustAvatarRing
              name={account.name}
              score={trust?.score ?? 100}
              hasTrust={Boolean(trust && account.kind === 'customer')}
              size="sm"
            />
          </div>

          {/* Middle Row: Party Name + Trust/Hint */}
          <div className="min-w-0 w-full space-y-0.5">
            <p className="text-[15px] font-extrabold text-[var(--ink)] leading-snug truncate">
              {account.name}
            </p>
            <p
              className={`text-[11px] font-semibold truncate ${
                trust?.band === 'high-risk' && account.balance > 0
                  ? 'text-[var(--credit-red)]'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              {overLimit ? `Over Limit · ${formatINR(account.creditLimit || 0)}` : hintText}
            </p>
          </div>

          {/* Bottom Row: Rolling Tabular Balance + Status Label */}
          <div className="w-full flex items-baseline justify-between gap-1.5 pt-2 border-t border-[var(--surface-subtle)]">
            <p
              className={`font-display text-lg font-extrabold truncate ${
                account.balance > 0
                  ? 'text-[var(--credit-red)]'
                  : account.balance < 0
                    ? 'text-[var(--debit-green)]'
                    : 'text-[var(--ink-muted)]'
              }`}
            >
              <AnimatedRupeeNumber value={absBal} hidden={hideBalance} />
            </p>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                overLimit
                  ? 'text-[var(--alert-amber)]'
                  : account.balance > 0
                    ? 'text-[var(--credit-red)]'
                    : account.balance < 0
                      ? 'text-[var(--debit-green)]'
                      : 'text-[var(--ink-muted)]'
              }`}
            >
              {overLimit ? 'Limit' : statusText}
            </span>
          </div>
        </button>

        <motion.button
          whileTap={{ scale: 0.9, y: 1 }}
          transition={SPRING_FAST}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd(account, 'given');
          }}
          aria-label={`Quick ₹ entry for ${account.name}`}
          className="absolute top-2.5 right-2.5 z-10 min-w-[44px] min-h-[44px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] font-extrabold text-xs inline-flex items-center justify-center gap-0.5 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>₹</span>
        </motion.button>
      </motion.div>
    </div>
  );
};

export const LedgerView: React.FC<LedgerViewProps> = ({
  accounts,
  transactions,
  stockItems,
  language,
  searchQuery,
  gallaPulse,
  trustScoresByAccount,
  selectedAccountId,
  recentlyUpdatedAccountId,
  hideBalance,
  onToggleHideBalance,
  addPartySignal = 0,
  onSelectAccount,
  onCreateAccount,
  onQuickTransaction,
  onSwipeRemind,
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
  const [heroExpanded, setHeroExpanded] = useState(false);

  // Add Customer / Supplier Bottom Sheet
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKind, setNewKind] = useState<AccountKind>('customer');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Custom 3D Keypad Quick Entry Bottom Sheet
  const [quickEntryAccount, setQuickEntryAccount] = useState<LedgerAccount | null>(null);
  const [quickDirection, setQuickDirection] = useState<TxDirection>('given');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickGallaMode, setQuickGallaMode] = useState<CashbookMode | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickCelebration, setQuickCelebration] = useState<{
    partyName: string;
    previousBalance: number;
    newBalance: number;
    amount: number;
    direction: TxDirection;
  } | null>(null);
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickEntryAccount && !quickSaving && !quickCelebration) setQuickEntryAccount(null);
      else if (showFilterSortSheet) setShowFilterSortSheet(false);
      else if (showAddModal && !addingBusy) setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickEntryAccount, quickSaving, quickCelebration, showFilterSortSheet, showAddModal, addingBusy]);

  const cashflow = useMemo(() => computeNetCashflowSummary(accounts), [accounts]);

  const topDueParties = useMemo(
    () => getTopDuePartiesToday(accounts, trustScoresByAccount, todayStr, 3),
    [accounts, trustScoresByAccount, todayStr]
  );

  const todayStats = useMemo(() => {
    let entriesToday = 0;
    const activeDates = new Set<string>();
    for (const tx of transactions) {
      const dateKey = (tx.billDate || '').slice(0, 10);
      if (dateKey) activeDates.add(dateKey);
      if (dateKey === todayStr) entriesToday += 1;
    }
    const overdueCount = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate !== '' && a.dueDate <= todayStr
    ).length;
    const lowStockCount = stockItems.filter((s) => s.quantity <= s.lowStockThreshold).length;
    return {
      entriesToday,
      activeDays: Math.max(activeDates.size, accounts.length > 0 ? 1 : 0),
      overdueCount,
      lowStockCount,
    };
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
      setAddError('Enter party name first.');
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

  const openQuickEntrySheet = (acc: LedgerAccount, presetDirection: TxDirection = 'given') => {
    setQuickEntryAccount(acc);
    setQuickDirection(presetDirection);
    setQuickAmount('');
    setQuickNote('');
    setQuickGallaMode(null);
    setQuickError('');
    setQuickCelebration(null);
  };

  const handleSaveQuickEntry = async () => {
    if (!quickEntryAccount) return;
    setQuickError('');
    const amt = Math.round((Number(quickAmount) || 0) * 100) / 100;
    if (amt <= 0) {
      setQuickError('Tap keypad digits above to enter an amount greater than ₹0.');
      return;
    }

    const prevBal = quickEntryAccount.balance;
    const projectedBal =
      quickDirection === 'given'
        ? Math.round((prevBal + amt) * 100) / 100
        : Math.round((prevBal - amt) * 100) / 100;

    setQuickSaving(true);
    try {
      await onQuickTransaction(quickEntryAccount, {
        direction: quickDirection,
        amount: amt,
        note: quickNote.trim(),
        syncToGalla: quickGallaMode ? { mode: quickGallaMode } : null,
      });

      setQuickCelebration({
        partyName: quickEntryAccount.name,
        previousBalance: prevBal,
        newBalance: projectedBal,
        amount: amt,
        direction: quickDirection,
      });

      window.setTimeout(() => {
        setQuickCelebration(null);
        setQuickEntryAccount(null);
        setQuickSaving(false);
      }, 1250);
    } catch (err) {
      setQuickSaving(false);
      setQuickError(err instanceof Error ? err.message : 'Failed to save entry.');
    }
  };

  const activeFilterLabel =
    FILTER_OPTIONS.find((f) => f.id === filterChip)?.label || 'All Customers';
  const hasSecondaryFilter = filterChip !== 'customer' && filterChip !== 'supplier';

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;

  return (
    <div className="space-y-3.5 pb-32">
      {/* 1. Expandable 'Net Receivable' Hero Bento Card (Zero Glass · Twinkling Sparkles · Odometer · Bar) */}
      <section
        aria-label="Net Receivable Hero"
        className="rounded-[28px] spatial-hero p-4 space-y-3 relative overflow-hidden"
      >
        {/* Subtle Twinkling Sparkle Stars (Safe Padding — Zero Pill Collisions) */}
        <span
          aria-hidden="true"
          className="twinkle-star pointer-events-none absolute top-14 right-4 text-[var(--brand-accent)]"
        >
          <Sparkles className="w-3 h-3" />
        </span>
        <span
          aria-hidden="true"
          style={{ animationDelay: '1.1s' }}
          className="twinkle-star pointer-events-none absolute top-12 left-4 text-amber-400"
        >
          <Sparkles className="w-3 h-3" />
        </span>
        <span
          aria-hidden="true"
          style={{ animationDelay: '2.1s' }}
          className="twinkle-star pointer-events-none absolute top-[72px] right-24 text-cyan-500"
        >
          <Sparkles className="w-3 h-3" />
        </span>

        {/* Top Row: Hero Label + Expand Drawer Button | Privacy Eye + Munim Sunao */}
        <div className="relative z-10 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => setHeroExpanded((v) => !v)}
            aria-expanded={heroExpanded}
            className="min-h-[34px] inline-flex items-center gap-1 text-left whitespace-nowrap shrink-0 active:scale-95 transition"
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-muted)] whitespace-nowrap">
              {netPositive ? 'Net Receivable' : netNegative ? 'Net Payable' : 'All Settled'}
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[10px] font-extrabold text-[var(--ink-muted)] inline-flex items-center gap-0.5 whitespace-nowrap">
              <span>Top Due</span>
              <motion.span
                animate={{ rotate: heroExpanded ? 180 : 0 }}
                transition={SPRING_FAST}
                className="inline-flex"
              >
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={SPRING_FAST}
              type="button"
              onClick={onToggleHideBalance}
              aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
              className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={SPRING_FAST}
              type="button"
              onClick={onOpenDailySummary}
              className="min-h-[34px] px-2.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand-accent)] text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>Munim Sunao</span>
            </motion.button>
          </div>
        </div>

        {/* Hero Odometer Balance + Quick Vasooli Link */}
        <div className="relative z-10 flex items-end justify-between gap-2">
          <div>
            <p
              className={`font-display text-[32px] font-extrabold leading-none tracking-tight ${
                netPositive
                  ? 'text-[var(--debit-green)]'
                  : netNegative
                    ? 'text-[var(--credit-red)]'
                    : 'text-[var(--ink)]'
              }`}
            >
              <AnimatedRupeeNumber
                value={Math.abs(cashflow.netCashflow)}
                hidden={hideBalance}
                prefix={netNegative ? '-' : ''}
              />
            </p>
            <p className="text-xs font-semibold text-[var(--ink-muted)] mt-1">
              Across {accounts.length} {accounts.length === 1 ? 'party' : 'parties'} · Tap Top Due to
              inspect
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCollection}
            className="min-h-[36px] px-3.5 rounded-full bg-[var(--surface-subtle)] text-xs font-extrabold text-[var(--ink)] inline-flex items-center gap-1 shrink-0 active:scale-95 transition"
          >
            <span>Vasooli</span>
            {todayStats.overdueCount > 0 && (
              <span className="text-[var(--credit-red)] font-tabular">
                · {todayStats.overdueCount}
              </span>
            )}
          </button>
        </div>

        {/* Animated Green-vs-Red Ratio Capsule Bar with Shimmer Sweep */}
        <div className="relative z-10 space-y-1">
          <div className="h-2.5 w-full rounded-full bg-[var(--credit-tint)] overflow-hidden relative">
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${cashflow.receivableSharePct}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              className="h-full rounded-full bg-[var(--debit-green)] relative overflow-hidden"
            >
              <span
                aria-hidden="true"
                className="bar-shimmer-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 pointer-events-none"
              />
            </motion.div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)] font-tabular">
            <span>Lena {cashflow.receivableSharePct}%</span>
            <span>Dena {cashflow.payableSharePct}%</span>
          </div>
        </div>

        {/* 3 Equal Solid Pastel Micro-Pills */}
        <div className="relative z-10 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[var(--debit-tint)] px-2.5 py-2 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--debit-green)] whitespace-nowrap">
              <ArrowDown className="w-3 h-3 shrink-0" />
              <span>Lena</span>
            </div>
            <p className="font-display text-xs font-extrabold text-[var(--debit-green)] truncate">
              <AnimatedRupeeNumber value={cashflow.totalReceivable} hidden={hideBalance} />
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--credit-tint)] px-2.5 py-2 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--credit-red)] whitespace-nowrap">
              <ArrowUp className="w-3 h-3 shrink-0" />
              <span>Dena</span>
            </div>
            <p className="font-display text-xs font-extrabold text-[var(--credit-red)] truncate">
              <AnimatedRupeeNumber value={cashflow.totalPayable} hidden={hideBalance} />
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={SPRING_FAST}
            type="button"
            onClick={onOpenGalla}
            className="rounded-2xl bg-[var(--brand-tint)] px-2.5 py-2 text-left space-y-0.5"
          >
            <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--brand-accent)] whitespace-nowrap">
              <Wallet className="w-3 h-3 shrink-0" />
              <span>Live Galla</span>
            </div>
            <p className="font-display text-xs font-extrabold text-[var(--brand-accent)] truncate">
              <AnimatedRupeeNumber value={gallaPulse.cashDrawerBalance} hidden={hideBalance} />
            </p>
          </motion.button>
        </div>

        {/* Expandable Spring Drawer: Top 3 Due Parties Today */}
        <AnimatePresence initial={false}>
          {heroExpanded && (
            <motion.div
              key="top-due-drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="overflow-hidden relative z-10"
            >
              <div className="pt-3 border-t border-[var(--surface-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
                    Top 3 Due Parties Today
                  </p>
                  <button
                    type="button"
                    onClick={onOpenCollection}
                    className="text-[11px] font-extrabold text-[var(--brand-accent)] hover:underline"
                  >
                    Open Vasooli
                  </button>
                </div>

                {topDueParties.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--app-bg)] p-3 text-xs font-semibold text-[var(--ink-muted)] text-center">
                    Zero overdue dues right now — clean books!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {topDueParties.map((spot) => (
                      <div
                        key={spot.account.id}
                        className="rounded-2xl bg-[var(--app-bg)] px-3 py-2.5 flex items-center justify-between gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectAccount(spot.account)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span
                            style={{ backgroundColor: getAvatarColor(spot.account.name) }}
                            className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                          >
                            {spot.account.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-[var(--ink)] truncate">
                              {spot.account.name}
                            </p>
                            <p
                              className={`text-[10px] font-bold truncate ${
                                spot.isDueTodayOrOverdue
                                  ? 'text-[var(--credit-red)]'
                                  : 'text-[var(--ink-muted)]'
                              }`}
                            >
                              {spot.urgencyLabel} · Trust {spot.trustScore}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold font-tabular text-[var(--credit-red)]">
                            {hideBalance ? '₹••••' : formatINR(spot.account.balance)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openQuickEntrySheet(spot.account, 'received')}
                            aria-label={`Collect from ${spot.account.name}`}
                            className="min-h-[34px] px-2.5 rounded-xl bg-[var(--debit-tint)] text-[var(--debit-green)] text-[11px] font-extrabold active:scale-95 transition"
                          >
                            + ₹
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 2. Solid Warm 'Shop Streak' (👋 waving) + 'Today Est. Profit' Bento Bar */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        transition={SPRING_FAST}
        type="button"
        onClick={onOpenGalla}
        className="w-full rounded-[24px] px-4 py-3 flex items-center justify-between gap-3 text-left spatial-card bg-gradient-to-r from-[#FFF7ED] via-[#FEF3C7] to-[#FFEDD5] dark:from-[#291D12] dark:via-[#261D0D] dark:to-[#2C1A10]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="w-10 h-10 rounded-2xl bg-[var(--surface)] shadow-xs flex items-center justify-center text-lg shrink-0"
          >
            <span className="wave-hand">👋</span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-amber-950 dark:text-amber-200 truncate">
              Shop Streak · {todayStats.activeDays}{' '}
              {todayStats.activeDays === 1 ? 'Day' : 'Days'} Active
            </p>
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 truncate">
              {todayStats.entriesToday} {todayStats.entriesToday === 1 ? 'entry' : 'entries'} today
              · Live Galla
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Est. Profit
          </p>
          <p
            className={`font-display text-base font-extrabold ${
              gallaPulse.estimatedDailyProfit >= 0
                ? 'text-[var(--debit-green)]'
                : 'text-[var(--credit-red)]'
            }`}
          >
            <AnimatedRupeeNumber
              value={Math.abs(gallaPulse.estimatedDailyProfit)}
              hidden={hideBalance}
              prefix={gallaPulse.estimatedDailyProfit >= 0 ? '+' : '-'}
            />
          </p>
        </div>
      </motion.button>

      {/* 3. Elastic Segmented Control (Customer / Supplier) + Filter & Sort */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative grid grid-cols-2 rounded-full bg-[var(--surface-subtle)] p-1 flex-1 max-w-[235px]">
          <button
            type="button"
            onClick={() => setFilterChip('customer')}
            className={`relative min-h-[40px] px-3 rounded-full text-xs font-extrabold transition-colors ${
              filterChip === 'customer' ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
            }`}
          >
            {filterChip === 'customer' && !hasSecondaryFilter && (
              <motion.span
                layoutId="ledgerKindPill"
                transition={SPRING_FAST}
                className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-sm"
              />
            )}
            <span className="relative z-10">{t.customer}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterChip('supplier')}
            className={`relative min-h-[40px] px-3 rounded-full text-xs font-extrabold transition-colors ${
              filterChip === 'supplier' ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
            }`}
          >
            {filterChip === 'supplier' && !hasSecondaryFilter && (
              <motion.span
                layoutId="ledgerKindPill"
                transition={SPRING_FAST}
                className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-sm"
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
          className={`min-h-[44px] px-3.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 ${
            hasSecondaryFilter || sortBy !== 'latest-activity'
              ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-sm'
              : 'spatial-card text-[var(--ink)]'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter & Sort'}</span>
        </motion.button>
      </div>

      {/* 4. 2-Column Swipeable Bento Party Grid or Playful Growing Sprout Empty State */}
      {accounts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING_FAST}
          className="rounded-[26px] spatial-card p-5 space-y-3.5 text-center"
        >
          {/* Playful Growing Sprout Illustration */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--debit-tint)] flex items-center justify-center">
              <svg
                viewBox="0 0 48 48"
                className="w-8 h-8 sprout-grow"
                fill="none"
                aria-hidden="true"
              >
                <path d="M24 38V20" stroke="#15803D" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M24 26C17.5 26 14 21.5 14 15.5C20 15.5 24 19.5 24 26Z" fill="#22C55E" />
                <path d="M24 22C30.5 22 34 17.5 34 11.5C28 11.5 24 15.5 24 22Z" fill="#15803D" />
                <path
                  d="M15 39H33"
                  stroke="#15803D"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeOpacity="0.4"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
              Ready For Live Shop Records
            </p>
            <h1 className="font-display text-lg font-extrabold text-[var(--ink)]">
              Start Your Real Shop Khata
            </h1>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Add your first party, tap the blue-cyan orb below to speak, or snap a parchi slip.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.96, y: 2 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() =>
                handleOpenAddModal(filterChip === 'supplier' ? 'supplier' : 'customer')
              }
              className="tactile-key-primary min-h-[48px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2"
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
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-[11px] font-extrabold whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span>Speak Entry</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={SPRING_FAST}
                type="button"
                onClick={onOpenParchiScanner}
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--app-bg)] text-[11px] font-bold text-[var(--ink)] whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
                <span>Scan Parchi</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : filteredAccounts.length === 0 ? (
        <div className="rounded-[26px] spatial-card p-8 text-center space-y-3">
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No {filterChip === 'supplier' ? 'suppliers' : 'parties'} matched this view.
          </p>
          <p className="text-sm text-[var(--ink-muted)]">
            Tap the glowing Voice Orb below, scan a parchi, or add a party manually.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
            <motion.button
              whileTap={{ scale: 0.95, y: 2 }}
              transition={SPRING_FAST}
              type="button"
              onClick={onOpenVoiceEntry}
              className="tactile-key-primary min-h-[44px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-2"
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
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3.5">
            {filteredAccounts.map((acc, idx) => (
              <SwipeablePartyCard
                key={acc.id}
                account={acc}
                idx={idx}
                trust={trustScoresByAccount[acc.id]}
                hideBalance={hideBalance}
                isSelected={Boolean(selectedAccountId && selectedAccountId === acc.id)}
                isRecentlySaved={Boolean(
                  recentlyUpdatedAccountId && recentlyUpdatedAccountId === acc.id
                )}
                dueLabel={t.due}
                advanceLabel={t.advance}
                settledLabel={t.settled}
                onSelect={onSelectAccount}
                onQuickAdd={openQuickEntrySheet}
                onSwipeRemind={onSwipeRemind}
              />
            ))}
          </div>
          <p className="text-[10px] font-semibold text-center text-[var(--ink-muted)] pt-1">
            Tip: Swipe any card right to quick-receive ₹ or left to remind
          </p>
        </div>
      )}

      {/* 5. Custom 3D Tactile Numeric Keypad Quick-Entry Bottom Sheet */}
      <AnimatePresence>
        {quickEntryAccount && (
          <motion.div
            key="quick-entry-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Quick entry for ${quickEntryAccount.name}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={() => {
              if (!quickSaving && !quickCelebration) setQuickEntryAccount(null);
            }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          >
            <motion.div
              key="quick-entry-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{
                y: '100%',
                transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              }}
              transition={SPRING_SHEET}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-5 pt-3 space-y-3.5 max-h-[92dvh] overflow-y-auto no-scrollbar pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto" />

              {quickCelebration ? (
                <SmartEntrySavedStage
                  partyName={quickCelebration.partyName}
                  previousBalance={quickCelebration.previousBalance}
                  newBalance={quickCelebration.newBalance}
                  amount={quickCelebration.amount}
                  direction={quickCelebration.direction}
                />
              ) : (
                <>
                  {/* Party Trust Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrustAvatarRing
                        name={quickEntryAccount.name}
                        score={trustScoresByAccount[quickEntryAccount.id]?.score ?? 100}
                        hasTrust={Boolean(
                          trustScoresByAccount[quickEntryAccount.id] &&
                            quickEntryAccount.kind === 'customer'
                        )}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-extrabold text-[var(--ink)] truncate">
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
                          Current:{' '}
                          {hideBalance
                            ? '₹••••'
                            : formatINR(Math.abs(quickEntryAccount.balance))}{' '}
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
                      className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Direction Toggle Pills */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <motion.button
                      whileTap={{ scale: 0.94, y: 1 }}
                      transition={SPRING_FAST}
                      type="button"
                      onClick={() => setQuickDirection('given')}
                      className={`min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                        quickDirection === 'given'
                          ? 'bg-[var(--credit-red)] text-white shadow-md'
                          : 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                      }`}
                    >
                      <ArrowUp className="w-4 h-4 shrink-0" />
                      <span>Given (Udhaar)</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.94, y: 1 }}
                      transition={SPRING_FAST}
                      type="button"
                      onClick={() => setQuickDirection('received')}
                      className={`min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                        quickDirection === 'received'
                          ? 'bg-[var(--debit-green)] text-white shadow-md'
                          : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                      }`}
                    >
                      <ArrowDown className="w-4 h-4 shrink-0" />
                      <span>Received (Jama)</span>
                    </motion.button>
                  </div>

                  {/* Live Tabular Amount Readout (Zero OS Keyboard Popup) */}
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-2xl bg-[var(--app-bg)] px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span
                        className={`font-display text-3xl font-extrabold ${
                          quickDirection === 'given'
                            ? 'text-[var(--credit-red)]'
                            : 'text-[var(--debit-green)]'
                        }`}
                      >
                        ₹
                      </span>
                      <span
                        data-testid="quick-keypad-amount"
                        className="font-display text-3xl font-extrabold font-tabular text-[var(--ink)] truncate"
                      >
                        {quickAmount || '0'}
                      </span>
                    </div>
                    {quickAmount !== '' && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickError('');
                          setQuickAmount((prev) => applyKeypadKey(prev, 'clear'));
                        }}
                        className="min-h-[32px] px-2.5 rounded-xl bg-[var(--surface)] text-[11px] font-bold text-[var(--ink-muted)] shadow-xs active:scale-95 transition shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Quick Increment Chips */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {(['+100', '+500', '+2000'] as const).map((presetKey) => (
                      <motion.button
                        key={presetKey}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING_FAST}
                        type="button"
                        onClick={() => {
                          setQuickError('');
                          setQuickAmount((prev) => applyKeypadKey(prev, presetKey));
                        }}
                        className="min-h-[36px] px-3.5 rounded-xl bg-[var(--surface-subtle)] text-xs font-extrabold font-tabular text-[var(--ink)] whitespace-nowrap shrink-0"
                      >
                        +₹{presetKey.slice(1)}
                      </motion.button>
                    ))}
                    {quickEntryAccount.balance > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING_FAST}
                        type="button"
                        onClick={() => {
                          setQuickError('');
                          setQuickDirection('received');
                          setQuickAmount(String(Math.round(quickEntryAccount.balance * 100) / 100));
                        }}
                        className="min-h-[36px] px-3.5 rounded-xl bg-[var(--debit-tint)] text-xs font-extrabold font-tabular text-[var(--debit-green)] whitespace-nowrap shrink-0"
                      >
                        Clear Due ({formatINR(quickEntryAccount.balance)})
                      </motion.button>
                    )}
                  </div>

                  {/* Custom 3D Tactile Numeric Keypad (1-9, ., 0, ⌫) */}
                  <div className="grid grid-cols-3 gap-2">
                    {KEYPAD_KEYS.map((key) => {
                      const isBackspace = key === 'backspace';
                      return (
                        <motion.button
                          key={key}
                          type="button"
                          disabled={quickSaving}
                          whileTap={{ scale: 0.91, y: 2 }}
                          transition={SPRING_FAST}
                          aria-label={isBackspace ? 'Backspace' : `Keypad ${key}`}
                          onClick={() => {
                            setQuickError('');
                            setQuickAmount((prev) => applyKeypadKey(prev, key));
                          }}
                          className="min-h-[50px] rounded-2xl bg-[var(--app-bg)] shadow-[0_3px_0_rgba(15,23,42,0.1)] dark:shadow-[0_3px_0_rgba(0,0,0,0.55)] font-display text-lg font-extrabold font-tabular text-[var(--ink)] flex items-center justify-center hover:bg-[var(--brand-tint)] disabled:opacity-50"
                        >
                          {isBackspace ? <Delete className="w-5 h-5" /> : key}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Optional Note + Galla Sync */}
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="Optional note (e.g. Chini, Atta, UPI)"
                      className="w-full min-h-[42px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-xs font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />

                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--app-bg)] px-3.5 py-1.5">
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
                            className={`min-h-[32px] px-3 rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
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
                    <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
                      {quickError}
                    </p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.96, y: 2 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={quickSaving}
                    onClick={handleSaveQuickEntry}
                    className={`w-full min-h-[52px] rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 ${
                      quickDirection === 'received'
                        ? 'bg-[var(--debit-green)]'
                        : 'bg-[var(--credit-red)]'
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
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Filter & Sort Solid Bottom Sheet */}
      <AnimatePresence>
        {showFilterSortSheet && (
          <motion.div
            key="filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            onClick={() => setShowFilterSortSheet(false)}
            className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
          >
            <motion.div
              key="filter-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110) setShowFilterSortSheet(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-5 max-h-[85dvh] overflow-y-auto pb-safe"
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
                          ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
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
                          : 'bg-[var(--app-bg)] hover:bg-[var(--surface-subtle)] text-[var(--ink)]'
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

      {/* Add Customer / Supplier Solid Bottom Sheet */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            key="add-party-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            onClick={() => {
              if (!addingBusy) setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
          >
            <motion.div
              key="add-party-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (!addingBusy && info.offset.y > 110) setShowAddModal(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe"
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
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
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
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
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
                    className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-base font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                    className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-base font-bold font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                      className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-3 text-sm font-tabular text-[var(--ink)] outline-none"
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
                      className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none"
                    />
                  </div>
                </div>
              </div>

              {addError && <p className="text-sm font-bold text-[var(--credit-red)]">{addError}</p>}

              <motion.button
                whileTap={{ scale: 0.96, y: 2 }}
                transition={SPRING_FAST}
                type="button"
                disabled={addingBusy}
                onClick={handleAddSubmit}
                className="tactile-key-primary w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-base"
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
