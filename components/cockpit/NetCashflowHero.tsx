'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'framer-motion';
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

/**
 * Ultra-Compact Matte Total Balance Hero (`rounded-[24px]`, diffused spatial shadow).
 * Default collapsed view renders ONLY: bold Net Balance (`OdometerNumber`), Privacy Eye toggle,
 * compact `Net Lena` / `Net Dena` pill, and Royal Indigo `Munim Sunao` button.
 * Tapping the Hero expands an inline Framer Motion drawer revealing Lena/Dena/Galla breakdown & Top 3 Due Today.
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

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;

  const toggleExpand = () => {
    haptics.tap();
    setHeroExpanded((v) => !v);
  };

  return (
    <motion.section
      layout
      transition={HERO_LAYOUT_SPRING}
      aria-label="Total Balance Hero"
      style={
        prefersReducedMotion
          ? undefined
          : {
              opacity: heroOpacity,
              scale: heroScale,
              y: heroY,
            }
      }
      onClick={toggleExpand}
      className="rounded-[24px] spatial-hero p-4 space-y-3 relative will-change-transform origin-top cursor-pointer"
    >
      {/* Ultra-Compact Default Row: Net Balance + Eye + Net Pill on Left | Matte Munim Sunao on Right */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
              Total Balance
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
              aria-expanded={heroExpanded}
              aria-label={heroExpanded ? 'Collapse balance breakdown' : 'Expand balance breakdown'}
              className={`min-h-[24px] px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-0.5 active:scale-95 transition ${
                netPositive
                  ? 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                  : netNegative
                    ? 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                    : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
              }`}
            >
              <span>
                {netPositive
                  ? `Net ${capabilities.lenaLabel}`
                  : netNegative
                    ? `Net ${capabilities.denaLabel}`
                    : 'Due'}
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

          <div className="flex items-center gap-2">
            <p
              className={`font-display text-[32px] font-extrabold leading-none tracking-tight ${
                netPositive
                  ? 'text-[var(--debit-green)]'
                  : netNegative
                    ? 'text-[var(--credit-red)]'
                    : 'text-[var(--ink)]'
              }`}
            >
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
              className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] shrink-0"
            >
              {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Matte Royal Indigo 'Munim Sunao' Button */}
        <motion.button
          whileTap={{ scale: 0.92, y: 1 }}
          transition={SPRING_FAST}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.tap();
            onOpenDailySummary();
          }}
          aria-label="Munim Sunao"
          className="shrink-0 flex flex-col items-center gap-1 focus:outline-none"
        >
          <span
            style={{ backgroundColor: 'var(--brand)' }}
            className="tactile-key-primary relative w-13 h-13 rounded-full text-white flex items-center justify-center"
          >
            <Volume2 className="w-5 h-5 stroke-[2.3]" />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#16A34A] ring-2 ring-[var(--surface)] flex items-center justify-center"
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
          <span className="text-[10px] font-extrabold text-[var(--brand-accent)] leading-none">
            Munim Sunao
          </span>
        </motion.button>
      </div>

      {/* Expanded Inline Breakdown Drawer: Lena vs Dena + Ratio Bar + Top 3 Due Today */}
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
            <div className="pt-2.5 border-t border-[var(--surface-subtle)] space-y-3">
              <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                {partyCount} {partyCount === 1 ? 'party' : 'parties'} · {personaAdaptation.heroCaption}
              </p>

              {/* Lena vs Dena Ratio Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-[var(--credit-tint)] overflow-hidden relative">
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${cashflow.receivableSharePct}%` }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    className="h-full rounded-full bg-[var(--debit-green)]"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)] font-tabular">
                  <span>
                    {capabilities.lenaLabel} {cashflow.receivableSharePct}%
                  </span>
                  <span>
                    {capabilities.denaLabel} {cashflow.payableSharePct}%
                  </span>
                </div>
              </div>

              {/* Lena / Dena / Galla Metric Grid */}
              <div
                className={`grid gap-3 ${capabilities.showGalla ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING_FAST}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onSelectSegment('customer');
                  }}
                  className="text-left space-y-0.5 rounded-xl px-1.5 py-1 bg-[var(--app-bg)] focus:outline-none"
                >
                  <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--debit-green)] whitespace-nowrap">
                    <ArrowDown className="w-3 h-3 shrink-0" />
                    <span>{capabilities.lenaLabel} ₹</span>
                    {segment === 'customer' && !hasSecondaryFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--debit-green)]" />
                    )}
                  </div>
                  <p className="font-display text-sm font-extrabold text-[var(--debit-green)] truncate">
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
                  className="text-left space-y-0.5 rounded-xl px-1.5 py-1 bg-[var(--app-bg)] focus:outline-none"
                >
                  <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--credit-red)] whitespace-nowrap">
                    <ArrowUp className="w-3 h-3 shrink-0" />
                    <span>{capabilities.denaLabel} ₹</span>
                    {capabilities.showSuppliers && segment === 'supplier' && !hasSecondaryFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--credit-red)]" />
                    )}
                  </div>
                  <p className="font-display text-sm font-extrabold text-[var(--credit-red)] truncate">
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
                    className="text-left space-y-0.5 rounded-xl px-1.5 py-1 bg-[var(--app-bg)] focus:outline-none"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--brand-accent)] whitespace-nowrap">
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span>{capabilities.gallaSegmentLabel || 'Galla'} ₹</span>
                      {segment === 'galla' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
                      )}
                    </div>
                    <p className="font-display text-sm font-extrabold text-[var(--brand-accent)] truncate">
                      <OdometerNumber value={gallaBalance} hidden={hideBalance} />
                    </p>
                  </motion.button>
                )}
              </div>

              {/* Top 3 Due Today */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
                    Top 3 Due Today
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenCollection();
                    }}
                    className="text-[11px] font-extrabold text-[var(--brand-accent)] hover:underline"
                  >
                    Open {capabilities.leftDockLabel}
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
                        className="rounded-2xl bg-[var(--app-bg)] px-3 py-2 flex items-center justify-between gap-2.5"
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
                            onClick={() => {
                              haptics.tap();
                              onQuickCollect(spot.account, 'received');
                            }}
                            aria-label={`Collect from ${spot.account.name}`}
                            className="min-h-[32px] px-2.5 rounded-xl bg-[var(--debit-tint)] text-[var(--debit-green)] text-[11px] font-extrabold active:scale-95 transition"
                          >
                            + ₹
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};
