'use client';

import React, { useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Volume2, Wallet } from 'lucide-react';
import { formatINR, getAvatarColor } from '@/lib/i18n';
import type { PersonaAdaptation, PersonaCapabilities } from '@/lib/persona';
import type { DuePartySpotlight, NetCashflowSummary } from '@/lib/ucred-intelligence';
import type { LedgerAccount, TxDirection } from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';

export type CashKhataSegment = 'customer' | 'supplier' | 'galla';

export interface NetCashflowHeroProps {
  cashflow: NetCashflowSummary;
  gallaBalance: number;
  partyCount: number;
  hideBalance: boolean;
  segment: CashKhataSegment;
  hasSecondaryFilter: boolean;
  capabilities: PersonaCapabilities;
  personaAdaptation: PersonaAdaptation;
  topDueParties: DuePartySpotlight[];
  heroOpacity?: MotionValue<number>;
  heroScale?: MotionValue<number>;
  heroY?: MotionValue<number>;
  onToggleHideBalance: () => void;
  onSelectSegment: (segment: CashKhataSegment) => void;
  onOpenDailySummary: () => void;
  onOpenCollection: () => void;
  onSelectAccount: (account: LedgerAccount) => void;
  onQuickCollect: (account: LedgerAccount, direction: TxDirection) => void;
}

const SPRING_FAST = { type: 'spring' as const, stiffness: 460, damping: 26 };
const HERO_LAYOUT_SPRING = { type: 'spring' as const, stiffness: 360, damping: 30 };
const TILT_SPRING = { stiffness: 260, damping: 24, mass: 0.6 };

/**
 * iOS 27 Obsidian Matte Flagship Balance Card:
 * - Matte Obsidian finish (`#11131A` light / `#1C1C1E` OLED dark) with subtle micro-tilt response (`±2°`)
 * - Crisp `OdometerNumber` net balance + Privacy Eye + `Net Receivable`/`Net Payable` pill + Audio `Listen` button
 * - Inline Framer Motion expandable breakdown drawer (`Receivable`, `Payable`, `Cashbook`, `Top 3 Due Today`)
 */
