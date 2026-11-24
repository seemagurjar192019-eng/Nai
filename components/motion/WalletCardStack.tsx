'use client';

import React, { useMemo, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  Volume2,
  Wallet,
} from 'lucide-react';
import { formatINR, getAvatarColor } from '@/lib/i18n';
import type { PersonaAdaptation, PersonaCapabilities } from '@/lib/persona';
import type { DuePartySpotlight, NetCashflowSummary } from '@/lib/ucred-intelligence';
import type { DailyGallaPulse, LedgerAccount, TxDirection } from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from './OdometerNumber';

export type WalletSegment = 'customer' | 'supplier' | 'galla';

export interface WalletCardStackProps {
  cashflow: NetCashflowSummary;
  gallaPulse: DailyGallaPulse;
  partyCount: number;
  overdueCount: number;
  hideBalance: boolean;
  segment: WalletSegment;
  hasSecondaryFilter: boolean;
  capabilities: PersonaCapabilities;
  personaAdaptation: PersonaAdaptation;
  topDueParties: DuePartySpotlight[];
  heroOpacity?: MotionValue<number>;
  heroScale?: MotionValue<number>;
  heroY?: MotionValue<number>;
  onToggleHideBalance: () => void;
  onSelectSegment: (segment: WalletSegment) => void;
  onOpenDailySummary: () => void;
  onOpenCollection: () => void;
  onOpenGalla: () => void;
  onSelectAccount: (account: LedgerAccount) => void;
  onQuickCollect: (account: LedgerAccount, direction: TxDirection) => void;
}

type PassId = 'balance' | 'collection' | 'cashbook';

const STACK_SPRING = { type: 'spring' as const, stiffness: 330, damping: 27, mass: 0.9 };
const FAST_SPRING = { type: 'spring' as const, stiffness: 460, damping: 26 };
const TILT_SPRING = { stiffness: 260, damping: 24, mass: 0.6 };

/**
 * Flagship iOS 27 Interactive Apple Wallet 3-Pass Stack:
 * - Pass 0 (Obsidian Carbon): Net Balance + Privacy Eye + Split Spectrum + Listen
 * - Pass 1 (Royal Indigo): Today's Overdue Recovery & Top Priority Accounts
 * - Pass 2 (Emerald Graphite): Daily Cash Drawer & Inflow Pulse (or Trust Health in Personal Mode)
 *
 * Supports live 3D pointer tilt, tap-to-cycle front pass, vertical swipe cycling,
 * and a 1-tap 'Fan Deck' showcase spreading all 3 passes in Z-perspective.
 */
