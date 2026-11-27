'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  QrCode,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildReminderMessage,
  buildUpiUri,
  buildWhatsAppUrl,
  formatINR,
  getLocalDateKey,
  getUIStrings,
  isValidUpiId,
} from '@/lib/i18n';
import type {
  AccountKind,
  Business,
  CollectionFilterChip,
  LanguageCode,
  LedgerAccount,
  SortByOption,
} from '@/lib/types';
import type { PersonaCapabilities } from '@/lib/persona';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
import { SNAPPY_SPRING } from './motion/SpatialMotionEngine';

interface CollectionViewProps {
  accounts: LedgerAccount[];
  business: Business;
  language: LanguageCode;
  capabilities?: PersonaCapabilities;
  onUpdateAccountDue: (accountId: string, dueDate: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onOpenAccount: (account: LedgerAccount) => void;
}

const SEG_SPRING = SNAPPY_SPRING;

export const CollectionView: React.FC<CollectionViewProps> = ({
  accounts,
  business,
  language,
  capabilities,
  onUpdateAccountDue,
  onSaveUpiId,
  onOpenAccount,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const t = getUIStrings(language);
  const [rawPartyKind, setRawPartyKind] = useState<AccountKind>('customer');
  const allowSuppliers = capabilities ? capabilities.showSuppliers : true;
  const partyKind: AccountKind = allowSuppliers ? rawPartyKind : 'customer';
  const [filterChip, setFilterChip] = useState<CollectionFilterChip>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('due-amount');
  const [showSort, setShowSort] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showUpiSetup, setShowUpiSetup] = useState(false);
  const [upiInput, setUpiInput] = useState(business.upiId || '');
  const [upiBusy, setUpiBusy] = useState(false);
  const [dueEditAccount, setDueEditAccount] = useState<LedgerAccount | null>(null);
  const [dueInput, setDueInput] = useState('');
  const [dueBusy, setDueBusy] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [actionError, setActionError] = useState('');

  const todayStr = getLocalDateKey();

  const dueAccounts = useMemoList(
    accounts,
    partyKind,
    filterChip,
    sortBy,
    todayStr
  );

  const safeSelectedIndex =
    selectedIndex === null
      ? null
      : dueAccounts.length === 0
        ? null
        : Math.min(selectedIndex, dueAccounts.length - 1);
  const current = safeSelectedIndex !== null ? dueAccounts[safeSelectedIndex] || null : null;

  const chips: Array<{ id: CollectionFilterChip; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'due-today', label: t.dueToday },
    { id: 'pending-due', label: t.pendingDue },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'defaulters', label: t.defaulters },
  ];

  const handleSaveUpi = async () => {
    setActionError('');
    const clean = upiInput.trim();
    if (!clean || !isValidUpiId(clean)) {
      setActionError('Enter a valid UPI ID (e.g. yourshop@okicici or 9876543210@ybl).');
      return;
    }
    setUpiBusy(true);
    try {
      await onSaveUpiId(clean);
      haptics.success();
      setShowUpiSetup(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save UPI ID.');
    } finally {
      setUpiBusy(false);
    }
  };

  const handleSaveDue = async () => {
    if (!dueEditAccount) return;
    setActionError('');
    setDueBusy(true);
    try {
      await onUpdateAccountDue(dueEditAccount.id, dueInput);
      haptics.success();
      setDueEditAccount(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update due date.');
    } finally {
      setDueBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            Collections
          </h2>
          <p className="text-xs font-medium text-[var(--ink-muted)] mt-0.5">
            Pending dues, UPI QR &amp; payment reminders
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSort(true)}
          aria-label="Sort collection accounts"
          className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <SlidersHorizontal className="w-4 h-4 text-[var(--ink)]" />
        </button>
      </div>

      {/* Spring Segmented Customer Receivables vs Supplier Payables Switch */}
      {allowSuppliers && (
        <div className="relative grid grid-cols-2 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1">
          {(
            [
              { id: 'customer', label: `${capabilities?.primarySegmentLabel || 'Customers'} (Collect)` },
              { id: 'supplier', label: `${capabilities?.secondarySegmentLabel || 'Suppliers'} (Pay)` },
            ] as const
          ).map((tab) => {
            const active = partyKind === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setRawPartyKind(tab.id);
                  setSelectedIndex(null);
                }}
                className={`relative z-10 min-h-[40px] px-3 rounded-full text-xs font-semibold transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'collectionPartyKindSeg'}
                    transition={SEG_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              haptics.tap();
              setFilterChip(c.id);
              setSelectedIndex(null);
            }}
            className={`min-h-[40px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 active:scale-95 transition border ${
              filterChip === c.id
                ? 'bg-[var(--brand)] text-[var(--brand-fg)] border-transparent'
                : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {actionError && !showUpiSetup && !dueEditAccount && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grouped Inset Due List */}
      {dueAccounts.length === 0 ? (
        <div className="rounded-[22px] ios27-inset-group p-8 text-center space-y-2">
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No pending {partyKind === 'customer' ? 'customer dues' : 'supplier payables'} in this filter
          </p>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed max-w-xs mx-auto">
            {partyKind === 'customer'
              ? 'Customers with pending credit balances appear here with instant UPI QR and 1-tap WhatsApp reminders.'
              : 'Suppliers you owe money to appear here so you can settle on time.'}
          </p>
        </div>
      ) : (
        <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {dueAccounts.map((acc, idx) => {
              const isOverdue = Boolean(acc.dueDate && acc.dueDate < todayStr);
              const msg = buildReminderMessage({
                customerName: acc.name,
                amount: acc.balance,
                shopName: business.name,
                upiId: business.upiId,
                language,
              });
              const statusSummary = acc.promiseDate
                ? `Promise: ${acc.promiseDate}`
                : acc.dueDate
                  ? isOverdue
                    ? `Overdue since ${acc.dueDate}`
                    : `Due: ${acc.dueDate}`
                  : acc.phone
                    ? `+91 ${acc.phone}`
                    : 'Tap for UPI QR & details';

              return (
                <motion.div
                  key={acc.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={SEG_SPRING}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(idx);
                    }
                  }}
                  className="px-4 py-3.5 min-h-[72px] flex items-center justify-between gap-2.5 hover:bg-[var(--surface-subtle)]/40 transition cursor-pointer will-change-transform"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] font-bold font-display text-sm flex items-center justify-center shrink-0">
                      {acc.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[var(--ink)] leading-snug truncate">
                        {acc.name}
                      </p>
                      <p
                        className={`text-[11px] font-semibold leading-snug mt-0.5 truncate ${
                          isOverdue ? 'text-[var(--credit-red)]' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        {statusSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-base font-extrabold font-tabular text-[var(--credit-red)]">
                      {formatINR(Math.abs(acc.balance))}
                    </p>
                    {partyKind === 'customer' ? (
                      <a
                        href={buildWhatsAppUrl(acc.phone, msg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="min-h-[38px] px-3.5 rounded-full bg-[var(--debit-green)] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Remind</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAccount(acc);
                        }}
                        className="min-h-[38px] px-3.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                      >
                        <span>Open Ledger</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {partyKind === 'customer' && dueAccounts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="w-full min-h-[50px] rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-semibold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
        >
          <Users className="w-4 h-4" />
          <span>Bulk Reminder Queue ({dueAccounts.length})</span>
        </button>
      )}

      {/* Payment Due Reminder UPI QR Detent Sheet */}
      <DetentSheetOverlay
        open={Boolean(current && safeSelectedIndex !== null)}
        onClose={() => setSelectedIndex(null)}
        title={current?.name || 'Reminder'}
        subtitle={
          current?.dueDate
            ? `Due: ${current.dueDate}`
            : current?.phone
              ? `+91 ${current.phone}`
              : undefined
        }
        initialDetent="full"
      >
        {current && safeSelectedIndex !== null && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setSelectedIndex(null);
                onOpenAccount(current);
              }}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[var(--app-bg)] p-3 text-left active:scale-[0.98] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] font-bold font-display text-sm flex items-center justify-center shrink-0">
                  {current.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-extrabold text-[var(--ink)] truncate">
                    Open {current.name}&apos;s Full Statement
                  </p>
                  <p className="text-[11px] text-[var(--ink-muted)] truncate">
                    {current.promiseDate ? `Promise: ${current.promiseDate}` : 'View timeline & entries'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
            </button>

            <div className="relative rounded-[24px] bg-[var(--app-bg)] p-5 text-center space-y-3">
              <button
                type="button"
                disabled={safeSelectedIndex === 0}
                onClick={() => setSelectedIndex((i) => Math.max(0, (i ?? 0) - 1))}
                aria-label="Previous party"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full spatial-card flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={safeSelectedIndex >= dueAccounts.length - 1}
                onClick={() =>
                  setSelectedIndex((i) => Math.min(dueAccounts.length - 1, (i ?? 0) + 1))
                }
                aria-label="Next party"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full spatial-card flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
                {partyKind === 'customer' ? 'Payment Due Reminder' : 'Supplier Payable'}
              </p>
              <p className="font-display text-3xl font-extrabold font-tabular text-[var(--credit-red)]">
                {formatINR(Math.abs(current.balance))}
              </p>

              {partyKind === 'customer' && (
                <>
                  <div className="mx-auto w-fit p-3.5 bg-white rounded-3xl shadow-md relative">
                    <QRCodeSVG
                      value={buildUpiUri(
                        business.upiId || 'setup-upi@okicici',
                        business.name,
                        Math.abs(current.balance)
                      )}
                      size={156}
                    />
                    {!business.upiId && (
                      <button
                        type="button"
                        onClick={() => {
                          setUpiInput('');
                          setActionError('');
                          setShowUpiSetup(true);
                        }}
                        className="absolute inset-0 bg-white rounded-3xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
                      >
                        <span className="px-3.5 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5 shadow">
                          <QrCode className="w-4 h-4" />
                          <span>Setup UPI</span>
                        </span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    BHIM · PhonePe · Paytm · Google Pay
                    {business.upiId ? ` (${business.upiId})` : ''}
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActionError('');
                  setDueEditAccount(current);
                  setDueInput(current.dueDate || todayStr);
                }}
                className="min-h-[46px] rounded-2xl bg-[var(--app-bg)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <Calendar className="w-4 h-4 text-[var(--brand-accent)]" />
                <span className="font-tabular">{current.dueDate || 'Due Date'}</span>
              </button>

              <a
                href={current.phone ? `tel:${current.phone}` : '#'}
                onClick={(e) => {
                  if (!current.phone) {
                    e.preventDefault();
                    setSelectedIndex(null);
                    onOpenAccount(current);
                  }
                }}
                className="min-h-[46px] rounded-2xl bg-[var(--app-bg)] text-sm font-bold text-[var(--ink)] flex items-center justify-center gap-2 hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <Phone className="w-4 h-4 text-[var(--brand-accent)]" />
                <span>{t.callNow}</span>
              </a>
            </div>

            {partyKind === 'customer' ? (
              <a
                href={buildWhatsAppUrl(
                  current.phone,
                  buildReminderMessage({
                    customerName: current.name,
                    amount: current.balance,
                    shopName: business.name,
                    upiId: business.upiId,
                    language,
                  })
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[50px] rounded-2xl bg-[var(--debit-green)] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition"
              >
                <MessageCircle className="w-5 h-5" />
                <span>{t.sendWhatsapp}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedIndex(null);
                  onOpenAccount(current);
                }}
                className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
              >
                <span>Open Supplier Ledger to Record Payment</span>
              </button>
            )}

            <p className="text-center text-xs font-bold font-tabular text-[var(--ink-muted)]">
              {safeSelectedIndex + 1} / {dueAccounts.length}
            </p>
          </div>
        )}
      </DetentSheetOverlay>

      {/* Setup UPI ID Detent Sheet */}
      <DetentSheetOverlay
        open={showUpiSetup}
        onClose={() => setShowUpiSetup(false)}
        title="Setup Shop UPI ID"
        subtitle="Generates live QR codes for customers"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--ink-muted)]">
            Enter your VPA (e.g. sharma@okicici or 9876543210@ybl).
          </p>
          <input
            type="text"
            value={upiInput}
            onChange={(e) => {
              setUpiInput(e.target.value);
              setActionError('');
            }}
            placeholder="yourshop@upi"
            className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] px-3.5 font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          />
          {actionError && <p className="text-xs font-bold text-[var(--credit-red)]">{actionError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={upiBusy}
              onClick={handleSaveUpi}
              className="min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold tactile-key-primary disabled:opacity-60 active:scale-95 transition"
            >
              {upiBusy ? 'Saving...' : 'Save UPI ID'}
            </button>
            <button
              type="button"
              onClick={() => setShowUpiSetup(false)}
              className="min-h-[46px] rounded-2xl bg-[var(--app-bg)] font-bold text-[var(--ink)] active:scale-95 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DetentSheetOverlay>

      {/* Due Date Detent Sheet */}
      <DetentSheetOverlay
        open={Boolean(dueEditAccount)}
        onClose={() => setDueEditAccount(null)}
        title={`Due Date — ${dueEditAccount?.name || ''}`}
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="space-y-4">
          <input
            type="date"
            value={dueInput}
            onChange={(e) => setDueInput(e.target.value)}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] px-3.5 font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          />
          {actionError && <p className="text-xs font-bold text-[var(--credit-red)]">{actionError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={dueBusy}
              onClick={handleSaveDue}
              className="min-h-[46px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold tactile-key-primary disabled:opacity-60 active:scale-95 transition"
            >
              {dueBusy ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setDueEditAccount(null)}
              className="min-h-[46px] rounded-2xl bg-[var(--app-bg)] font-bold text-[var(--ink)] active:scale-95 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DetentSheetOverlay>

      {/* Sort By Detent Sheet */}
      <DetentSheetOverlay
        open={showSort}
        onClose={() => setShowSort(false)}
        title="Sort Collections"
        initialDetent="peek"
        allowDetentToggle={false}
      >
        <div className="ios27-inset-group rounded-2xl divide-y divide-[var(--surface-border)] overflow-hidden">
          {(
            [
              { id: 'due-amount', label: 'Due Amount (Highest First)' },
              { id: 'recommended', label: 'Recommended' },
              { id: 'last-payment', label: 'Last Payment' },
              { id: 'latest-activity', label: 'Latest Activity' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setSortBy(opt.id);
                setShowSort(false);
              }}
              className={`w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-bold transition ${
                sortBy === opt.id
                  ? 'bg-[var(--brand-tint)]/50 text-[var(--brand-accent)]'
                  : 'text-[var(--ink)]'
              }`}
            >
              <span>{opt.label}</span>
              {sortBy === opt.id && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </DetentSheetOverlay>

      {/* Bulk WhatsApp Queue Detent Sheet */}
      <DetentSheetOverlay
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Payment Reminder Queue"
        subtitle={`${dueAccounts.length} pending parties`}
        initialDetent="full"
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--ink-muted)]">
            Tap Send next to any customer to launch their pre-filled WhatsApp payment reminder with
            your UPI QR link.
          </p>
          <div className="ios27-inset-group rounded-2xl divide-y divide-[var(--surface-border)] overflow-hidden">
            {dueAccounts.map((acc) => {
              const msg = buildReminderMessage({
                customerName: acc.name,
                amount: acc.balance,
                shopName: business.name,
                upiId: business.upiId,
                language,
              });
              return (
                <div
                  key={acc.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[var(--ink)] truncate">{acc.name}</p>
                    <p className="text-xs font-tabular font-bold text-[var(--credit-red)]">
                      {formatINR(acc.balance)} Due
                    </p>
                  </div>
                  <a
                    href={buildWhatsAppUrl(acc.phone, msg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3.5 rounded-xl bg-[var(--debit-green)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 active:scale-95 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};

function useMemoList(
  accounts: LedgerAccount[],
  partyKind: AccountKind,
  filterChip: CollectionFilterChip,
  sortBy: SortByOption,
  todayStr: string
): LedgerAccount[] {
  return React.useMemo(() => {
    let list = accounts.filter((a) =>
      partyKind === 'customer'
        ? a.kind === 'customer' && a.balance > 0
        : a.kind === 'supplier' && a.balance < 0
    );

    if (filterChip === 'due-today') {
      list = list.filter((a) => a.dueDate === todayStr);
    } else if (filterChip === 'pending-due') {
      list = list.filter((a) => a.dueDate === '' || a.dueDate >= todayStr);
    } else if (filterChip === 'upcoming') {
      list = list.filter((a) => a.dueDate !== '' && a.dueDate > todayStr);
    } else if (filterChip === 'defaulters') {
      list = list.filter((a) => a.dueDate !== '' && a.dueDate < todayStr);
    }

    list.sort((a, b) => {
      const amtA = Math.abs(a.balance);
      const amtB = Math.abs(b.balance);
      if (sortBy === 'due-amount') return amtB - amtA;
      if (sortBy === 'last-payment') return amtA - amtB;
      if (sortBy === 'recommended') return amtB - amtA;
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });
    return list;
  }, [accounts, partyKind, filterChip, sortBy, todayStr]);
}
