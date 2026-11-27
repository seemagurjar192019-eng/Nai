'use client';

import React, { useRef } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'framer-motion';
import { ArrowDown, ArrowUp, Eye, EyeOff, Volume2, Wallet } from 'lucide-react';
import { formatINRCompact } from '@/lib/i18n';
import type { PersonaAdaptation, PersonaCapabilities } from '@/lib/persona';
import type { NetCashflowSummary } from '@/lib/ucred-intelligence';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from './OdometerNumber';
import { SNAPPY_SPRING, SPATIAL_SPRING } from './SpatialMotionEngine';

export interface HeroBalanceCardProps {
  cashflow: NetCashflowSummary;
  partyCount: number;
  cashDrawerBalance?: number;
  todayInflow?: number;
  todayOutflow?: number;
  weeklyVelocity?: number[];
  hideBalance: boolean;
  capabilities: PersonaCapabilities;
  personaAdaptation: PersonaAdaptation;
  heroOpacity?: MotionValue<number>;
  heroScale?: MotionValue<number>;
  heroY?: MotionValue<number>;
  onToggleHideBalance: () => void;
  onOpenDailySummary: () => void;
  onSelectReceivable?: () => void;
  onSelectPayable?: () => void;
  onSelectGalla?: () => void;
}

const TILT_SPRING = { stiffness: 320, damping: 25, mass: 0.6 };

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  cashflow,
  partyCount,
  cashDrawerBalance,
  todayInflow = 0,
  todayOutflow = 0,
  weeklyVelocity,
  hideBalance,
  capabilities,
  personaAdaptation,
  heroOpacity,
  heroScale,
  heroY,
  onToggleHideBalance,
  onOpenDailySummary,
  onSelectReceivable,
  onSelectPayable,
  onSelectGalla,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Apple Card Gyro-Tilt & Specular Sheen Physics
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rawSheenOpacity = useMotionValue(0);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(50);

  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);
  const sheenOpacity = useSpring(rawSheenOpacity, TILT_SPRING);

  const sheenBg = useMotionTemplate`radial-gradient(circle 280px at ${sheenX}% ${sheenY}%, rgba(255, 255, 255, 0.45) 0%, transparent 68%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (y / rect.height) * 100));
    const tiltX = ((x - rect.width / 2) / (rect.width / 2)) * 4.5;
    const tiltY = ((y - rect.height / 2) / (rect.height / 2)) * 4.5;

    rawRotateX.set(-tiltY);
    rawRotateY.set(tiltX);
    sheenX.set(pctX);
    sheenY.set(pctY);
    rawSheenOpacity.set(1);
  };

  const handlePointerLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    rawSheenOpacity.set(0);
  };

  const netPositive = cashflow.netCashflow > 0;
  const netNegative = cashflow.netCashflow < 0;
  const totalVolume = cashflow.totalReceivable + cashflow.totalPayable;
  const hasVolume = totalVolume > 0;
  const receivableRatio = hasVolume
    ? Math.max(0.04, Math.min(0.96, cashflow.totalReceivable / totalVolume))
    : 0.5;

  const statusDirectionLabel = netPositive
    ? `Net ${capabilities.lenaLabel}`
    : netNegative
      ? `Net ${capabilities.denaLabel}`
      : 'All Settled';

  const hasTodayFlow = todayInflow > 0 || todayOutflow > 0;
  const showCashColumn = capabilities.showGalla && cashDrawerBalance !== undefined;
  const footerCols =
    capabilities.showSuppliers && showCashColumn
      ? 'grid-cols-3'
      : capabilities.showSuppliers || showCashColumn
        ? 'grid-cols-2'
        : 'grid-cols-1';

  const absNet = Math.abs(cashflow.netCashflow);
  const numDigits = Math.round(absNet).toString().length;
  const balanceFontSize =
    numDigits >= 9
      ? 'text-[24px] sm:text-[28px]'
      : numDigits >= 7
        ? 'text-[28px] sm:text-[34px]'
        : numDigits >= 6
          ? 'text-[32px] sm:text-[38px]'
          : 'text-[38px] sm:text-[44px]';

  return (
    <motion.section
      ref={cardRef}
      aria-label="Net Balance Overview"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      style={
        prefersReducedMotion
          ? undefined
          : {
              opacity: heroOpacity,
              scale: heroScale,
              y: heroY,
              rotateX,
              rotateY,
              perspective: 1000,
            }
      }
      className="liquid-wallet-card relative rounded-[24px] p-4 sm:p-5 space-y-3 sm:space-y-3.5 will-change-transform origin-top select-none overflow-hidden"
    >
      {/* Apple Specular Sheen Layer (GPU Compositor) */}
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          style={{
            opacity: sheenOpacity,
            background: sheenBg,
          }}
          className="pointer-events-none absolute inset-0 z-0 will-change-transform dark:opacity-30"
        />
      )}

      {/* Top Row: Clean Apple Kicker + Monochrome Privacy Eye & Listen Pill */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
            <span className="text-[var(--ink)] font-semibold truncate">{statusDirectionLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-tabular tracking-normal shrink-0">
              {partyCount} {partyCount === 1 ? 'Party' : 'Parties'}
            </span>
          </div>
          <p className="text-[11px] font-normal text-[var(--ink-muted)] truncate mt-0.5">
            {personaAdaptation.focusBadge} Ledger
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={SNAPPY_SPRING}
            type="button"
            onClick={() => {
              haptics.tap();
              onToggleHideBalance();
            }}
            aria-label={hideBalance ? 'Show balances' : 'Hide balances'}
            className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--ink)] transition hover:bg-[var(--brand-tint)]"
          >
            {hideBalance ? (
              <EyeOff className="w-4 h-4 stroke-[1.8]" />
            ) : (
              <Eye className="w-4 h-4 stroke-[1.8]" />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={SNAPPY_SPRING}
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenDailySummary();
            }}
            aria-label="Listen Summary"
            className="min-h-[40px] px-3.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition hover:bg-[var(--brand-tint)]"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0 stroke-[1.9]" />
            <span>Listen</span>
          </motion.button>
        </div>
      </div>

      {/* Center Display: Tabular Net Balance + Today's Delta + Segmented Ratio Meter */}
      <div className="relative z-10 space-y-3">
        <div className="flex items-baseline justify-between gap-2 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className={`font-display ${balanceFontSize} font-bold leading-none tracking-[-0.035em] text-[var(--ink)] whitespace-nowrap truncate`}>
              <OdometerNumber
                value={absNet}
                hidden={hideBalance}
                prefix={netNegative ? '-' : ''}
                compact={absNet >= 10000000}
              />
            </p>
          </div>

          <p className="text-[11.5px] font-medium font-tabular text-[var(--ink-muted)] shrink-0 whitespace-nowrap">
            {hideBalance ? (
              'Private mode'
            ) : hasTodayFlow ? (
              <>
                Today{' '}
                <span className="text-[var(--debit-green)] font-semibold">
                  +{formatINRCompact(todayInflow)}
                </span>
                {' · '}
                <span className="text-[var(--credit-red)] font-semibold">
                  -{formatINRCompact(todayOutflow)}
                </span>
              </>
            ) : (
              'Encrypted · Ready'
            )}
          </p>
        </div>

        {/* Crisp 5px Segmented Ratio Bar */}
        <div className="h-[5px] w-full rounded-full bg-[var(--ink)]/[0.07] overflow-hidden flex">
          {!hasVolume ? (
            <div className="h-full w-full rounded-full bg-[var(--ink)]/[0.06]" />
          ) : (
            <>
              <motion.div
                initial={false}
                animate={{ scaleX: receivableRatio }}
                transition={SPATIAL_SPRING}
                style={{ width: `${receivableRatio * 100}%` }}
                className="h-full origin-left bg-[var(--debit-green)]/85 will-change-transform"
              />
              {cashflow.totalPayable > 0 && (
                <div className="h-full flex-1 bg-[var(--credit-red)]/80" />
              )}
            </>
          )}
        </div>

        {/* 7-Day Cashflow Velocity Sparkline (Live Computed) */}
        <div className="pt-1 flex items-center justify-between gap-1.5 text-[10px] text-[var(--ink-muted)] font-tabular">
          <span>7d Cash Velocity</span>
          <div className="flex items-end gap-1 h-4">
            {(weeklyVelocity && weeklyVelocity.length === 7
              ? weeklyVelocity
              : [0, 0, 0, 0, 0, 0, 0]
            ).map((val, idx) => (
              <div
                key={idx}
                style={{ height: `${val > 0 ? Math.max(6, Math.round(val * 0.16)) : 4}px` }}
                className={`w-1.5 rounded-full transition-all ${
                  val > 0
                    ? idx === 6
                      ? 'bg-[var(--brand)]'
                      : 'bg-[var(--ink)]/30'
                    : 'bg-[var(--ink)]/[0.10]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Split Metric Cells separated by crisp vertical hairline dividers */}
      <div
        className={`relative z-10 grid ${footerCols} divide-x divide-[var(--glass-border)] pt-3 border-t border-[var(--glass-border)] font-tabular`}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={SNAPPY_SPRING}
          type="button"
          onClick={() => {
            haptics.select();
            onSelectReceivable?.();
          }}
          className="min-h-[44px] pr-2 py-0.5 text-left hover:opacity-80 transition min-w-0"
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] max-w-full">
            <ArrowDown className="w-3 h-3 shrink-0" />
            <span className="truncate">{capabilities.lenaLabel}</span>
          </span>
          <p className="font-display text-[15px] sm:text-base font-semibold text-[var(--debit-green)] truncate mt-0.5 whitespace-nowrap">
            {hideBalance ? '₹••••' : formatINRCompact(cashflow.totalReceivable)}
          </p>
        </motion.button>

        {capabilities.showSuppliers && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={SNAPPY_SPRING}
            type="button"
            onClick={() => {
              haptics.select();
              onSelectPayable?.();
            }}
            className="min-h-[44px] px-2.5 py-0.5 text-left hover:opacity-80 transition min-w-0"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] max-w-full">
              <ArrowUp className="w-3 h-3 shrink-0" />
              <span className="truncate">{capabilities.denaLabel}</span>
            </span>
            <p className="font-display text-[15px] sm:text-base font-semibold text-[var(--credit-red)] truncate mt-0.5 whitespace-nowrap">
              {hideBalance ? '₹••••' : formatINRCompact(cashflow.totalPayable)}
            </p>
          </motion.button>
        )}

        {showCashColumn && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={SNAPPY_SPRING}
            type="button"
            onClick={() => {
              haptics.select();
              onSelectGalla?.();
            }}
            className="min-h-[44px] pl-2.5 py-0.5 text-left hover:opacity-80 transition min-w-0"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] max-w-full">
              <Wallet className="w-3 h-3 shrink-0" />
              <span className="truncate">Cash Drawer</span>
            </span>
            <p className="font-display text-[15px] sm:text-base font-semibold text-[var(--ink)] truncate mt-0.5 whitespace-nowrap">
              {hideBalance ? '₹••••' : formatINRCompact(cashDrawerBalance)}
            </p>
          </motion.button>
        )}
      </div>
    </motion.section>
  );
};
