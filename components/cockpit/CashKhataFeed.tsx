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
  Repeat,
  UserPlus,
  Volume2,
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
import { DetentSheetOverlay } from '../motion/DetentSheetOverlay';
import { WalletCardStack, type WalletSegment } from '../motion/WalletCardStack';
import { SmartEntrySavedStage } from '../SmartEntrySavedStage';
import { PartyLedgerCard, TrustAvatarRing } from '../ledger/PartyLedgerCard';
import { MandiAadatHelper } from './MandiAadatHelper';

export type CashKhataSegment = WalletSegment;

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
  largeTitleOpacity?: MotionValue<number>;
  largeTitleScale?: MotionValue<number>;
  largeTitleY?: MotionValue<number>;
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
  largeTitleOpacity,
  largeTitleScale,
  largeTitleY,
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
  onInlineQuickAdd,
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
  const fallbackOne = useMotionValue(1);
  const fallbackZero = useMotionValue(0);
  const activeJellySkew = jellySkew || fallbackSkew;
  const activeTitleOpacity = largeTitleOpacity || fallbackOne;
  const activeTitleScale = largeTitleScale || fallbackOne;
  const activeTitleY = largeTitleY || fallbackZero;

  const [rawSegment, setRawSegment] = useState<CashKhataSegment>('customer');
  const [rawFilterChip, setRawFilterChip] = useState<LedgerFilterChip>('customer');
  const [sortBy, setSortBy] = useState<SortByOption>('latest-activity');
  const [showFilterSortSheet, setShowFilterSortSheet] = useState(false);
  const [showQuickMenuSheet, setShowQuickMenuSheet] = useState(false);
  const [activeHoverIdx, setActiveHoverIdx] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);

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

  // Empty-state Instant Inline Quick Add state (zero demo button, Fitts's Law muscle memory)
  const [inlineName, setInlineName] = useState('');
  const [inlineAmount, setInlineAmount] = useState('');
  const [inlineNote, setInlineNote] = useState('');
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const handleInlineSubmit = async (dir: TxDirection) => {
    setInlineError('');
    const cleanName = inlineName.trim();
    const numericAmount = Math.round((Number(inlineAmount) || 0) * 100) / 100;
    if (!cleanName) {
      setInlineError(
        capabilities.focus === 'personal' ? 'Enter contact name.' : 'Enter party or customer name.'
      );
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setInlineError('Enter an amount greater than ₹0.');
      return;
    }
    setInlineBusy(true);
    try {
      const targetKind: AccountKind =
        capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer';
      if (onInlineQuickAdd) {
        await onInlineQuickAdd({
          customerName: cleanName,
          direction: dir,
          amount: numericAmount,
          kind: targetKind,
          note: inlineNote.trim() || undefined,
        });
      } else {
        await onCreateAccount({
          kind: targetKind,
          name: cleanName,
          phone: '',
          dueDate: '',
        });
      }
      setInlineName('');
      setInlineAmount('');
      setInlineNote('');
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Could not save entry.');
    } finally {
      setInlineBusy(false);
    }
  };

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
    <div className="pb-32">
      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start lg:space-y-0">
        {/* LEFT COLUMN (Mobile Full / Desktop 5-col Sticky Stage): Collapsing Title + 3D Wallet Stack + Control Center Matrix */}
        <div className="space-y-3.5 lg:col-span-5 lg:sticky lg:top-2">
          {/* 1. iOS 27 Collapsing Large Title Row */}
          <motion.div
            style={
              prefersReducedMotion
                ? undefined
                : {
                    opacity: activeTitleOpacity,
                    scale: activeTitleScale,
                    y: activeTitleY,
                  }
            }
            className="flex items-end justify-between gap-2 px-0.5 origin-left will-change-transform"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-muted)]">
                <span className="truncate">{activeAdaptation.focusBadge}</span>
                {overdueCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        onOpenCollection();
                      }}
                      className="text-[var(--credit-red)] font-extrabold hover:underline shrink-0"
                    >
                      {overdueCount} due
                    </button>
                  </>
                )}
              </div>
              <h2 className="font-display text-[19px] sm:text-[25px] leading-tight font-extrabold tracking-tight text-[var(--ink)] whitespace-nowrap">
                {capabilities.feedTitle}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
              <motion.button
                whileTap={{ scale: 0.94, rotate: -4, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setShowFilterSortSheet(true);
                }}
                className={`min-h-[34px] px-3 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 ${
                  hasSecondaryFilter || showAllModes || sortBy !== 'latest-activity'
                    ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] border border-[var(--brand-accent)]/25'
                    : 'ios27-ceramic-tile text-[var(--ink)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{hasSecondaryFilter ? activeFilterLabel : 'Filter'}</span>
              </motion.button>
            </div>
          </motion.div>

          {/* 2. Flagship Interactive 3-Pass Apple Wallet Stack */}
          <WalletCardStack
            cashflow={cashflow}
            gallaPulse={gallaPulse}
            partyCount={accounts.length}
            overdueCount={overdueCount}
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
            onOpenGalla={onOpenGalla}
            onSelectAccount={onSelectAccount}
            onQuickCollect={openQuickEntrySheet}
          />

          {/* 3. Compact 4-Column iOS Quick Action Bar */}
          <div className="grid grid-cols-4 gap-2" aria-label="Quick Actions">
            <motion.button
              whileTap={{ scale: 0.94, y: 1 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() =>
                handleOpenAddModal(
                  capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                )
              }
              className="ios27-ceramic-tile rounded-[20px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5"
            >
              <span className="w-9 h-9 rounded-[12px] bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 stroke-[2.3]" />
              </span>
              <span className="text-[11px] font-extrabold text-[var(--ink)] truncate max-w-full">
                {capabilities.focus === 'personal' ? 'Contact' : 'New Party'}
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94, y: 1 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() => {
                haptics.orbTap();
                onOpenVoiceEntry();
              }}
              className="ios27-ceramic-tile rounded-[20px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5"
            >
              <span className="w-9 h-9 rounded-[12px] bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 stroke-[2.3]" />
              </span>
              <span className="text-[11px] font-extrabold text-[var(--ink)] truncate max-w-full">
                Voice
              </span>
            </motion.button>

            {capabilities.focus !== 'personal' ? (
              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenParchiScanner();
                }}
                className="ios27-ceramic-tile rounded-[20px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5"
              >
                <span className="w-9 h-9 rounded-[12px] bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 stroke-[2.3]" />
                </span>
                <span className="text-[11px] font-extrabold text-[var(--ink)] truncate max-w-full">
                  Scan
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.94, y: 1 }}
                transition={SPRING_FAST}
                type="button"
                onClick={() => {
                  haptics.tap();
                  onOpenDailySummary();
                }}
                className="ios27-ceramic-tile rounded-[20px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5"
              >
                <span className="w-9 h-9 rounded-[12px] bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center shrink-0">
                  <Volume2 className="w-4 h-4 stroke-[2.3]" />
                </span>
                <span className="text-[11px] font-extrabold text-[var(--ink)] truncate max-w-full">
                  Audio
                </span>
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.94, y: 1 }}
              transition={SPRING_FAST}
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenCollection();
              }}
              className="ios27-ceramic-tile rounded-[20px] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5 relative"
            >
              <span className="w-9 h-9 rounded-[12px] bg-[var(--credit-tint)] text-[var(--credit-red)] flex items-center justify-center shrink-0">
                <Repeat className="w-4 h-4 stroke-[2.3]" />
              </span>
              <span className="text-[11px] font-extrabold text-[var(--ink)] truncate max-w-full">
                {overdueCount > 0 ? `Due (${overdueCount})` : 'Collect'}
              </span>
            </motion.button>
          </div>

          {/* 4. Inline Mandi Bori / Wazan / Aadat Calculator (Mandi Mode Only) */}
          {capabilities.showMandiCalculator && <MandiAadatHelper />}
        </div>

        {/* RIGHT COLUMN (Mobile Stacked / Desktop 7-col Ledger Feed): Elastic Segment Switcher + iOS 27 Inset Grouped Rows */}
        <div className="space-y-3 lg:col-span-7">
          {segmentTabs.length > 1 && (
            <div
              className={`relative grid rounded-full bg-[var(--surface-subtle)] border border-[var(--surface-border)] p-1 ${
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
                    className={`relative min-h-[40px] px-2 rounded-full text-xs font-extrabold transition-colors ${
                      active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={prefersReducedMotion ? undefined : 'cashKhataKindPill'}
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

          {/* Scroll-Velocity Jelly Party List / Inline Galla / Empty State */}
          <motion.div
            style={prefersReducedMotion ? undefined : { skewY: activeJellySkew }}
            className="space-y-2.5 origin-center"
          >
            {segment === 'galla' && capabilities.showGalla ? (
              <div className="space-y-2.5">
                <div className="ios27-inset-group rounded-[26px] p-4 flex items-center justify-between gap-3">
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
                  <div className="ios27-inset-group rounded-[26px] p-6 text-center space-y-2.5">
                    <p className="font-display text-base font-extrabold text-[var(--ink)]">
                      No Galla entries recorded yet
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Tap Open Galla above or use + New to log Cash In, Expenses, or UPI sales.
                    </p>
                  </div>
                ) : (
                  <div className="ios27-inset-group rounded-[28px] divide-y divide-[var(--surface-border)] overflow-hidden">
                    {sortedCashbookEntries.map((entry, idx) => {
                      const isInflow = entry.entryType === 'inflow';
                      return (
                        <motion.button
                          key={entry.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...SPRING_FAST, delay: Math.min(idx, 8) * 0.025 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => {
                            haptics.tap();
                            onOpenGalla();
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--app-bg)]/45 transition-colors"
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
                              <p className="text-sm font-extrabold text-[var(--ink)] truncate">
                                {entry.category}
                              </p>
                              <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                                {entry.mode.toUpperCase()} · {entry.note || formatDateTime(entry.entryDate)}
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
                    })}
                  </div>
                )}
              </div>
            ) : accounts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={SPRING_FAST}
                className="ios27-inset-group rounded-[28px] p-5 space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                      {activeAdaptation.focusBadge} · Instant Entry
                    </p>
                    <h1 className="font-display text-lg font-extrabold text-[var(--ink)]">
                      {capabilities.focus === 'personal'
                        ? 'Record First Personal Entry'
                        : 'Record First Ledger Entry'}
                    </h1>
                    <p className="text-xs text-[var(--ink-muted)] leading-snug">
                      {activeAdaptation.emptyStateHint}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAddModal(
                        capabilities.showSuppliers && segment === 'supplier' ? 'supplier' : 'customer'
                      )
                    }
                    className="min-h-[34px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink)] inline-flex items-center gap-1 shrink-0 active:scale-95 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[var(--brand-accent)]" />
                    <span>Full Form</span>
                  </button>
                </div>

                {/* Instant Inline Quick Add Form (Zero Modal Hopping, Muscle Memory Symmetry) */}
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7">
                      <label htmlFor="inline-quick-party" className="sr-only">
                        Party Name
                      </label>
                      <input
                        id="inline-quick-party"
                        type="text"
                        value={inlineName}
                        onChange={(e) => {
                          setInlineError('');
                          setInlineName(e.target.value);
                        }}
                        placeholder={
                          capabilities.focus === 'personal'
                            ? 'Friend or contact name (e.g. Rahul)'
                            : 'Party or customer name (e.g. Sharma Ji)'
                        }
                        className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label htmlFor="inline-quick-amount" className="sr-only">
                        Amount in Rupees
                      </label>
                      <input
                        id="inline-quick-amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="any"
                        value={inlineAmount}
                        onChange={(e) => {
                          setInlineError('');
                          setInlineAmount(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !inlineBusy) {
                            void handleInlineSubmit('given');
                          }
                        }}
                        placeholder="₹ Amount"
                        className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-base font-extrabold font-tabular text-right text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                      />
                    </div>
                  </div>

                  {/* Quick Increment Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[100, 500, 1000].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setInlineError('');
                          const current = Number(inlineAmount) || 0;
                          setInlineAmount(String(current + inc));
                        }}
                        className="min-h-[32px] px-2.5 rounded-xl bg-[var(--surface-subtle)] text-[11px] font-extrabold font-tabular text-[var(--ink)] active:scale-95 transition"
                      >
                        +₹{inc}
                      </button>
                    ))}
                    {inlineAmount && (
                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          setInlineAmount('');
                        }}
                        className="min-h-[32px] px-2.5 rounded-xl bg-[var(--app-bg)] text-[11px] font-bold text-[var(--ink-muted)] active:scale-95 transition"
                      >
                        Clear
                      </button>
                    )}
                    <input
                      type="text"
                      value={inlineNote}
                      onChange={(e) => setInlineNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !inlineBusy) {
                          void handleInlineSubmit('given');
                        }
                      }}
                      placeholder={activeAdaptation.quickNotePlaceholder}
                      aria-label="Optional entry note"
                      className="flex-1 min-w-[140px] min-h-[32px] rounded-xl bg-[var(--app-bg)] px-2.5 text-xs font-medium text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                    />
                  </div>

                  {inlineError && (
                    <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
                      {inlineError}
                    </p>
                  )}

                  {/* Symmetric Fitts's Law Direction Buttons: Left Red Credit · Right Green Received */}
                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    <motion.button
                      whileTap={{ scale: 0.95, y: 1 }}
                      transition={SPRING_FAST}
                      type="button"
                      disabled={inlineBusy}
                      aria-busy={inlineBusy}
                      onClick={() => void handleInlineSubmit('given')}
                      className="min-h-[48px] px-3 rounded-2xl bg-[var(--credit-red)] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      <ArrowUp className="w-4 h-4 shrink-0" />
                      <span>{inlineBusy ? 'Saving...' : 'Credit Given'}</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95, y: 1 }}
                      transition={SPRING_FAST}
                      type="button"
                      disabled={inlineBusy}
                      aria-busy={inlineBusy}
                      onClick={() => void handleInlineSubmit('received')}
                      className="min-h-[48px] px-3 rounded-2xl bg-[var(--debit-green)] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      <ArrowDown className="w-4 h-4 shrink-0" />
                      <span>{inlineBusy ? 'Saving...' : 'Payment Received'}</span>
                    </motion.button>
                  </div>

                  <div
                    className={`grid gap-2 pt-1 ${
                      capabilities.focus === 'personal' ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    <motion.button
                      whileTap={{ scale: 0.95, y: 1 }}
                      transition={SPRING_FAST}
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        onOpenVoiceEntry();
                      }}
                      className="min-h-[42px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-[11px] font-extrabold whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <Mic className="w-3.5 h-3.5 shrink-0" />
                      <span>Speak to Save</span>
                    </motion.button>

                    {capabilities.focus !== 'personal' && (
                      <motion.button
                        whileTap={{ scale: 0.95, y: 1 }}
                        transition={SPRING_FAST}
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          onOpenParchiScanner();
                        }}
                        className="min-h-[42px] px-2.5 rounded-2xl bg-[var(--app-bg)] text-[11px] font-bold text-[var(--ink)] whitespace-nowrap flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-[var(--brand-accent)] shrink-0" />
                        <span>Scan Receipt</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : filteredAccounts.length === 0 ? (
              <div className="ios27-inset-group rounded-[28px] p-8 text-center space-y-3">
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
              <div className="space-y-2">
                <div className="ios27-inset-group rounded-[28px] divide-y divide-[var(--surface-border)] overflow-hidden">
                  {filteredAccounts.slice(0, visibleCount).map((acc, idx) => {
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
                        groupedRow
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
                </div>
                {filteredAccounts.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setVisibleCount((v) => v + 60);
                    }}
                    className="w-full min-h-[42px] rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)] text-xs font-extrabold text-[var(--brand-accent)] active:scale-[0.99] transition"
                  >
                    Show More ({filteredAccounts.length - visibleCount} remaining)
                  </button>
                )}
                {accounts.length <= 3 && (
                  <p className="text-[10px] font-semibold text-center text-[var(--ink-muted)] pt-1">
                    Swipe row right to Receive ₹ or left for WhatsApp Remind
                  </p>
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
                  <span>Credit (Given)</span>
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
                      className={`min-h-[30px] px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 active:scale-95 transition ${
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
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