export const NetCashflowHero: React.FC<NetCashflowHeroProps> = ({
  cashflow,
  gallaBalance,
  partyCount,
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
  onSelectAccount,
  onQuickCollect,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [heroExpanded, setHeroExpanded] = useState(false);

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;

  const toggleExpand = () => {
    haptics.tap();
    setHeroExpanded((v) => !v);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rawRotateY.set(Math.max(-2.2, Math.min(2.2, nx * 4.4)));
    rawRotateX.set(Math.max(-2.2, Math.min(2.2, -ny * 4.4)));
  };

  const resetTilt = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return (
    <motion.section
      layout
      transition={HERO_LAYOUT_SPRING}
      aria-label="Total Balance Hero"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
      style={
        prefersReducedMotion
          ? undefined
          : {
              opacity: heroOpacity,
              scale: heroScale,
              y: heroY,
              rotateX,
              rotateY,
              transformPerspective: 900,
            }
      }
      onClick={toggleExpand}
      className="rounded-[26px] ios-obsidian-hero p-4.5 space-y-3 relative will-change-transform origin-top cursor-pointer overflow-hidden"
    >
      {/* Default Collapsed Flagship Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Net Balance
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
              aria-expanded={heroExpanded}
              aria-label={heroExpanded ? 'Collapse balance breakdown' : 'Expand balance breakdown'}
              className={`min-h-[24px] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-0.5 active:scale-95 transition ${
                netPositive
                  ? 'bg-[#052E16] text-[#4ADE80]'
                  : netNegative
                    ? 'bg-[#450A0A] text-[#F87171]'
                    : 'bg-white/10 text-slate-200'
              }`}
            >
              <span>
                {netPositive
                  ? `Net ${capabilities.lenaLabel}`
                  : netNegative
                    ? `Net ${capabilities.denaLabel}`
                    : 'Settled'}
              </span>
              <motion.span
                animate={{ rotate: heroExpanded ? 180 : 0 }}
                transition={SPRING_FAST}
                className="inline-flex"
              >
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <p className="font-display text-[34px] font-extrabold leading-none tracking-tight text-white">
              <OdometerNumber
                value={Math.abs(cashflow.netCashflow)}
                hidden={hideBalance}
                prefix={netNegative ? '-' : ''}
              />
            </p>
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={SPRING_FAST}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptics.tap();
                onToggleHideBalance();
              }}
              aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 shrink-0 transition"
            >
              {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Clean Listen Summary Audio Button */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1 }}
          transition={SPRING_FAST}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.tap();
            onOpenDailySummary();
          }}
          aria-label="Listen Summary"
          className="shrink-0 flex flex-col items-center gap-1.5 focus:outline-none"
        >
          <span
            style={{ backgroundColor: 'var(--brand)' }}
            className="tactile-key-primary relative w-12 h-12 rounded-full text-white flex items-center justify-center"
          >
            <Volume2 className="w-5 h-5 stroke-[2.3]" />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#16A34A] ring-2 ring-[#11131A] flex items-center justify-center"
            >
              <span className="flex items-end gap-[1.5px] h-2">
                <span className="eq-bar w-[2px] h-2 rounded-full bg-white" />
                <span
                  style={{ animationDelay: '0.18s' }}
                  className="eq-bar w-[2px] h-2 rounded-full bg-white"
                />
              </span>
            </span>
          </span>
          <span className="text-[10px] font-extrabold text-slate-200 leading-none">
            Listen
          </span>
        </motion.button>
      </div>

      {/* Subtle Sleek Live Ratio Flow Strip */}
      <div className="h-1 w-full rounded-full bg-[#450A0A] overflow-hidden">
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${cashflow.receivableSharePct}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="h-full rounded-full bg-[#22C55E]"
        />
      </div>

      {/* Expanded Inline Breakdown Drawer */}
      <AnimatePresence initial={false}>
        {heroExpanded && (
          <motion.div
            key="hero-breakdown-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            transition={HERO_LAYOUT_SPRING}
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden cursor-default"
          >
            <div className="pt-2.5 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 font-tabular">
                <span className="truncate">
                  {partyCount} {partyCount === 1 ? 'account' : 'accounts'} · {personaAdaptation.heroCaption}
                </span>
                <span className="shrink-0 ml-2">
                  {cashflow.receivableSharePct}% / {cashflow.payableSharePct}%
                </span>
              </div>

              {/* Receivable / Payable / Cashbook Grid */}
              <div
                className={`grid gap-2.5 ${capabilities.showGalla ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onSelectSegment('customer');
                  }}
                  className="text-left space-y-0.5 rounded-2xl px-2.5 py-2 bg-white/10 focus:outline-none"
                >
                  <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#4ADE80] whitespace-nowrap">
                    <ArrowDown className="w-3 h-3 shrink-0" />
                    <span>{capabilities.lenaLabel}</span>
                    {segment === 'customer' && !hasSecondaryFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                    )}
                  </div>
                  <p className="font-display text-sm font-extrabold text-white truncate">
                    <OdometerNumber value={cashflow.totalReceivable} hidden={hideBalance} />
                  </p>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    if (capabilities.showSuppliers) {
                      onSelectSegment('supplier');
                    } else {
                      onSelectSegment('customer');
                    }
                  }}
                  className="text-left space-y-0.5 rounded-2xl px-2.5 py-2 bg-white/10 focus:outline-none"
                >
                  <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#F87171] whitespace-nowrap">
                    <ArrowUp className="w-3 h-3 shrink-0" />
                    <span>{capabilities.denaLabel}</span>
                    {capabilities.showSuppliers && segment === 'supplier' && !hasSecondaryFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                    )}
                  </div>
                  <p className="font-display text-sm font-extrabold text-white truncate">
                    <OdometerNumber value={cashflow.totalPayable} hidden={hideBalance} />
                  </p>
                </motion.button>

                {capabilities.showGalla && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING_FAST}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onSelectSegment('galla');
                    }}
                    className="text-left space-y-0.5 rounded-2xl px-2.5 py-2 bg-white/10 focus:outline-none"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#A5B4FC] whitespace-nowrap">
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span>{capabilities.gallaSegmentLabel || 'Cashbook'}</span>
                      {segment === 'galla' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A5B4FC]" />
                      )}
                    </div>
                    <p className="font-display text-sm font-extrabold text-white truncate">
                      <OdometerNumber value={gallaBalance} hidden={hideBalance} />
                    </p>
                  </motion.button>
                )}
              </div>

              {/* Top 3 Due Today */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                    Top 3 Due Today
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenCollection();
                    }}
                    className="text-[11px] font-extrabold text-[#A5B4FC] hover:underline"
                  >
                    Open {capabilities.leftDockLabel}
                  </button>
                </div>

                {topDueParties.length === 0 ? (
                  <div className="rounded-2xl bg-white/10 p-3 text-xs font-semibold text-slate-200 text-center">
                    Zero overdue accounts right now.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {topDueParties.map((spot) => (
                      <div
                        key={spot.account.id}
                        className="rounded-2xl bg-white/10 px-3 py-2 flex items-center justify-between gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            haptics.tap();
                            onSelectAccount(spot.account);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span
                            style={{ backgroundColor: getAvatarColor(spot.account.name) }}
                            className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                          >
                            {spot.account.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-white truncate">
                              {spot.account.name}
                            </p>
                            <p
                              className={`text-[10px] font-bold truncate ${
                                spot.isDueTodayOrOverdue ? 'text-[#FCA5A5]' : 'text-slate-300'
                              }`}
                            >
                              {spot.urgencyLabel} · Score {spot.trustScore}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold font-tabular text-[#FCA5A5]">
                            {hideBalance ? '₹••••' : formatINR(spot.account.balance)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              onQuickCollect(spot.account, 'received');
                            }}
                            aria-label={`Collect from ${spot.account.name}`}
                            className="min-h-[32px] px-2.5 rounded-xl bg-[#052E16] text-[#4ADE80] text-[11px] font-extrabold active:scale-95 transition"
                          >
                            + ₹
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-slate-400">
                  Trust indicators are private internal bookkeeping metrics only.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};
