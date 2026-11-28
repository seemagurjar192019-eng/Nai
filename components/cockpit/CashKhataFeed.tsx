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
  ShieldCheck,
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
  computeWeeklyCashVelocity,
  filterAndSuggestAccounts,
  type KeypadKey,
} from '@/lib/ucred-intelligence';
import { findRecentDuplicateTransaction } from '@/lib/duplicate-guard';
import { computeOverdueAgingBuckets } from '@/lib/vyaaj-interest';
import { useBackStack } from '@/hooks/useBackStack';
import type {
  AccountKind,
  CashbookEntry,
  CashbookMode,
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
import { DetentSheetOverlay } from '../motion/DetentSheetOverlay';
import { HeroBalanceCard } from '../motion/HeroBalanceCard';
import { SNAPPY_SPRING, SPATIAL_SPRING } from '../motion/SpatialMotionEngine';
import { SmartEntrySavedStage } from '../SmartEntrySavedStage';
import { PartyLedgerCard } from '../ledger/PartyLedgerCard';
import { MandiAadatHelper } from './MandiAadatHelper';
import { NoticeBoardBanner } from './NoticeBoardBanner';

export type CashKhataSegment = 'customer' | 'supplier' | 'galla';

export interface CashKhataFeedProps {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  stockItems: StockItem[];
  cashbookEntries?: CashbookEntry[];
  language: LanguageCode;
  searchQuery: string;
  gallaPulse: DailyGallaPulse;
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
  largeTitleOpacity?: MotionValue<number>;
  largeTitleScale?: MotionValue<number>;
  largeTitleY?: MotionValue<number>;
  jellySkew?: MotionValue<number>;
  addPartySignal?: number;
  backupNeeded?: boolean;
  isOffline?: boolean;
  pendingSyncCount?: number;
  onExportBackup?: () => void;
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
  onInlineQuickAdd?: (payload: {
    customerName: string;
    direction: TxDirection;
    amount: number;
    kind: AccountKind;
    note?: string;
  }) => Promise<void>;
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
  { id: 'defaulters', label: 'Overdue Parties' },
];

const SORT_OPTIONS: Array<{ id: SortByOption; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'latest-activity', label: 'Latest Activity' },
  { id: 'due-amount', label: 'Due Amount (Highest First)' },
  { id: 'last-payment', label: 'Last Payment' },
];

const SPRING_FAST = SNAPPY_SPRING;
const SPRING_SHEET = SPATIAL_SPRING;
const KEYPAD_KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

/**
 * Primary Cockpit Cash & Khata Feed.
 * Enforces strict persona gating, inline '+ New' Quick Action header pill (zero bottom-right FAB),
 * neighbor-repelling party rows, and 60fps compositor scroll motion.
 */
