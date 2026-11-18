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

interface CollectionViewProps {
  accounts: LedgerAccount[];
  business: Business;
  language: LanguageCode;
  trustScoresByAccount: Record<string, CustomerTrustScore>;
  onUpdateAccountDue: (accountId: string, dueDate: string) => Promise<void>;
  onSaveUpiId: (upiId: string) => Promise<void>;
  onOpenAccount: (account: LedgerAccount) => void;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  accounts,
  business,
  language,
  trustScoresByAccount,
  onUpdateAccountDue,
  onSaveUpiId,
  onOpenAccount,
}) => {
  const t = getUIStrings(language);
  const [partyKind, setPartyKind] = useState<AccountKind>('customer');
  const [filterChip, setFilterChip] = useState<CollectionFilterChip>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('recovery-priority');
  const [showSort, setShowSort] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const safeIndex = Math.min(activeIndex, Math.max(0, dueAccounts.length - 1));
  const current = dueAccounts[safeIndex] || null;
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
    <div className="space-y-4 pb-24">
      {/* Customer Receivables vs Supplier Payables Switch */}
      <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
        {(
          [
            { id: 'customer', label: 'Customers (To Collect)' },
            { id: 'supplier', label: 'Suppliers (To Pay)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setPartyKind(tab.id);
              setActiveIndex(0);
            }}
            className={`min-h-[38px] px-4 rounded-lg text-xs sm:text-sm font-bold transition ${
              partyKind === tab.id
                ? 'bg-[var(--surface)] text-[var(--brand)] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Chips + Sort */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setFilterChip(c.id);
                setActiveIndex(0);
              }}
              className={`min-h-[38px] px-4 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 border transition ${
                filterChip === c.id
                  ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                  : 'bg-[var(--surface)] border-[var(--surface-border)] text-slate-600 dark:text-slate-300'
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
          className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {actionError && !showUpiSetup && !dueEditAccount && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </span>
          <button type="button" onClick={() => setActionError('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collection Card Carousel */}
      {!current ? (
        <div className="rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-10 text-center space-y-3">
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">
            No pending {partyKind === 'customer' ? 'customer dues' : 'supplier payables'} in this
            filter.
          </p>
          <p className="text-sm text-slate-500">
            {partyKind === 'customer'
              ? 'Customers with pending credit balances appear here with instant UPI QR, Trust Score, and WhatsApp reminders.'
              : 'Suppliers you owe money to appear here so you can settle on time.'}
          </p>
        </div>
      ) : (
        <div className="max-w-lg mx-auto space-y-4">
          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 shadow-sm space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenAccount(current)}
                className="flex items-center gap-3 text-left min-w-0"
              >
                <div
                  style={{ backgroundColor: getAvatarColor(current.name) }}
                  className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center shrink-0"
                >
                  {current.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {current.name}
                  </p>
                  <p className="text-xs font-medium text-slate-500 truncate">
                    {current.phone
                      ? `+91 ${current.phone}`
                      : current.lastNote || (partyKind === 'customer' ? 'Customer' : 'Supplier')}
                    {current.promiseDate ? ` · Promise: ${current.promiseDate}` : ''}
                  </p>
                  {currentTrust && partyKind === 'customer' && (
                    <p
                      className={`text-[11px] font-bold truncate mt-0.5 ${
                        currentTrust.band === 'high-risk'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Trust {currentTrust.score}/100 · {currentTrust.recoveryTimingHint}
                    </p>
                  )}
                </div>
              </button>
              <div className="text-right shrink-0">
                <p
                  className={`text-lg font-extrabold font-tabular ${
                    partyKind === 'customer' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatINR(Math.abs(current.balance))}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {partyKind === 'customer' ? t.due : t.youPay}
                </p>
              </div>
            </div>

            {/* Center Reminder + Live UPI QR */}
            <div className="relative rounded-2xl bg-[var(--app-bg)] border border-[var(--surface-border)] p-5 text-center space-y-3">
              <button
                type="button"
                disabled={safeIndex === 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous party"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={safeIndex >= dueAccounts.length - 1}
                onClick={() => setActiveIndex((i) => Math.min(dueAccounts.length - 1, i + 1))}
                aria-label="Next party"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--surface-border)] flex items-center justify-center disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {partyKind === 'customer' ? 'Payment Due Reminder' : 'Supplier Payable'}
              </p>
              <p className="text-3xl font-extrabold font-tabular text-slate-900 dark:text-white">
                {formatINR(Math.abs(current.balance))}
              </p>

              {partyKind === 'customer' && (
                <>
                  <div className="mx-auto w-fit p-3 bg-white rounded-2xl border border-slate-200 relative">
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
                        className="absolute inset-0 bg-white/85 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-1.5"
                      >
                        <span className="px-3.5 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5 shadow">
                          <QrCode className="w-4 h-4" />
                          <span>Setup UPI</span>
                        </span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] font-semibold text-slate-500">
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
                className="min-h-[46px] rounded-xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Calendar className="w-4 h-4 text-[var(--brand)]" />
                <span>{current.dueDate || 'Due Date'}</span>
              </button>

              <a
                href={current.phone ? `tel:${current.phone}` : '#'}
                onClick={(e) => {
                  if (!current.phone) {
                    e.preventDefault();
                    onOpenAccount(current);
                  }
                }}
                className="min-h-[46px] rounded-xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Phone className="w-4 h-4 text-[var(--brand)]" />
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
                className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span>{t.sendWhatsapp}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAccount(current)}
                className="w-full min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Open Supplier Ledger to Record Payment</span>
              </button>
            )}
          </div>

          <p className="text-center text-xs font-bold font-tabular text-slate-500">
            {safeIndex + 1} / {dueAccounts.length}
          </p>
        </div>
      )}

      {/* Bulk WhatsApp Reminder Action (customers) */}
      {partyKind === 'customer' && dueAccounts.length > 0 && (
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 shadow-md"
          >
            <Users className="w-5 h-5" />
            <span>Bulk WhatsApp &amp; SMS Reminder ({dueAccounts.length})</span>
          </button>
        </div>
      )}

      {/* Setup UPI ID Modal */}
      {showUpiSetup && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowUpiSetup(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
          >
            <h3 className="text-lg font-extrabold">Setup Shop UPI ID</h3>
            <p className="text-xs text-slate-500">
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
              className="w-full min-h-[48px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 font-bold outline-none"
            />
            {actionError && <p className="text-xs font-bold text-red-600">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={upiBusy}
                onClick={handleSaveUpi}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold disabled:opacity-60"
              >
                {upiBusy ? 'Saving...' : 'Save UPI ID'}
              </button>
              <button
                type="button"
                onClick={() => setShowUpiSetup(false)}
                className="min-h-[46px] rounded-xl bg-black/5 dark:bg-white/10 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Due Date Modal */}
      {dueEditAccount && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDueEditAccount(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4"
          >
            <h3 className="text-lg font-extrabold">Due Date — {dueEditAccount.name}</h3>
            <input
              type="date"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 font-tabular"
            />
            {actionError && <p className="text-xs font-bold text-red-600">{actionError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={dueBusy}
                onClick={handleSaveDue}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-bold disabled:opacity-60"
              >
                {dueBusy ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setDueEditAccount(null)}
                className="min-h-[46px] rounded-xl bg-black/5 dark:bg-white/10 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort By Modal */}
      {showSort && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSort(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-2.5"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-lg font-extrabold">Sort By</h3>
              <button type="button" onClick={() => setShowSort(false)} aria-label="Close sort">
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
                className={`w-full min-h-[46px] px-4 rounded-xl flex items-center justify-between text-sm font-bold ${
                  sortBy === opt.id
                    ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>{opt.label}</span>
                {sortBy === opt.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Queue Modal */}
      {showBulkModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBulkModal(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">1-Click Vasooli Queue</h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                aria-label="Close queue"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Tap Send next to any customer to launch their pre-filled WhatsApp payment reminder
              with your UPI QR link.
            </p>
            <div className="space-y-2.5">
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
                    className="rounded-2xl border border-[var(--surface-border)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{acc.name}</p>
                      <p className="text-xs font-tabular font-bold text-red-600 truncate">
                        {formatINR(acc.balance)} Due
                        {trust ? ` · Trust ${trust.score}/100` : ''}
                      </p>
                    </div>
                    <a
                      href={buildWhatsAppUrl(acc.phone, msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
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
