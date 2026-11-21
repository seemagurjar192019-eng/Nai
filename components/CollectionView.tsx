'use client';

import React, { useState } from 'react';
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
  getAvatarColor,
  getLocalDateKey,
  getUIStrings,
  isValidUpiId,
} from '@/lib/i18n';
import type {
  AccountKind,
  Business,
  CollectionFilterChip,
  CustomerTrustScore,
  LanguageCode,
  LedgerAccount,
  SortByOption,
} from '@/lib/types';

import type { PersonaCapabilities } from '@/lib/persona';

interface CollectionViewProps {
  accounts: LedgerAccount[];
  business: Business;
  language: LanguageCode;
  trustScoresByAccount: Record<string, CustomerTrustScore>;
  capabilities?: PersonaCapabilities;
  onUpdateAccountDue: (accountId: string, dueDate: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onOpenAccount: (account: LedgerAccount) => void;
}

const RING_RADIUS = 21;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function TrustAvatarRing({
  name,
  score,
  hasTrust,
}: {
  name: string;
  score: number;
  hasTrust: boolean;
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

  return (
    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          strokeWidth="3"
          fill="none"
          className="stroke-[var(--surface-subtle)]"
        />
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          strokeWidth="3"
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
        className="absolute w-10 h-10 rounded-full text-white font-extrabold text-base flex items-center justify-center shadow-sm"
      >
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  accounts,
  business,
  language,
  trustScoresByAccount,
  capabilities,
  onUpdateAccountDue,
  onSaveUpiId,
  onOpenAccount,
}) => {
  const t = getUIStrings(language);
  const [rawPartyKind, setRawPartyKind] = useState<AccountKind>('customer');
  const allowSuppliers = capabilities ? capabilities.showSuppliers : true;
  const partyKind: AccountKind = allowSuppliers ? rawPartyKind : 'customer';
  const [filterChip, setFilterChip] = useState<CollectionFilterChip>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('recovery-priority');
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
    todayStr,
    trustScoresByAccount
  );

  const safeSelectedIndex =
    selectedIndex === null
      ? null
      : dueAccounts.length === 0
        ? null
        : Math.min(selectedIndex, dueAccounts.length - 1);
  const current = safeSelectedIndex !== null ? dueAccounts[safeSelectedIndex] || null : null;
  const currentTrust = current ? trustScoresByAccount[current.id] : undefined;

  const chips: Array<{ id: CollectionFilterChip; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'due-today', label: t.dueToday },
    { id: 'pending-due', label: t.pendingDue },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'defaulters', label: t.defaulters },
    { id: 'high-risk', label: 'Trust < 50' },
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
      setDueEditAccount(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update due date.');
    } finally {
      setDueBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-32">
      {/* Sliding Pill Customer Receivables vs Supplier Payables Switch (hidden in Personal mode) */}
      {allowSuppliers && (
        <div className="relative grid grid-cols-2 rounded-2xl bg-[var(--surface-subtle)] p-1 shadow-inner">
          <span
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-[var(--surface)] shadow-sm transition-transform duration-200 ease-out ${
              partyKind === 'supplier' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          {(
            [
              { id: 'customer', label: `${capabilities?.primarySegmentLabel || 'Customers'} (Collect)` },
              { id: 'supplier', label: `${capabilities?.secondarySegmentLabel || 'Suppliers'} (Pay)` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setRawPartyKind(tab.id);
                setSelectedIndex(null);
              }}
              className={`relative z-10 min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition-colors active:scale-95 ${
                partyKind === tab.id
                  ? 'text-[var(--brand)] dark:text-[var(--brand-accent)]'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter Chips + Sort */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setFilterChip(c.id);
                setSelectedIndex(null);
              }}
              className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-extrabold whitespace-nowrap shrink-0 active:scale-95 transition ${
                filterChip === c.id
                  ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] shadow-xs'
                  : 'spatial-card text-[var(--ink-muted)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowSort(true)}
          aria-label="Sort collection accounts"
          className="min-w-[44px] min-h-[44px] rounded-2xl spatial-card flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <SlidersHorizontal className="w-4 h-4 text-[var(--ink)]" />
        </button>
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

      {/* Compact Due Cards List (tap card for QR Bottom Sheet; 1-tap Remind on WhatsApp per row) */}
      {dueAccounts.length === 0 ? (
        <div className="rounded-[28px] spatial-card p-8 text-center space-y-3">
          <p className="font-display text-base font-bold text-[var(--ink)]">
            No pending {partyKind === 'customer' ? 'customer dues' : 'supplier payables'} in this
            filter.
          </p>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            {partyKind === 'customer'
              ? 'Customers with pending credit balances appear here with instant UPI QR, Trust Score, and 1-tap WhatsApp reminders.'
              : 'Suppliers you owe money to appear here so you can settle on time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dueAccounts.map((acc, idx) => {
            const trust = trustScoresByAccount[acc.id];
            const msg = buildReminderMessage({
              customerName: acc.name,
              amount: acc.balance,
              shopName: business.name,
              upiId: business.upiId,
              language,
            });
            const statusSummary =
              trust && partyKind === 'customer'
                ? `Trust ${trust.score}/100 · ${trust.recoveryTimingHint}`
                : acc.promiseDate
                  ? `Promise: ${acc.promiseDate}`
                  : acc.dueDate
                    ? `Due: ${acc.dueDate}`
                    : acc.phone
                      ? `+91 ${acc.phone}`
                      : 'Tap for UPI QR & details';

            return (
              <div
                key={acc.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedIndex(idx);
                  }
                }}
                style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                className="stagger-fade-up rounded-[22px] spatial-card p-3.5 flex items-center justify-between gap-2.5 active:scale-[0.985] transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <TrustAvatarRing
                    name={acc.name}
                    score={trust?.score ?? 100}
                    hasTrust={Boolean(trust && partyKind === 'customer')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[var(--ink)] leading-snug truncate">
                      {acc.name}
                    </p>
                    <p
                      className={`text-[11px] font-semibold leading-snug mt-0.5 truncate ${
                        trust?.band === 'high-risk' && partyKind === 'customer'
                          ? 'text-[var(--credit-red)]'
                          : 'text-[var(--ink-muted)]'
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
                      className="min-h-[44px] px-3 rounded-xl bg-[var(--debit-green)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs active:scale-95 transition"
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
                      className="min-h-[44px] px-3 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                    >
                      <span>Open Ledger</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk WhatsApp Reminder Action (customers) */}
      {partyKind === 'customer' && dueAccounts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
        >
          <Users className="w-5 h-5" />
          <span>Bulk WhatsApp &amp; SMS Reminder ({dueAccounts.length})</span>
        </button>
      )}

      {/* Payment Due Reminder UPI QR Bottom Sheet */}
      {current && safeSelectedIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedIndex(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedIndex(null);
                  onOpenAccount(current);
                }}
                className="flex items-center gap-3 text-left min-w-0 flex-1 active:scale-95 transition"
              >
                <TrustAvatarRing
                  name={current.name}
                  score={currentTrust?.score ?? 100}
                  hasTrust={Boolean(currentTrust && partyKind === 'customer')}
                />
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold text-[var(--ink)]">
                    {current.name}
                  </p>
                  <p className="text-xs font-medium text-[var(--ink-muted)] leading-snug">
                    {current.phone
                      ? `+91 ${current.phone}`
                      : current.lastNote || (partyKind === 'customer' ? 'Customer' : 'Supplier')}
                    {current.promiseDate ? ` · Promise: ${current.promiseDate}` : ''}
                  </p>
                  {currentTrust && partyKind === 'customer' && (
                    <p
                      className={`text-[11px] font-bold mt-0.5 leading-snug ${
                        currentTrust.band === 'high-risk'
                          ? 'text-[var(--credit-red)]'
                          : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      Trust {currentTrust.score}/100 · {currentTrust.recoveryTimingHint}
                    </p>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                aria-label="Close reminder"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Center Reminder + Live UPI QR */}
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

            {/* Due Date + Call */}
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
                className="w-full min-h-[50px] rounded-2xl bg-[var(--debit-green)] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
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
        </div>
      )}

      {/* Setup UPI ID Bottom Sheet */}
      {showUpiSetup && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowUpiSetup(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-4 pb-safe"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
              Setup Shop UPI ID
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Enter your VPA (e.g. sharma@okicici or 9876543210@ybl) to generate live QR codes for
              customers.
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
            {actionError && (
              <p className="text-xs font-bold text-[var(--credit-red)]">{actionError}</p>
            )}
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
        </div>
      )}

      {/* Due Date Bottom Sheet */}
      {dueEditAccount && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDueEditAccount(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-4 pb-safe"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
              Due Date — {dueEditAccount.name}
            </h3>
            <input
              type="date"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
              className="w-full min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] px-3.5 font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
            {actionError && (
              <p className="text-xs font-bold text-[var(--credit-red)]">{actionError}</p>
            )}
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
        </div>
      )}

      {/* Sort By Bottom Sheet */}
      {showSort && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSort(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-2.5 pb-safe"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">Sort By</h3>
              <button
                type="button"
                onClick={() => setShowSort(false)}
                aria-label="Close sort"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(
              [
                { id: 'recovery-priority', label: 'Recovery Priority (Smart)' },
                { id: 'recommended', label: 'Recommended' },
                { id: 'last-payment', label: 'Last Payment' },
                { id: 'latest-activity', label: 'Latest Activity' },
                { id: 'due-amount', label: 'Due Amount' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSortBy(opt.id);
                  setShowSort(false);
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
      )}

      {/* Bulk WhatsApp Queue Bottom Sheet */}
      {showBulkModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBulkModal(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet p-6 space-y-4 max-h-[85dvh] overflow-y-auto pb-safe"
          >
            <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                1-Click Vasooli Queue
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                aria-label="Close queue"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Tap Send next to any customer to launch their pre-filled WhatsApp payment reminder
              with your UPI QR link.
            </p>
            <div className="space-y-2">
              {dueAccounts.map((acc) => {
                const trust = trustScoresByAccount[acc.id];
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
                    className="rounded-2xl bg-[var(--app-bg)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[var(--ink)] truncate">{acc.name}</p>
                      <p className="text-xs font-tabular font-bold text-[var(--credit-red)]">
                        {formatINR(acc.balance)} Due
                        {trust ? ` · Trust ${trust.score}/100` : ''}
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
        </div>
      )}
    </div>
  );
};

function useMemoList(
  accounts: LedgerAccount[],
  partyKind: AccountKind,
  filterChip: CollectionFilterChip,
  sortBy: SortByOption,
  todayStr: string,
  trustScoresByAccount: Record<string, CustomerTrustScore>
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
    } else if (filterChip === 'high-risk') {
      list = list.filter((a) => (trustScoresByAccount[a.id]?.score ?? 100) < 50);
    }

    list.sort((a, b) => {
      if (sortBy === 'recovery-priority') {
        const pa = trustScoresByAccount[a.id]?.priorityScore || 0;
        const pb = trustScoresByAccount[b.id]?.priorityScore || 0;
        return pb - pa;
      }
      const amtA = Math.abs(a.balance);
      const amtB = Math.abs(b.balance);
      if (sortBy === 'due-amount') return amtB - amtA;
      if (sortBy === 'last-payment') return amtA - amtB;
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });
    return list;
  }, [accounts, partyKind, filterChip, sortBy, todayStr, trustScoresByAccount]);
}