export const CashKhataFeed: React.FC<CashKhataFeedProps> = ({
  accounts,
  transactions = [],
  cashbookEntries = [],
  language,
  searchQuery,
  gallaPulse,
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
  backupNeeded = false,
  isOffline = false,
  pendingSyncCount = 0,
  onExportBackup,
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
  const [visibleCount, setVisibleCount] = useState(60);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem('ucred_dismissed_notice') || null;
    } catch {
      return null;
    }
  });

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
  const [duplicateWarning, setDuplicateWarning] = useState<{
    amount: number;
    minutesAgo: number;
  } | null>(null);
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

  useBackStack(showFilterSortSheet, () => setShowFilterSortSheet(false));
  useBackStack(showQuickMenuSheet, () => setShowQuickMenuSheet(false));
  useBackStack(showAddModal && !addingBusy, () => setShowAddModal(false));
  useBackStack(Boolean(quickEntryAccount && !quickSaving && !quickCelebration), () =>
    setQuickEntryAccount(null)
  );

  const agingBuckets = useMemo(
    () => computeOverdueAgingBuckets(accounts, todayStr),
    [accounts, todayStr]
  );

  const cashflow = useMemo(() => computeNetCashflowSummary(accounts), [accounts]);

  const { overdueCount, overdueTotal } = useMemo(() => {
    const dueList = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate !== '' && a.dueDate <= todayStr
    );
    return {
      overdueCount: dueList.length,
      overdueTotal: dueList.reduce((sum, a) => sum + a.balance, 0),
    };
  }, [accounts, todayStr]);

  const handleDismissNotice = (key: string) => {
    setDismissedNoticeKey(key);
    try {
      window.sessionStorage.setItem('ucred_dismissed_notice', key);
    } catch {
      // Ignore storage error
    }
  };

  const { filteredAccounts, isFuzzySuggestion } = useMemo(() => {
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

    const searchRes = filterAndSuggestAccounts(list, searchQuery);
    list = [...searchRes.matches];

    if (!searchRes.isFuzzySuggestion) {
      list.sort((a, b) => {
        if (sortBy === 'due-amount') return b.balance - a.balance;
        if (sortBy === 'last-payment') return (a.balance || 0) - (b.balance || 0);
        if (sortBy === 'recommended') return Math.abs(b.balance) - Math.abs(a.balance);
        return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
      });
    }

    return {
      filteredAccounts: list,
      isFuzzySuggestion: searchRes.isFuzzySuggestion,
    };
  }, [accounts, filterChip, searchQuery, sortBy, todayStr]);

  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of filteredAccounts) {
      const key = acc.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [filteredAccounts]);

  const duplicateNameMatches = useMemo(() => {
    const q = newName.trim().toLowerCase();
    if (!q) return [];
    return accounts.filter((a) => a.name.trim().toLowerCase() === q);
  }, [accounts, newName]);

  const weeklyVelocity = useMemo(
    () => computeWeeklyCashVelocity(transactions, todayStr),
    [transactions, todayStr]
  );

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
    haptics.select();
    if (nextSeg === 'supplier' && !capabilities.showSuppliers) return;
    if (nextSeg === 'galla' && !capabilities.showGalla) return;
    setRawSegment(nextSeg);
    if (nextSeg === 'customer' || nextSeg === 'supplier') {
      setRawFilterChip(nextSeg);
    }
  };

  const handleOpenAddModal = (kind: AccountKind, prefillName = '') => {
    haptics.tap();
    setNewKind(capabilities.showSuppliers ? kind : 'customer');
    setNewName(prefillName);
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
    const cleanPhone = newPhone.trim().replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length >= 6) {
      const existing = accounts.find(
        (a) => a.phone && a.phone.replace(/\D/g, '') === cleanPhone
      );
      if (existing) {
        setAddError(`Party "${existing.name}" with this phone number already exists! Opening ledger.`);
        haptics.tap();
        setAddingBusy(false);
        setTimeout(() => {
          setShowAddModal(false);
          onSelectAccount(existing);
        }, 1000);
        return;
      }
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
    setDuplicateWarning(null);
    setQuickCelebration(null);
  };

  const handleSaveQuickEntry = async (ignoreDuplicate = false) => {
    if (!quickEntryAccount) return;
    setQuickError('');
    const amt = Math.round((Number(quickAmount) || 0) * 100) / 100;
    if (amt <= 0) {
      setQuickError('Tap keypad digits above to enter an amount greater than ₹0.');
      return;
    }

    if (!ignoreDuplicate) {
      const dup = findRecentDuplicateTransaction({
        transactions,
        accountId: quickEntryAccount.id,
        direction: quickDirection,
        amount: amt,
      });
      if (dup) {
        setDuplicateWarning({ amount: amt, minutesAgo: dup.minutesAgo });
        return;
      }
    }
    setDuplicateWarning(null);

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

  const addBtnLabel =
    capabilities.showSuppliers && segment === 'supplier'
      ? 'Add Supplier'
      : capabilities.focus === 'personal'
        ? 'Add Contact'
        : 'Add Party';

  return (
    <div className="pb-44 pt-1">
      <div className="space-y-3.5 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start lg:space-y-0">
        {/* LEFT COLUMN (Mobile Top / Desktop 5-col Sticky): Apple Monochrome Balance Slab + Quick Counter Bar */}
        <div className="space-y-3 lg:col-span-5 lg:sticky lg:top-2">
          <HeroBalanceCard
            cashflow={cashflow}
            partyCount={accounts.length}
            cashDrawerBalance={gallaPulse.cashDrawerBalance + gallaPulse.upiBankBalance}
            todayInflow={gallaPulse.todayInflow}
            todayOutflow={gallaPulse.todayOutflow}
            weeklyVelocity={weeklyVelocity}
            hideBalance={hideBalance}
            capabilities={capabilities}
            personaAdaptation={activeAdaptation}
            heroOpacity={heroOpacity}
            heroScale={heroScale}
            heroY={heroY}
            onToggleHideBalance={onToggleHideBalance}
            onOpenDailySummary={onOpenDailySummary}
            onSelectReceivable={() => handleSelectSegment('customer')}
            onSelectPayable={() => {
              if (capabilities.showSuppliers) handleSelectSegment('supplier');
            }}
            onSelectGalla={() => {
              if (capabilities.showGalla) onOpenGalla();
            }}
          />

          {/* Compact 3-Action Monochrome Counter Strip */}
          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() => {
                haptics.tap();
                setShowQuickMenuSheet(true);
              }}
              className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
              <span className="truncate">Quick Entry</span>
            </motion.button>

            {capabilities.focus !== 'personal' ? (
              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenParchiScanner();
                }}
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
              >
                <Camera className="w-3.5 h-3.5 stroke-[1.9] shrink-0" />
                <span className="truncate">Scan Bill</span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenVoiceEntry();
                }}
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
              >
                <Mic className="w-3.5 h-3.5 stroke-[1.9] shrink-0" />
                <span className="truncate">Voice Log</span>
              </motion.button>
            )}

            {capabilities.showGalla ? (
              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenGalla();
                }}
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
              >
                <Wallet className="w-3.5 h-3.5 stroke-[1.9] shrink-0" />
                <span className="truncate">Cashbook</span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenCollection();
                }}
                className="min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
              >
                <Repeat className="w-3.5 h-3.5 stroke-[1.9] shrink-0" />
                <span className="truncate">Dues</span>
              </motion.button>
            )}
          </div>

          {/* Desktop Counter Pulse Snapshot (Balances 2-column weight cleanly) */}
          <div className="hidden lg:block ios27-inset-group rounded-[22px] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ink)]">Today&apos;s Counter</span>
              <span className="text-[11px] text-[var(--ink-muted)] font-tabular">
                {overdueCount > 0 ? `${overdueCount} Overdue` : 'All Clear'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--glass-border)] font-tabular">
              <div>
                <p className="text-[11px] text-[var(--ink-muted)]">Cash Inflow</p>
                <p className="font-display text-sm font-semibold text-[var(--debit-green)] mt-0.5">
                  {hideBalance ? '₹••••' : `+${formatINR(gallaPulse.todayInflow)}`}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--ink-muted)]">Cash Outflow</p>
                <p className="font-display text-sm font-semibold text-[var(--credit-red)] mt-0.5">
                  {hideBalance ? '₹••••' : `-${formatINR(gallaPulse.todayOutflow)}`}
                </p>
              </div>
            </div>
          </div>

          {capabilities.showMandiCalculator && <MandiAadatHelper />}
        </div>

        {/* RIGHT COLUMN (Mobile Feed / Desktop 7-col): Segmented Tabs + Toolbar + Notice Strip + Party List */}
        <div className="space-y-3 lg:col-span-7">
          {segmentTabs.length > 1 && (
            <div
              className={`relative grid rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1 ${
                segmentTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}
            >
              {segmentTabs.map((seg) => {
                const active =
                  segment === seg.id &&
                  !(seg.id !== 'galla' && hasSecondaryFilter && segment !== 'galla');
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => handleSelectSegment(seg.id)}
                    className={`relative min-h-[40px] px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={prefersReducedMotion ? undefined : 'cashKhataKindPill'}
                        transition={SPRING_SHEET}
                        className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                      />
                    )}
                    <span className="relative z-10">{seg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="font-display text-xs font-medium tracking-normal text-[var(--ink-muted)] inline-flex items-baseline gap-1">
              {segment === 'galla' ? (
                'Today in Cashbook'
              ) : (
                <>
                  <span className="font-tabular">{filteredAccounts.length}</span>
                  <span>{filteredAccounts.length === 1 ? 'Party' : 'Parties'}</span>
                </>
              )}
            </h2>

            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                transition={SPRING_FAST}
                type="button"
                aria-label={hasSecondaryFilter ? `Filter: ${activeFilterLabel}` : 'Filter parties'}
                onClick={() => {
                  haptics.tap();
                  setShowFilterSortSheet(true);
                }}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                  hasSecondaryFilter || showAllModes || sortBy !== 'latest-activity'
                    ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                    : 'bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] hover:bg-[var(--brand-tint)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5 stroke-[1.9]" />
                <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter'}</span>
              </motion.button>

              <motion.button
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() =>
                  handleOpenAddModal(
                    capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                  )
                }
                aria-label={addBtnLabel}
                className="min-h-[44px] px-4 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Add</span>
              </motion.button>
            </div>
          </div>

          {/* Sleek ChatGPT-Style Translucent Light-Blue Notice Strip (Contextually placed right above the Ledger Feed) */}
          <NoticeBoardBanner
            partyCount={accounts.length}
            overdueCount={overdueCount}
            overdueTotal={overdueTotal}
            todayInflow={gallaPulse.todayInflow}
            todayOutflow={gallaPulse.todayOutflow}
            isPersonalMode={capabilities.focus === 'personal'}
            dismissedKey={dismissedNoticeKey}
            backupNeeded={backupNeeded}
            isOffline={isOffline}
            pendingSyncCount={pendingSyncCount}
            onDismiss={handleDismissNotice}
            onReviewOverdue={onOpenCollection}
            onListenSummary={onOpenDailySummary}
            onOpenVoice={onOpenVoiceEntry}
            onExportBackup={onExportBackup}
          />

          {/* Scroll-Velocity Jelly Party List / Inline Galla / Minimal Empty State */}
          <motion.div
            style={prefersReducedMotion ? undefined : { skewY: activeJellySkew }}
            className="space-y-2.5 origin-center"
          >
            {segment === 'galla' && capabilities.showGalla ? (
              <div className="space-y-2.5">
                <div className="ios27-inset-group rounded-[22px] p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 stroke-[1.9]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                        Cash Drawer Today
                      </p>
                      <p className="font-display text-lg font-semibold text-[var(--ink)] font-tabular">
                        <OdometerNumber value={gallaPulse.cashDrawerBalance} hidden={hideBalance} />
                      </p>
                      <p className="text-[11px] font-normal text-[var(--ink-muted)] font-tabular">
                        In <span className="text-[var(--debit-green)] font-medium">{formatINR(gallaPulse.todayInflow)}</span>
                        {' · '}
                        Out <span className="text-[var(--credit-red)] font-medium">{formatINR(gallaPulse.todayOutflow)}</span>
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenGalla();
                    }}
                    className="min-h-[40px] px-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Open Cashbook</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                {sortedCashbookEntries.length === 0 ? (
                  <div className="ios27-inset-group rounded-[22px] p-6 text-center space-y-1.5">
                    <p className="font-display text-sm font-semibold text-[var(--ink)]">
                      No cashbook entries today
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Tap Open Cashbook above to log cash inflows, expenses, or UPI payments.
                    </p>
                  </div>
                ) : (
                  <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
                    {sortedCashbookEntries.map((entry, idx) => {
                      const isInflow = entry.entryType === 'inflow';
                      return (
                        <motion.button
                          key={entry.id}
                          type="button"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...SPRING_FAST, delay: Math.min(idx, 8) * 0.02 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => {
                            haptics.tap();
                            onOpenGalla();
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-subtle)]/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
                              {isInflow ? (
                                <ArrowDown className="w-4 h-4 stroke-[2]" />
                              ) : (
                                <ArrowUp className="w-4 h-4 stroke-[2]" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--ink)] truncate">
                                {entry.category}
                              </p>
                              <p className="text-[11px] font-normal text-[var(--ink-muted)] truncate">
                                {entry.mode.toUpperCase()} · {entry.note || formatDateTime(entry.entryDate)}
                              </p>
                            </div>
                          </div>

                          <p
                            className={`font-display text-sm font-semibold font-tabular shrink-0 ${
                              isInflow ? 'text-[var(--debit-green)]' : 'text-[var(--credit-red)]'
                            }`}
                          >
                            {hideBalance
                              ? '₹••••'
                              : `${isInflow ? '+' : '-'}${formatINR(entry.amount)}`}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : accounts.length === 0 ? (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={SPRING_FAST}
                className="ios27-inset-group rounded-[22px] p-3.5 sm:p-7 text-center flex flex-col items-center space-y-2 sm:space-y-3"
              >
                <span className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shadow-xs">
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.8]" />
                </span>

                <div className="space-y-0.5 sm:space-y-1">
                  <h1 className="font-display text-base sm:text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                    {capabilities.focus === 'personal' ? 'Start your personal ledger' : 'Start your business ledger'}
                  </h1>
                  <p className="text-xs sm:text-[13px] font-normal text-[var(--ink-muted)] max-w-[300px] leading-snug">
                    {capabilities.focus === 'personal'
                      ? 'Add a contact manually or speak an entry hands-free.'
                      : 'Add your first customer or supplier, or speak an entry hands-free.'}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <motion.button
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() =>
                      handleOpenAddModal(
                        capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                      )
                    }
                    className="min-h-[44px] px-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4 shrink-0 stroke-[2]" />
                    <span>
                      {capabilities.focus === 'personal' ? 'Add First Contact' : 'Add First Party'}
                    </span>
                  </motion.button>

                  <motion.button
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenVoiceEntry();
                    }}
                    className="min-h-[44px] px-4 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--ink)] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-[var(--brand-tint)] transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
                    <span>Speak Entry</span>
                  </motion.button>
                </div>

                <div className="pt-2 border-t border-[var(--glass-border)] w-full max-w-[340px] flex items-center justify-center gap-2 text-[11px] font-medium text-[var(--ink-muted)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--ink)] shrink-0" />
                  <span>AES-256 Encrypted</span>
                  <span aria-hidden="true">·</span>
                  <span>GST Ready</span>
                  <span aria-hidden="true">·</span>
                  <span>WhatsApp Slips</span>
                </div>
              </motion.div>
            ) : filteredAccounts.length === 0 ? (
              <div className="ios27-inset-group rounded-[22px] p-7 text-center space-y-3">
                <p className="font-display text-sm font-semibold text-[var(--ink)]">
                  {searchQuery.trim()
                    ? `No match for "${searchQuery.trim()}"`
                    : `No ${filterChip === 'supplier' ? 'suppliers' : 'parties'} matched this view.`}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {searchQuery.trim()
                    ? 'Add them cleanly as a new party or record via voice.'
                    : 'Try clearing your filter or add a new entry.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() =>
                      handleOpenAddModal(
                        capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer',
                        searchQuery.trim()
                      )
                    }
                    className="min-h-[44px] px-4 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {searchQuery.trim()
                        ? `Add "${searchQuery.trim()}"`
                        : capabilities.showSuppliers && segment === 'supplier'
                          ? t.addSupplier
                          : capabilities.focus === 'personal'
                            ? 'Add Contact'
                            : t.addCustomer}
                    </span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenVoiceEntry();
                    }}
                    className="min-h-[44px] px-4 rounded-full bg-[var(--surface)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{t.voiceEntry}</span>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {isFuzzySuggestion && searchQuery.trim() && (
                  <p className="px-2 text-[11px] font-semibold text-[var(--ink-muted)]">
                    Showing closest matches for &quot;{searchQuery.trim()}&quot;
                  </p>
                )}
                <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
                  {(() => {
                    const seenDuplicateCounters = new Map<string, number>();
                    return filteredAccounts.slice(0, visibleCount).map((acc, idx) => {
                      let repulsionOffsetY = 0;
                      if (activeHoverIdx !== null) {
                        if (idx === activeHoverIdx - 1) repulsionOffsetY = -3;
                        else if (idx === activeHoverIdx + 1) repulsionOffsetY = 3;
                      }
                      const nameKey = acc.name.trim().toLowerCase();
                      const isDup = (duplicateNameCounts.get(nameKey) || 0) > 1;
                      let disambiguator: string | undefined;
                      if (isDup) {
                        const nextOrd = (seenDuplicateCounters.get(nameKey) || 0) + 1;
                        seenDuplicateCounters.set(nameKey, nextOrd);
                        if (acc.phone && acc.phone.length >= 4) {
                          disambiguator = `•••${acc.phone.slice(-4)}`;
                        } else if (capabilities.showSuppliers) {
                          disambiguator = acc.kind === 'supplier' ? 'Supplier' : 'Customer';
                        } else {
                          disambiguator = `#${nextOrd}`;
                        }
                      }
                      return (
                        <PartyLedgerCard
                          key={acc.id}
                          account={acc}
                          idx={idx}
                          hideBalance={hideBalance}
                          groupedRow
                          disambiguator={disambiguator}
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
                    });
                  })()}
                </div>
                {filteredAccounts.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setVisibleCount((v) => v + 60);
                    }}
                    className="w-full min-h-[44px] rounded-full liquid-glass text-xs font-semibold text-[var(--ink)] active:scale-[0.99] transition"
                  >
                    Show More ({filteredAccounts.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* '+ New' Quick Action Interactive Two-Detent Sheet */}
      <DetentSheetOverlay
        open={showQuickMenuSheet}
        onClose={() => setShowQuickMenuSheet(false)}
        title={`Quick Actions · ${activeAdaptation.focusBadge}`}
        subtitle="Drag handle or tap expand for full view"
        initialDetent="peek"
      >
        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowQuickMenuSheet(false);
              handleOpenAddModal(
                capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
              );
            }}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] flex items-center gap-3 text-left font-extrabold text-sm active:scale-[0.98] transition"
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
              <span>Scan Receipt</span>
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
      </DetentSheetOverlay>

      {/* Custom Tactile Numeric Keypad Quick-Entry Detent Sheet */}
      <DetentSheetOverlay
        open={Boolean(quickEntryAccount)}
        onClose={() => {
          if (!quickSaving && !quickCelebration) setQuickEntryAccount(null);
        }}
        title={quickEntryAccount?.name || 'Quick Entry'}
        subtitle={
          quickEntryAccount
            ? `Current: ${
                hideBalance ? '₹••••' : formatINR(Math.abs(quickEntryAccount.balance))
              } ${
                quickEntryAccount.balance > 0
                  ? t.due
                  : quickEntryAccount.balance < 0
                    ? t.advance
                    : t.settled
              }`
            : undefined
        }
        initialDetent="full"
        allowDetentToggle={false}
      >
        {quickEntryAccount &&
          (quickCelebration ? (
            <SmartEntrySavedStage
              partyName={quickCelebration.partyName}
              previousBalance={quickCelebration.previousBalance}
              newBalance={quickCelebration.newBalance}
              amount={quickCelebration.amount}
              direction={quickCelebration.direction}
            />
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] font-bold font-display text-sm flex items-center justify-center shrink-0">
                  {quickEntryAccount.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-extrabold text-[var(--ink)] truncate">
                    {quickEntryAccount.name}
                  </p>
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
                    {hideBalance ? '₹••••' : formatINR(Math.abs(quickEntryAccount.balance))}{' '}
                    {quickEntryAccount.balance > 0
                      ? t.due
                      : quickEntryAccount.balance < 0
                        ? t.advance
                        : t.settled}
                  </p>
                </div>
              </div>

              {/* Direction Toggle Pills */}
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.94, y: 1 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.select();
                    setQuickDirection('given');
                  }}
                  className={`min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                    quickDirection === 'given'
                      ? 'bg-[var(--credit-red)] text-white shadow-md'
                      : 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 shrink-0" />
                  <span>Credit (Given)</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94, y: 1 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.select();
                    setQuickDirection('received');
                  }}
                  className={`min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                    quickDirection === 'received'
                      ? 'bg-[var(--debit-green)] text-white shadow-md'
                      : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                  }`}
                >
                  <ArrowDown className="w-4 h-4 shrink-0" />
                  <span>Received</span>
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
                    className="min-h-[44px] px-3.5 rounded-xl liquid-glass text-xs font-bold text-[var(--ink-muted)] active:scale-95 transition shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Increment Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(['+100', '+500', '+1000', '+2000', '+5000'] as const).map((presetKey) => (
                  <motion.button
                    key={presetKey}
                    whileTap={{ scale: 0.92 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setQuickError('');
                      setDuplicateWarning(null);
                      setQuickAmount((prev) => applyKeypadKey(prev, presetKey));
                    }}
                    className="min-h-[40px] px-3 rounded-xl liquid-glass text-xs font-extrabold font-tabular text-[var(--ink)] whitespace-nowrap"
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
                    className="min-h-[40px] px-3 rounded-xl bg-[var(--debit-tint)] text-xs font-extrabold font-tabular text-[var(--debit-green)] whitespace-nowrap"
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
                        haptics.keypad();
                        setQuickError('');
                        setDuplicateWarning(null);
                        setQuickAmount((prev) => applyKeypadKey(prev, key));
                      }}
                      className="min-h-[48px] rounded-2xl ios27-ceramic-tile font-display text-lg font-extrabold font-tabular text-[var(--ink)] flex items-center justify-center hover:bg-[var(--brand-tint)] disabled:opacity-50"
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
                      className={`min-h-[38px] px-3 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 active:scale-95 transition ${
                        quickNote === preset
                          ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                          : 'liquid-glass text-[var(--ink-muted)]'
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
                  className="w-full min-h-[44px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-xs font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                          className={`min-h-[38px] px-3 rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
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

              {duplicateWarning && (
                <div
                  role="alert"
                  className="rounded-2xl bg-[var(--alert-tint)] px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <p className="text-xs font-semibold text-[var(--alert-amber)] leading-snug">
                    Similar {formatINR(duplicateWarning.amount)} entry recorded{' '}
                    {duplicateWarning.minutesAgo === 0
                      ? 'just now'
                      : `${duplicateWarning.minutesAgo}m ago`}
                    . Save again?
                  </p>
                  <button
                    type="button"
                    disabled={quickSaving}
                    onClick={() => void handleSaveQuickEntry(true)}
                    className="min-h-[36px] px-3 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold shrink-0 active:scale-95 transition"
                  >
                    Save Anyway
                  </button>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                disabled={quickSaving}
                onClick={() => void handleSaveQuickEntry(false)}
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
                      ? 'Save Received'
                      : 'Save Credit'}
                </span>
              </motion.button>
            </div>
          ))}
      </DetentSheetOverlay>

      {/* Unified Filter & Sort Two-Detent Sheet */}
      <DetentSheetOverlay
        open={showFilterSortSheet}
        onClose={() => setShowFilterSortSheet(false)}
        title="Filter & Sort Ledger"
        subtitle="Drag handle to expand or dismiss"
        initialDetent="peek"
      >
        <div className="space-y-5">
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
                <p className="text-xs font-extrabold text-[var(--ink)]">Show All Modes</p>
                <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                  Combine {activeAdaptation.focusBadge} with records from other modes
                </p>
              </div>
              <span
                className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                  showAllModes
                    ? 'bg-[var(--brand)] justify-end'
                    : 'bg-[var(--surface-border)] justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-[var(--brand-fg)] shadow-xs" />
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

          {agingBuckets.totalReceivable > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Receivable Aging
              </p>
              <div className="grid grid-cols-4 gap-2 text-center font-tabular rounded-2xl bg-[var(--app-bg)] p-2.5">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--ink-muted)]">0-30d</p>
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {formatINR(agingBuckets.bucket0to30)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--ink-muted)]">31-60d</p>
                  <p className="text-xs font-bold text-[var(--ink)]">
                    {formatINR(agingBuckets.bucket31to60)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--ink-muted)]">61-90d</p>
                  <p className="text-xs font-bold text-[var(--alert-amber)]">
                    {formatINR(agingBuckets.bucket61to90)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--ink-muted)]">90d+</p>
                  <p className="text-xs font-bold text-[var(--credit-red)]">
                    {formatINR(agingBuckets.bucket90Plus)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DetentSheetOverlay>

      {/* Add Customer / Supplier Two-Detent Sheet */}
      <DetentSheetOverlay
        open={showAddModal}
        onClose={() => {
          if (!addingBusy) setShowAddModal(false);
        }}
        title={`Add ${
          capabilities.showSuppliers && newKind === 'supplier'
            ? capabilities.secondarySegmentLabel || 'Supplier'
            : capabilities.focus === 'personal'
              ? 'Contact'
              : capabilities.primarySegmentLabel === 'Kisan'
                ? 'Kisan'
                : 'Customer'
        }`}
        subtitle="Creates instant ledger profile"
        initialDetent="peek"
      >
        <div className="space-y-4">
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
              <label htmlFor="add-party-name" className="block text-xs font-bold text-[var(--brand-accent)] mb-1">
                Name
              </label>
              <input
                id="add-party-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={activeAdaptation.addPartyPlaceholder}
                className="w-full min-h-[48px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-base font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
              {duplicateNameMatches.length > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-[var(--alert-amber)]">
                  {duplicateNameMatches.length === 1
                    ? `"${duplicateNameMatches[0].name}" already exists — add a mobile number or surname to tell them apart.`
                    : `${duplicateNameMatches.length} parties named "${duplicateNameMatches[0].name}" already exist — add a mobile number or surname.`}
                </p>
              )}
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
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
