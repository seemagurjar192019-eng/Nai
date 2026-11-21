'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ChevronRight,
  Delete,
  Filter,
  Mic,
  Plus,
  Repeat,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  formatDateTime,
  formatINR,
  getLocalDateKey,
  getUIStrings,
  isValidIndianMobile,
} from '@/lib/i18n';
import {
  getPersonaAdaptation,
  getPersonaCapabilities,
  type PersonaAdaptation,
  type PersonaCapabilities,
} from '@/lib/persona';
import {
  applyKeypadKey,
  computeNetCashflowSummary,
  getTopDuePartiesToday,
  type KeypadKey,
} from '@/lib/ucred-intelligence';
import type {
  AccountKind,
  CashbookEntry,
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
} from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';
import { SmartEntrySavedStage } from '../SmartEntrySavedStage';
import { PartyLedgerCard, TrustAvatarRing } from '../ledger/PartyLedgerCard';
import { MandiAadatHelper } from './MandiAadatHelper';
import { NetCashflowHero, type CashKhataSegment } from './NetCashflowHero';

export interface CashKhataFeedProps {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  stockItems: StockItem[];
  cashbookEntries?: CashbookEntry[];
  language: LanguageCode;
  searchQuery: string;
  gallaPulse: DailyGallaPulse;
  trustScoresByAccount: Record<string, CustomerTrustScore>;
  selectedAccountId?: string | null;
  recentlyUpdatedAccountId?: string | null;
  hideBalance: boolean;
  personaAdaptation?: PersonaAdaptation;
  capabilities?: PersonaCapabilities;
  showAllModes?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  heroOpacity?: MotionValue<number>;
  heroScale?: MotionValue<number>;
  heroY?: MotionValue<number>;
  jellySkew?: MotionValue<number>;
  addPartySignal?: number;
  onToggleHideBalance: () => void;
  onToggleShowAllModes?: () => void;
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
  { id: 'customer', label: 'All Parties' },
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

const SPRING_FAST = { type: 'spring' as const, stiffness: 480, damping: 26 };
const SPRING_SHEET = { type: 'spring' as const, stiffness: 360, damping: 32 };
const KEYPAD_KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

/**
 * Primary Cockpit Cash & Khata Feed.
 * Enforces strict persona gating, inline '+ New' Quick Action header pill (zero bottom-right FAB),
 * neighbor-repelling party rows, and 60fps compositor scroll motion.
 */
export const CashKhataFeed: React.FC<CashKhataFeedProps> = ({
  accounts,
  transactions,
  cashbookEntries = [],
  language,
  searchQuery,
  gallaPulse,
  trustScoresByAccount,
  selectedAccountId,
  recentlyUpdatedAccountId,
  hideBalance,
  personaAdaptation,
  capabilities: capabilitiesProp,
  showAllModes = false,
  heroOpacity,
  heroScale,
  heroY,
  jellySkew,
  addPartySignal = 0,
  onToggleHideBalance,
  onToggleShowAllModes,
  onSelectAccount,
  onCreateAccount,
  onQuickTransaction,
  onSwipeRemind,
  onOpenCollection,
  onOpenVoiceEntry,
  onOpenCounterMode,
  onOpenParchiScanner,
  onOpenGalla,
  onOpenDailySummary,
}) => {
  const t = getUIStrings(language);
  const activeAdaptation = useMemo(
    () => personaAdaptation || getPersonaAdaptation(['kirana'], 'kirana'),
    [personaAdaptation]
  );
  const capabilities = useMemo(
    () => capabilitiesProp || getPersonaCapabilities(activeAdaptation.activeFocus),
    [capabilitiesProp, activeAdaptation.activeFocus]
  );
  const prefersReducedMotion = useReducedMotion();
  const fallbackSkew = useMotionValue(0);
  const activeJellySkew = jellySkew || fallbackSkew;

  const [rawSegment, setRawSegment] = useState<CashKhataSegment>('customer');
  const [rawFilterChip, setRawFilterChip] = useState<LedgerFilterChip>('customer');
  const [sortBy, setSortBy] = useState<SortByOption>('latest-activity');
  const [showFilterSortSheet, setShowFilterSortSheet] = useState(false);
  const [showQuickMenuSheet, setShowQuickMenuSheet] = useState(false);
  const [activeHoverIdx, setActiveHoverIdx] = useState<number | null>(null);

  // Sanitize active segment/filter whenever persona gates off Suppliers or Galla
  const segment: CashKhataSegment =
    rawSegment === 'galla' && !capabilities.showGalla
      ? 'customer'
      : rawSegment === 'supplier' && !capabilities.showSuppliers
        ? 'customer'
        : rawSegment;

  const filterChip: LedgerFilterChip =
    rawFilterChip === 'supplier' && !capabilities.showSuppliers ? 'customer' : rawFilterChip;

  // Add Customer / Supplier Bottom Sheet
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKind, setNewKind] = useState<AccountKind>('customer');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Custom Tactile Numeric Keypad Quick Entry Bottom Sheet
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