export const WalletCardStack: React.FC<WalletCardStackProps> = ({
  cashflow,
  gallaPulse,
  partyCount,
  overdueCount,
  hideBalance,
  segment,
  hasSecondaryFilter,
  capabilities,
  personaAdaptation,
  topDueParties,
  heroOpacity,
  heroScale,
  heroY,
  onToggleHideBalance,
  onSelectSegment,
  onOpenDailySummary,
  onOpenCollection,
  onOpenGalla,
  onSelectAccount,
  onQuickCollect,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [frontPass, setFrontPass] = useState<PassId>('balance');
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);
  const dragY = useMotionValue(0);
  const dragScale = useTransform(dragY, [-90, 0, 90], [0.975, 1, 0.975]);

  const passOrder: PassId[] = useMemo(() => {
    const base: PassId[] = ['balance', 'collection', 'cashbook'];
    const idx = base.indexOf(frontPass);
    if (idx <= 0) return base;
    return [...base.slice(idx), ...base.slice(0, idx)];
  }, [frontPass]);

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rawRotateY.set(Math.max(-2.6, Math.min(2.6, nx * 5.2)));
    rawRotateX.set(Math.max(-2.6, Math.min(2.6, -ny * 5.2)));
  };

  const resetTilt = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  const bringToFront = (id: PassId) => {
    haptics.swipe();
    setFrontPass(id);
  };

  const cycleNextPass = () => {
    const next = passOrder[1] || 'balance';
    bringToFront(next);
  };

  const getPassMeta = (id: PassId) => {
    if (id === 'balance') {
      return {
        label: 'Net Balance Pass',
        badge: netPositive
          ? `Net ${capabilities.lenaLabel}`
          : netNegative
            ? `Net ${capabilities.denaLabel}`
            : 'Settled',
        surfaceClass: 'ios27-pass-obsidian',
      };
    }
    if (id === 'collection') {
      return {
        label: 'Due & Recovery Pass',
        badge: overdueCount > 0 ? `${overdueCount} Overdue` : 'All Clear',
        surfaceClass: 'ios27-pass-indigo',
      };
    }
    return {
      label: capabilities.showGalla ? 'Daily Cashbook Pass' : 'Ledger Health Pass',
      badge: capabilities.showGalla
        ? `${formatINR(gallaPulse.cashDrawerBalance)}`
        : `${partyCount} Parties`,
      surfaceClass: 'ios27-pass-emerald',
    };
  };

  return (
    <motion.section
      aria-label="Total Balance Hero"
      style={
        prefersReducedMotion
          ? undefined
          : {
              opacity: heroOpacity,
              scale: heroScale,
              y: heroY,
              transformPerspective: 1100,
            }
      }
      className="space-y-2.5 will-change-transform origin-top"
    >
      {/* Wallet Deck Header Strip */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-muted)]">
          <span className="font-extrabold text-[var(--ink)]">Passes</span>
          <span aria-hidden="true">·</span>
          <span className="text-[var(--brand-accent)]">{getPassMeta(frontPass).label}</span>
        </div>

        {/* 1-Tap Direct Pass Switcher (Zero height jump, stable Apple Wallet tabs) */}
        <div className="flex items-center gap-1 bg-[var(--surface-subtle)] p-0.5 rounded-full border border-[var(--surface-border)]">
          {(['balance', 'collection', 'cashbook'] as PassId[]).map((pid) => {
            const active = frontPass === pid;
            const shortLabel = pid === 'balance' ? 'Net' : pid === 'collection' ? 'Due' : 'Cash';
            return (
              <button
                key={pid}
                type="button"
                onClick={() => bringToFront(pid)}
                className={`min-h-[26px] px-2.5 rounded-full text-[10px] font-extrabold transition-all active:scale-95 ${
                  active
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                <span>{shortLabel}</span>
                {pid === 'collection' && overdueCount > 0 ? (
                  <span className="ml-1 px-1 py-0.2 rounded-full bg-[var(--credit-tint)] text-[var(--credit-red)] text-[9px] font-bold">
                    {overdueCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive 3D Card Stack (Apple Wallet Presentation) */}
      <div
        className="relative"
        style={{
          perspective: 1100,
          minHeight: breakdownOpen && frontPass === 'balance' ? 316 : 232,
          transition: 'min-height 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {passOrder.map((id, stackPos) => {
          const isFront = stackPos === 0;
          const meta = getPassMeta(id);
          const showBody = isFront;

          // In stacked mode: Back cards peek 28px crisply above the front card (Apple Wallet style)
          const targetY = (2 - stackPos) * 28;
          const targetScale = 1 - stackPos * 0.04;
          const targetRotateX = isFront ? 0 : -4;
          const zIndex = 30 - stackPos * 10;

          return (
            <motion.div
              key={id}
              layout
              initial={false}
              animate={{
                y: targetY,
                scale: targetScale,
                rotateX: prefersReducedMotion ? 0 : targetRotateX,
              }}
              transition={STACK_SPRING}
              drag={isFront && !prefersReducedMotion ? 'y' : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                dragY.set(0);
                if (Math.abs(info.offset.y) > 40 || Math.abs(info.velocity.y) > 280) {
                  cycleNextPass();
                }
              }}
              onPointerMove={isFront ? handlePointerMove : undefined}
              onPointerLeave={isFront ? resetTilt : undefined}
              onPointerCancel={isFront ? resetTilt : undefined}
              onClick={() => {
                if (!isFront) {
                  bringToFront(id);
                } else if (id === 'balance') {
                  haptics.tap();
                  setBreakdownOpen((v) => !v);
                }
              }}
              style={{
                zIndex,
                ...(isFront && !prefersReducedMotion
                  ? { y: dragY, scale: dragScale, rotateX, rotateY }
                  : {}),
                transformOrigin: 'top center',
              }}
              className={`absolute inset-x-0 top-0 min-h-[164px] rounded-[28px] ${meta.surfaceClass} px-4 pt-2.5 pb-3.5 cursor-pointer select-none will-change-transform overflow-hidden shadow-lg`}
            >
              {/* Wallet Peeking Top Header Strip (Always visible even when tucked behind) */}
              <div className="flex items-center justify-between gap-2 pb-1.5 leading-none">
                <span className="text-[11px] font-bold tracking-wide text-white/85 uppercase truncate">
                  {meta.label}
                </span>
                <span className="text-[11px] font-extrabold font-tabular text-white shrink-0">
                  {meta.badge}
                </span>
              </div>

              {/* Pass Body Content (Only mounted on active front card or when Deck is Fanned) */}
              {showBody && id === 'balance' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-[24px] sm:text-[32px] font-extrabold leading-none tracking-tight text-white whitespace-nowrap truncate max-w-full">
                          <OdometerNumber
                            value={Math.abs(cashflow.netCashflow)}
                            hidden={hideBalance}
                            prefix={netNegative ? '-' : ''}
                            compact
                          />
                        </p>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          transition={FAST_SPRING}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.tap();
                            onToggleHideBalance();
                          }}
                          aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
                          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/90 shrink-0 transition"
                        >
                          {hideBalance ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-semibold text-white/75 font-tabular">
                        <span className="shrink-0">
                          {partyCount} {partyCount === 1 ? 'account' : 'accounts'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.tap();
                            setBreakdownOpen((v) => !v);
                          }}
                          aria-expanded={breakdownOpen}
                          aria-label={
                            breakdownOpen
                              ? 'Collapse balance breakdown'
                              : 'Expand balance breakdown'
                          }
                          className="inline-flex items-center gap-0.5 text-white font-bold underline-offset-2 hover:underline shrink-0"
                        >
                          <span>{breakdownOpen ? 'Less' : 'Details'}</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${
                              breakdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[10px] font-medium text-white/60 truncate">
                        {personaAdaptation.heroCaption}
                      </p>
                    </div>

                    {/* Listen Summary Tactile Button */}
                    <motion.button
                      whileTap={{ scale: 0.92, y: 1 }}
                      transition={FAST_SPRING}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        haptics.tap();
                        onOpenDailySummary();
                      }}
                      aria-label="Listen Summary"
                      className="shrink-0 flex flex-col items-center gap-1"
                    >
                      <span
                        style={{ backgroundColor: 'var(--brand)' }}
                        className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg"
                      >
                        <Volume2 className="w-5 h-5 stroke-[2.2]" />
                      </span>
                      <span className="text-[10px] font-bold text-white/90 leading-none">
                        Listen
                      </span>
                    </motion.button>
                  </div>

                  {/* Animated Receivable / Payable Ratio Rail */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
                      {cashflow.totalReceivable === 0 && cashflow.totalPayable === 0 ? (
                        <div className="h-full w-full rounded-full bg-white/20" />
                      ) : (
                        <motion.div
                          initial={{ width: '50%' }}
                          animate={{ width: `${cashflow.receivableSharePct}%` }}
                          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                          className="h-full rounded-full bg-[#22C55E]"
                        />
                      )}
                    </div>
                  </div>

                  {/* Inline Expandable Breakdown Drawer */}
                  <AnimatePresence initial={false}>
                    {breakdownOpen && isFront && (
                      <motion.div
                        key="wallet-balance-breakdown"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{
                          height: 0,
                          opacity: 0,
                          transition: { duration: 0.16, ease: 'easeOut' },
                        }}
                        transition={STACK_SPRING}
                        onClick={(e) => e.stopPropagation()}
                        className="overflow-hidden"
                      >
                        <div
                          className={`grid gap-2 pt-2 border-t border-white/10 ${
                            capabilities.showGalla ? 'grid-cols-3' : 'grid-cols-2'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              onSelectSegment('customer');
                            }}
                            className="text-left rounded-2xl bg-white/8 px-2.5 py-2 active:scale-95 transition"
                          >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4ADE80]">
                              <ArrowDown className="w-3 h-3" />
                              <span>{capabilities.lenaLabel}</span>
                              {segment === 'customer' && !hasSecondaryFilter && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                              )}
                            </span>
                            <p className="font-display text-sm font-extrabold text-white mt-0.5 font-tabular">
                              {hideBalance ? '₹••••' : formatINR(cashflow.totalReceivable)}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              onSelectSegment(capabilities.showSuppliers ? 'supplier' : 'customer');
                            }}
                            className="text-left rounded-2xl bg-white/8 px-2.5 py-2 active:scale-95 transition"
                          >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#F87171]">
                              <ArrowUp className="w-3 h-3" />
                              <span>{capabilities.denaLabel}</span>
                              {capabilities.showSuppliers &&
                                segment === 'supplier' &&
                                !hasSecondaryFilter && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                                )}
                            </span>
                            <p className="font-display text-sm font-extrabold text-white mt-0.5 font-tabular">
                              {hideBalance ? '₹••••' : formatINR(cashflow.totalPayable)}
                            </p>
                          </button>

                          {capabilities.showGalla && (
                            <button
                              type="button"
                              onClick={() => {
                                haptics.tap();
                                onSelectSegment('galla');
                              }}
                              className="text-left rounded-2xl bg-white/8 px-2.5 py-2 active:scale-95 transition"
                            >
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#A5B4FC]">
                                <Wallet className="w-3 h-3" />
                                <span>{capabilities.gallaSegmentLabel || 'Cashbook'}</span>
                              </span>
                              <p className="font-display text-sm font-extrabold text-white mt-0.5 font-tabular">
                                {hideBalance ? '₹••••' : formatINR(gallaPulse.cashDrawerBalance)}
                              </p>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {showBody && id === 'collection' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-extrabold text-white font-tabular">
                        {overdueCount === 0
                          ? 'Zero Overdue'
                          : `${overdueCount} Priority ${overdueCount === 1 ? 'Due' : 'Dues'}`}
                      </p>
                      <p className="text-[11px] font-semibold text-white/80">
                        {topDueParties.length > 0
                          ? `Top: ${topDueParties[0].account.name} (${formatINR(topDueParties[0].account.balance)})`
                          : 'Tap Open Recovery to schedule payment reminders'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        haptics.tap();
                        onOpenCollection();
                      }}
                      className="min-h-[38px] px-3.5 rounded-full bg-white text-[#3730A3] text-xs font-extrabold inline-flex items-center gap-1 shrink-0 active:scale-95 transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Collect</span>
                    </button>
                  </div>

                  {topDueParties.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {topDueParties.slice(0, 2).map((spot) => (
                        <div
                          key={spot.account.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.tap();
                            onSelectAccount(spot.account);
                          }}
                          className="rounded-2xl bg-white/12 px-2.5 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              style={{ backgroundColor: getAvatarColor(spot.account.name) }}
                              className="w-7 h-7 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0"
                            >
                              {spot.account.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-extrabold text-white truncate">
                                {spot.account.name}
                              </p>
                              <p className="text-[10px] font-tabular text-white/80">
                                {hideBalance ? '₹••••' : formatINR(spot.account.balance)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              haptics.tap();
                              onQuickCollect(spot.account, 'received');
                            }}
                            aria-label={`Collect from ${spot.account.name}`}
                            className="w-7 h-7 rounded-full bg-white/20 text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showBody && id === 'cashbook' && (
                <div className="space-y-3 pt-1">
                  {capabilities.showGalla ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl font-extrabold text-white font-tabular">
                          {hideBalance ? '₹••••' : formatINR(gallaPulse.cashDrawerBalance)}
                        </p>
                        <p className="text-[11px] font-semibold text-white/80 font-tabular">
                          In {formatINR(gallaPulse.todayInflow)} · Out {formatINR(gallaPulse.todayOutflow)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          haptics.tap();
                          onOpenGalla();
                        }}
                        className="min-h-[38px] px-3.5 rounded-full bg-white text-[#065F46] text-xs font-extrabold inline-flex items-center gap-1 shrink-0 active:scale-95 transition"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Open Cash</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-extrabold text-white">
                          Personal Vault Active
                        </p>
                        <p className="text-[11px] font-semibold text-white/80">
                          {partyCount} contacts · Stored cleanly on your device
                        </p>
                      </div>
                      <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white">
                        <ShieldCheck className="w-5 h-5" />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Interactive Pass Selector Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5">
        {(['balance', 'collection', 'cashbook'] as PassId[]).map((pid) => {
          const active = frontPass === pid;
          return (
            <button
              key={pid}
              type="button"
              onClick={() => bringToFront(pid)}
              aria-label={`Show ${getPassMeta(pid).label}`}
              className={`h-1.5 rounded-full transition-all ${
                active ? 'w-5 bg-[var(--brand)]' : 'w-1.5 bg-[var(--surface-border)]'
              }`}
            />
          );
        })}
      </div>
    </motion.section>
  );
};