  const segmentRef = useRef<CashKhataSegment>(segment);
  const todayStr = getLocalDateKey();

  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);

  useEffect(() => {
    if (!addPartySignal) return;
    const timer = setTimeout(() => {
      setNewKind(
        capabilities.showSuppliers && segmentRef.current === 'supplier' ? 'supplier' : 'customer'
      );
      setNewName('');
      setNewPhone('');
      setNewDueDate('');
      setNewCreditLimit('');
      setAddError('');
      setShowAddModal(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [addPartySignal, capabilities.showSuppliers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickEntryAccount && !quickSaving && !quickCelebration) setQuickEntryAccount(null);
      else if (showQuickMenuSheet) setShowQuickMenuSheet(false);
      else if (showFilterSortSheet) setShowFilterSortSheet(false);
      else if (showAddModal && !addingBusy) setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    quickEntryAccount,
    quickSaving,
    quickCelebration,
    showQuickMenuSheet,
    showFilterSortSheet,
    showAddModal,
    addingBusy,
  ]);

  const cashflow = useMemo(() => computeNetCashflowSummary(accounts), [accounts]);

  const topDueParties = useMemo(
    () => getTopDuePartiesToday(accounts, trustScoresByAccount, todayStr, 3),
    [accounts, trustScoresByAccount, todayStr]
  );

  const overdueCount = useMemo(
    () =>
      accounts.filter(
        (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate !== '' && a.dueDate <= todayStr
      ).length,
    [accounts, todayStr]
  );

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

  const sortedCashbookEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...cashbookEntries]
      .filter((e) =>
        !q
          ? true
          : e.category.toLowerCase().includes(q) ||
            e.note.toLowerCase().includes(q) ||
            e.mode.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))
      .slice(0, 20);
  }, [cashbookEntries, searchQuery]);

  const handleSelectSegment = (nextSeg: CashKhataSegment) => {
    haptics.tap();
    if (nextSeg === 'supplier' && !capabilities.showSuppliers) return;
    if (nextSeg === 'galla' && !capabilities.showGalla) return;
    setRawSegment(nextSeg);
    if (nextSeg === 'customer' || nextSeg === 'supplier') {
      setRawFilterChip(nextSeg);
    }
  };

  const handleOpenAddModal = (kind: AccountKind) => {
    haptics.tap();
    setNewKind(capabilities.showSuppliers ? kind : 'customer');
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
        kind: capabilities.showSuppliers ? newKind : 'customer',
        name: newName.trim(),
        phone: newPhone.trim(),
        dueDate: newDueDate,
        creditLimit: Number(newCreditLimit) || 0,
      });
      haptics.success();
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

    // Capture previousBalance BEFORE mutating account state
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
        syncToGalla: capabilities.showGalla && quickGallaMode ? { mode: quickGallaMode } : null,
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
      }, 1200);
    } catch (err) {
      setQuickSaving(false);
      setQuickError(err instanceof Error ? err.message : 'Failed to save entry.');
    }
  };

  const availableFilterOptions = useMemo(
    () =>
      FILTER_OPTIONS.filter((opt) => {
        if (opt.id === 'supplier' && !capabilities.showSuppliers) return false;
        return true;
      }),
    [capabilities.showSuppliers]
  );

  const segmentTabs = useMemo(() => {
    const list: Array<{ id: CashKhataSegment; label: string }> = [
      { id: 'customer', label: capabilities.primarySegmentLabel },
    ];
    if (capabilities.showSuppliers && capabilities.secondarySegmentLabel) {
      list.push({ id: 'supplier', label: capabilities.secondarySegmentLabel });
    }
    if (capabilities.showGalla && capabilities.gallaSegmentLabel) {
      list.push({ id: 'galla', label: capabilities.gallaSegmentLabel });
    }
    return list;
  }, [capabilities]);

  const activeFilterLabel =
    FILTER_OPTIONS.find((f) => f.id === filterChip)?.label || capabilities.primarySegmentLabel;
  const hasSecondaryFilter = filterChip !== 'customer' && filterChip !== 'supplier';

  return (
    <div className="space-y-3 pb-32">
      {/* 1. Clean Borderless Matte Total Balance Hero */}
      <NetCashflowHero
        cashflow={cashflow}
        gallaBalance={gallaPulse.cashDrawerBalance}
        partyCount={accounts.length}
        hideBalance={hideBalance}
        segment={segment}
        hasSecondaryFilter={hasSecondaryFilter}
        capabilities={capabilities}
        personaAdaptation={activeAdaptation}
        topDueParties={topDueParties}
        heroOpacity={heroOpacity}
        heroScale={heroScale}
        heroY={heroY}
        onToggleHideBalance={onToggleHideBalance}
        onSelectSegment={handleSelectSegment}
        onOpenDailySummary={onOpenDailySummary}
        onOpenCollection={onOpenCollection}
        onSelectAccount={onSelectAccount}
        onQuickCollect={openQuickEntrySheet}
      />

      {/* 2. Inline Mandi Bori / Wazan / Aadat Calculator (Mandi Mode Only) */}
      {capabilities.showMandiCalculator && <MandiAadatHelper />}

      {/* 3. Section Header with '+ New' Matte Pill & 'Filter' Pill + Persona Segment Bar */}
      <div className="space-y-2.5 pt-0.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display text-lg font-extrabold text-[var(--ink)] whitespace-nowrap">
              {capabilities.feedTitle}
            </h2>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenCollection();
                }}
                className="px-2 py-0.5 rounded-full bg-[var(--credit-tint)] text-[var(--credit-red)] text-[10px] font-extrabold shrink-0 active:scale-95 transition"
              >
                {overdueCount} due
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Inline Matte Dark '+ New' Quick Action Pill (Replaces Bottom-Right FAB) */}
            <motion.button
              whileTap={{ scale: 0.94, rotate: 4, y: 1 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() => {
                haptics.tap();
                if (capabilities.focus === 'personal') {
                  handleOpenAddModal('customer');
                } else {
                  setShowQuickMenuSheet(true);
                }
              }}
              aria-label="New party or quick entry"
              className="min-h-[36px] px-3.5 rounded-full bg-[#111827] dark:bg-white text-white dark:text-[#0B0C0E] text-xs font-extrabold inline-flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.7]" />
              <span>New</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94, rotate: -4, y: 1 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() => {
                haptics.tap();
                setShowFilterSortSheet(true);
              }}
              className={`min-h-[36px] px-3 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 ${
                hasSecondaryFilter || showAllModes || sortBy !== 'latest-activity'
                  ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-xs'
                  : 'spatial-card text-[var(--ink)]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter'}</span>
            </motion.button>
          </div>
        </div>

        {/* Sliding Pill Switcher (Hidden in Personal Mode when only Contacts exist) */}
        {segmentTabs.length > 1 && (
          <div
            className={`relative grid rounded-full bg-[var(--surface-subtle)] p-1 ${
              segmentTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {segmentTabs.map((seg) => {
              const active =
                segment === seg.id && !(seg.id !== 'galla' && hasSecondaryFilter && segment !== 'galla');
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => handleSelectSegment(seg.id)}
                  className={`relative min-h-[40px] px-2 rounded-full text-xs font-extrabold transition-colors ${
                    active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="cashKhataKindPill"
                      transition={SPRING_FAST}
                      className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{seg.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Scroll-Velocity Jelly Party List / Inline Galla / Empty State */}
      <motion.div
        style={prefersReducedMotion ? undefined : { skewY: activeJellySkew }}
        className="space-y-2.5 origin-center"
      >
        {segment === 'galla' && capabilities.showGalla ? (
          <div className="space-y-2.5">
            <div className="rounded-[24px] spatial-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    Cash Drawer Today
                  </p>
                  <p className="font-display text-lg font-extrabold text-[var(--ink)] font-tabular">
                    <OdometerNumber value={gallaPulse.cashDrawerBalance} hidden={hideBalance} />
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)] font-tabular">
                    In {formatINR(gallaPulse.todayInflow)} · Out {formatINR(gallaPulse.todayOutflow)}
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenGalla();
                }}
                className="min-h-[42px] px-3.5 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1 shrink-0 tactile-key-primary"
              >
                <span>Open Galla</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>

            {sortedCashbookEntries.length === 0 ? (
              <div className="rounded-[24px] spatial-card p-6 text-center space-y-2.5">
                <p className="font-display text-base font-extrabold text-[var(--ink)]">
                  No Galla entries recorded yet
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Tap Open Galla above or use + New to log Cash In, Expenses, or UPI sales.
                </p>
              </div>
            ) : (
              sortedCashbookEntries.map((entry, idx) => {
                const isInflow = entry.entryType === 'inflow';
                return (
                  <motion.button
                    key={entry.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_FAST, delay: Math.min(idx, 8) * 0.025 }}
                    whileTap={{ scale: 0.97, y: 1 }}
                    onClick={() => {
                      haptics.tap();
                      onOpenGalla();
                    }}
                    className="w-full rounded-[24px] spatial-card px-4 py-3 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isInflow
                            ? 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                            : 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                        }`}
                      >
                        {isInflow ? (
                          <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-extrabold text-[var(--ink)] truncate">
                            {entry.category}
                          </p>
                          <span className="px-1.5 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[9px] font-extrabold uppercase text-[var(--ink-muted)]">
                            {entry.mode}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                          {entry.note || formatDateTime(entry.entryDate)}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`font-display text-base font-extrabold font-tabular shrink-0 ${
                        isInflow ? 'text-[var(--debit-green)]' : 'text-[var(--credit-red)]'
                      }`}
                    >
                      {hideBalance
                        ? '₹••••'
                        : `${isInflow ? '+' : '-'}${formatINR(entry.amount)}`}
                    </p>
                  </motion.button>
                );
              })
            )}
          </div>
        ) : accounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING_FAST}
            className="rounded-[24px] spatial-card p-5 space-y-3 text-center"
          >
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-[var(--debit-tint)] flex items-center justify-center">
                <svg
                  viewBox="0 0 48 48"
                  className="w-6 h-6 sprout-grow"
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

            <div className="space-y-0.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                {activeAdaptation.focusBadge} · Ready For Records
              </p>
              <h1 className="font-display text-base font-extrabold text-[var(--ink)]">
                {capabilities.focus === 'personal'
                  ? 'Start Your Personal Khata'
                  : 'Start Your Real Shop Khata'}
              </h1>
              <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                {activeAdaptation.emptyStateHint}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() =>
                  handleOpenAddModal(
                    capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                  )
                }
                className="tactile-key-primary min-h-[48px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>
                  {capabilities.showSuppliers && segment === 'supplier'
                    ? `Add First ${capabilities.secondarySegmentLabel || 'Supplier'}`
                    : `Add First ${capabilities.primarySegmentLabel === 'Contacts' ? 'Contact' : 'Customer'}`}
                </span>
              </motion.button>

              <div
                className={`grid gap-2.5 ${
                  capabilities.focus === 'personal' ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                <motion.button
                  whileTap={{ scale: 0.94, y: 1 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onOpenVoiceEntry();
                  }}
                  className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-[11px] font-extrabold whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span>Speak Entry</span>
                </motion.button>

                {capabilities.focus !== 'personal' && (
                  <motion.button
                    whileTap={{ scale: 0.94, y: 1 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenParchiScanner();
                    }}
                    className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--app-bg)] text-[11px] font-bold text-[var(--ink)] whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
                    <span>Scan Parchi</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-[24px] spatial-card p-8 text-center space-y-3">
            <p className="font-display text-base font-bold text-[var(--ink)]">
              No {filterChip === 'supplier' ? 'suppliers' : 'parties'} matched this view.
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Tap the Matte Indigo Mic Orb below or add a new entry.
            </p>
            <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenVoiceEntry();
                }}
                className="tactile-key-primary min-h-[44px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-2"
              >
                <Mic className="w-4 h-4" />
                <span>{t.voiceEntry}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() =>
                  handleOpenAddModal(
                    capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                  )
                }
                className="min-h-[44px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] text-xs font-bold inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-[var(--brand-accent)]" />
                <span>
                  {capabilities.showSuppliers && segment === 'supplier'
                    ? t.addSupplier
                    : capabilities.focus === 'personal'
                      ? 'Add Contact'
                      : t.addCustomer}
                </span>
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAccounts.map((acc, idx) => {
              let repulsionOffsetY = 0;
              if (activeHoverIdx !== null) {
                if (idx === activeHoverIdx - 1) repulsionOffsetY = -3;
                else if (idx === activeHoverIdx + 1) repulsionOffsetY = 3;
              }
              return (
                <PartyLedgerCard
                  key={acc.id}
                  account={acc}
                  idx={idx}
                  trust={trustScoresByAccount[acc.id]}
                  hideBalance={hideBalance}
                  isSelected={Boolean(selectedAccountId && selectedAccountId === acc.id)}
                  isRecentlySaved={Boolean(
                    recentlyUpdatedAccountId && recentlyUpdatedAccountId === acc.id
                  )}
                  repulsionOffsetY={repulsionOffsetY}
                  dueLabel={t.due}
                  advanceLabel={t.advance}
                  settledLabel={t.settled}
                  onSelect={onSelectAccount}
                  onQuickAdd={openQuickEntrySheet}
                  onSwipeRemind={onSwipeRemind}
                  onInteractionStart={(i) => setActiveHoverIdx(i)}
                  onInteractionEnd={() => setActiveHoverIdx(null)}
                />
              );
            })}
            <p className="text-[10px] font-semibold text-center text-[var(--ink-muted)] pt-1">
              Tip: Swipe row right to Receive ₹ or left for WhatsApp Remind
            </p>
          </div>
        )}
      </motion.div>

      {/* '+ New' Quick Action Bottom Sheet (Replaces Bottom-Right Floating '+' FAB) */}
      <AnimatePresence>
        {showQuickMenuSheet && (
          <motion.div
            key="quick-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
            onClick={() => setShowQuickMenuSheet(false)}
            className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
          >
            <motion.div
              key="quick-menu-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
              transition={SPRING_SHEET}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowQuickMenuSheet(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-5 space-y-3 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
                  Quick Actions · {activeAdaptation.focusBadge}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickMenuSheet(false)}
                  aria-label="Close quick actions"
                  className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickMenuSheet(false);
                    handleOpenAddModal(
                      capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                    );
                  }}
                  className="w-full min-h-[52px] px-4 rounded-2xl bg-[var(--brand)] text-white flex items-center gap-3 text-left font-extrabold text-sm active:scale-[0.98] transition"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Add New Party / {capabilities.primarySegmentLabel}</span>
                </button>

                {capabilities.focus !== 'personal' && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setShowQuickMenuSheet(false);
                      onOpenParchiScanner();
                    }}
                    className="w-full min-h-[50px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] flex items-center gap-3 text-left font-bold text-sm active:scale-[0.98] transition"
                  >
                    <Camera className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                    <span>Scan Handwritten Parchi (AI)</span>
                  </button>
                )}

                {capabilities.showGalla && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setShowQuickMenuSheet(false);
                      onOpenGalla();
                    }}
                    className="w-full min-h-[50px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] flex items-center gap-3 text-left font-bold text-sm active:scale-[0.98] transition"
                  >
                    <Wallet className="w-4 h-4 text-[var(--debit-green)] shrink-0" />
                    <span>Open {capabilities.gallaSegmentLabel || 'Galla Cashbook'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setShowQuickMenuSheet(false);
                    onOpenCounterMode();
                  }}
                  className="w-full min-h-[50px] px-4 rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] flex items-center gap-3 text-left font-bold text-sm active:scale-[0.98] transition"
                >
                  <Repeat className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                  <span>Hands-Free Counter Mode</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Tactile Numeric Keypad Quick-Entry Bottom Sheet */}
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
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-5 pt-3 space-y-3.5 max-h-[92dvh] overflow-y-auto no-scrollbar pb-safe"
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
                      onClick={() => {
                        haptics.tap();
                        setQuickEntryAccount(null);
                      }}
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
                      onClick={() => {
                        haptics.tap();
                        setQuickDirection('given');
                      }}
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
                      onClick={() => {
                        haptics.tap();
                        setQuickDirection('received');
                      }}
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

                  {/* Live Tabular Amount Readout */}
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
                          haptics.tap();
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['+100', '+500', '+2000'] as const).map((presetKey) => (
                      <motion.button
                        key={presetKey}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING_FAST}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setQuickError('');
                          setQuickAmount((prev) => applyKeypadKey(prev, presetKey));
                        }}
                        className="min-h-[34px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-extrabold font-tabular text-[var(--ink)] whitespace-nowrap"
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
                          haptics.tap();
                          setQuickError('');
                          setQuickDirection('received');
                          setQuickAmount(String(Math.round(quickEntryAccount.balance * 100) / 100));
                        }}
                        className="min-h-[34px] px-2.5 rounded-xl bg-[var(--debit-tint)] text-[11px] font-extrabold font-tabular text-[var(--debit-green)] whitespace-nowrap"
                      >
                        Full ({formatINR(quickEntryAccount.balance)})
                      </motion.button>
                    )}
                  </div>

                  {/* Tactile Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-2">
                    {KEYPAD_KEYS.map((key) => {
                      const isBackspace = key === 'backspace';
                      return (
                        <motion.button
                          key={key}
                          type="button"
                          disabled={quickSaving}
                          whileTap={{ scale: 0.91, y: 1 }}
                          transition={SPRING_FAST}
                          aria-label={isBackspace ? 'Backspace' : `Keypad ${key}`}
                          onClick={() => {
                            haptics.tap();
                            setQuickError('');
                            setQuickAmount((prev) => applyKeypadKey(prev, key));
                          }}
                          className="min-h-[48px] rounded-2xl bg-[var(--app-bg)] shadow-[0_2px_0_rgba(15,23,42,0.08)] dark:shadow-[0_2px_0_rgba(0,0,0,0.45)] font-display text-lg font-extrabold font-tabular text-[var(--ink)] flex items-center justify-center hover:bg-[var(--brand-tint)] disabled:opacity-50"
                        >
                          {isBackspace ? <Delete className="w-5 h-5" /> : key}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Persona Quick Note Chips + Note Input + Optional Galla Sync */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {activeAdaptation.quickNotePresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            haptics.tap();
                            setQuickNote(preset);
                          }}
                          className={`min-h-[30px] px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 active:scale-95 transition ${
                            quickNote === preset
                              ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                              : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder={activeAdaptation.quickNotePlaceholder}
                      className="w-full min-h-[42px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-xs font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />

                    {capabilities.showGalla && (
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
                              onClick={() => {
                                haptics.tap();
                                setQuickGallaMode(opt.id);
                              }}
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
                    )}
                  </div>

                  {quickError && (
                    <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
                      {quickError}
                    </p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.94, y: 1 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={quickSaving}
                    onClick={() => void handleSaveQuickEntry()}
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

      {/* Unified Filter & Sort Solid Bottom Sheet (Includes Show All Modes Toggle) */}
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
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-6 space-y-5 max-h-[85dvh] overflow-y-auto pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto cursor-grab" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Filter &amp; Sort Ledger
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setShowFilterSortSheet(false);
                  }}
                  aria-label="Close filter and sort"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {onToggleShowAllModes && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAllModes}
                  onClick={() => {
                    haptics.tap();
                    onToggleShowAllModes();
                  }}
                  className="w-full rounded-2xl bg-[var(--app-bg)] px-4 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[var(--ink)]">
                      Show All Modes
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                      Combine {activeAdaptation.focusBadge} with records from other modes
                    </p>
                  </div>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                      showAllModes ? 'bg-[var(--brand)] justify-end' : 'bg-[var(--surface-border)] justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                  </span>
                </button>
              )}

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  Filter Parties
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableFilterOptions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        setRawFilterChip(f.id);
                        if (f.id === 'customer' || f.id === 'supplier') {
                          setRawSegment(f.id);
                        }
                      }}
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
                        haptics.tap();
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
              className="w-full max-w-[430px] rounded-t-[28px] spatial-sheet p-6 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe"
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto cursor-grab" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  Add{' '}
                  {capabilities.showSuppliers && newKind === 'supplier'
                    ? capabilities.secondarySegmentLabel || 'Supplier'
                    : capabilities.focus === 'personal'
                      ? 'Contact'
                      : capabilities.primarySegmentLabel === 'Kisan'
                        ? 'Kisan'
                        : 'Customer'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setShowAddModal(false);
                  }}
                  aria-label="Close add party"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {capabilities.showSuppliers && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setNewKind('customer');
                    }}
                    className={`min-h-[44px] rounded-2xl text-sm font-bold active:scale-95 transition ${
                      newKind === 'customer'
                        ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                        : 'bg-[var(--app-bg)] text-[var(--ink)]'
                    }`}
                  >
                    {capabilities.primarySegmentLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setNewKind('supplier');
                    }}
                    className={`min-h-[44px] rounded-2xl text-sm font-bold active:scale-95 transition ${
                      newKind === 'supplier'
                        ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                        : 'bg-[var(--app-bg)] text-[var(--ink)]'
                    }`}
                  >
                    {capabilities.secondarySegmentLabel || 'Supplier'}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--brand-accent)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={activeAdaptation.addPartyPlaceholder}
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
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                disabled={addingBusy}
                onClick={() => void handleAddSubmit()}
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
