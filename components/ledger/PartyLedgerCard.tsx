'use client';

import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { ArrowDown, Check, MessageSquare, Plus } from 'lucide-react';
import { formatINR } from '@/lib/i18n';
import type { LedgerAccount, TxDirection } from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';
import { SNAPPY_SPRING } from '../motion/SpatialMotionEngine';

const SWIPE_THRESHOLD = 58;

export interface PartyLedgerCardProps {
  account: LedgerAccount;
  idx: number;
  hideBalance: boolean;
  isSelected: boolean;
  isRecentlySaved: boolean;
  repulsionOffsetY: number;
  groupedRow?: boolean;
  disambiguator?: string;
  dueLabel: string;
  advanceLabel: string;
  settledLabel: string;
  onSelect: (acc: LedgerAccount) => void;
  onQuickAdd: (acc: LedgerAccount, presetDirection: TxDirection) => void;
  onSwipeRemind?: (acc: LedgerAccount) => void;
  onInteractionStart?: (idx: number) => void;
  onInteractionEnd?: () => void;
}

/**
 * iOS 27 Spatial Party Row:
 * - Z-axis `layoutId` shared row-to-statement transition
 * - Tactile horizontal drag gestures: Swipe right -> Receive ₹, Swipe left -> WhatsApp Remind
 * - Neighbor repulsion (`±3px`) + GPU-only transform feedback
 */
export const PartyLedgerCard: React.FC<PartyLedgerCardProps> = ({
  account,
  idx,
  hideBalance,
  isSelected,
  isRecentlySaved,
  repulsionOffsetY,
  groupedRow = false,
  disambiguator,
  dueLabel,
  advanceLabel,
  settledLabel,
  onSelect,
  onQuickAdd,
  onSwipeRemind,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const crossedThresholdRef = useRef<'none' | 'right' | 'left'>('none');

  const bind = useDrag(
    ({ down, movement: [mx], tap }) => {
      if (tap) {
        setDragX(0);
        setIsDragging(false);
        crossedThresholdRef.current = 'none';
        onInteractionEnd?.();
        return;
      }
      if (down) {
        const clamped = Math.max(-116, Math.min(116, mx * 0.8));
        setIsDragging(true);
        setDragX(clamped);
        onInteractionStart?.(idx);

        if (mx > SWIPE_THRESHOLD && crossedThresholdRef.current !== 'right') {
          crossedThresholdRef.current = 'right';
          haptics.swipe();
        } else if (mx < -SWIPE_THRESHOLD && crossedThresholdRef.current !== 'left') {
          crossedThresholdRef.current = 'left';
          haptics.swipe();
        } else if (Math.abs(mx) <= SWIPE_THRESHOLD) {
          crossedThresholdRef.current = 'none';
        }
      } else {
        setIsDragging(false);
        setDragX(0);
        crossedThresholdRef.current = 'none';
        onInteractionEnd?.();
        if (mx > SWIPE_THRESHOLD) {
          onQuickAdd(account, 'received');
        } else if (mx < -SWIPE_THRESHOLD) {
          if (onSwipeRemind) onSwipeRemind(account);
          else onSelect(account);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      threshold: 10,
    }
  );

  if (isSelected) {
    return (
      <div className="min-h-[68px] rounded-[24px] opacity-0 pointer-events-none" aria-hidden="true" />
    );
  }

  const absBal = Math.abs(account.balance);
  const statusText =
    account.balance > 0 ? dueLabel : account.balance < 0 ? advanceLabel : settledLabel;
  const overLimit = Boolean(
    account.creditLimit && account.creditLimit > 0 && account.balance > account.creditLimit
  );
  const baseDescriptionText = overLimit
    ? `Over Limit · ${formatINR(account.creditLimit || 0)}`
    : account.lastNote && account.lastNote !== 'Added Today'
      ? account.lastNote
      : account.dueDate
        ? `Due ${account.dueDate}`
        : account.phone
          ? `+91 ${account.phone}`
          : 'Tap for ledger';

  const tagLabel =
    account.tag === 'vip'
      ? 'VIP'
      : account.tag === 'slow'
        ? 'Slow Payer'
        : account.tag === 'blocked'
          ? 'Blocked'
          : account.tag === 'regular'
            ? 'Regular'
            : '';

  const descriptionText = tagLabel ? `${tagLabel} · ${baseDescriptionText}` : baseDescriptionText;

  const rightProgress = Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD));
  const leftProgress = Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD));
  const rightPillVisible = dragX > 12;
  const leftPillVisible = dragX < -12;

  return (
    <div className={`relative touch-pan-y ${groupedRow ? '' : 'rounded-[22px]'}`}>
      {/* Behind-Row Gesture Action Capsules */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-between px-3 pointer-events-none ${
          groupedRow ? 'bg-[var(--surface-subtle)]' : 'rounded-[22px]'
        }`}
      >
        <motion.span
          animate={{
            scale: rightPillVisible ? (rightProgress >= 1 ? 1.04 : 0.94) : 0.76,
            opacity: rightPillVisible ? 1 : 0,
          }}
          transition={SNAPPY_SPRING}
          className="min-h-[38px] px-3.5 rounded-full bg-[#15803D] text-white inline-flex items-center gap-1.5 text-xs font-semibold shadow-sm"
        >
          <ArrowDown className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Receive ₹</span>
        </motion.span>

        <motion.span
          animate={{
            scale: leftPillVisible ? (leftProgress >= 1 ? 1.04 : 0.94) : 0.76,
            opacity: leftPillVisible ? 1 : 0,
          }}
          transition={SNAPPY_SPRING}
          className="min-h-[38px] px-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] inline-flex items-center gap-1.5 text-xs font-semibold shadow-sm"
        >
          <MessageSquare className="w-3.5 h-3.5 stroke-[2]" />
          <span>Remind</span>
        </motion.span>
      </div>

      <motion.div
        layoutId={prefersReducedMotion ? undefined : `party-card-${account.id}`}
        {...(bind() as Record<string, unknown>)}
        style={{ touchAction: 'pan-y' }}
        onPointerEnter={() => onInteractionStart?.(idx)}
        onPointerLeave={() => onInteractionEnd?.()}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: prefersReducedMotion ? 0 : repulsionOffsetY,
          x: dragX,
          scale: isRecentlySaved ? 1.01 : 1,
        }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
        transition={
          isDragging
            ? { duration: 0 }
            : { ...SNAPPY_SPRING, delay: Math.min(idx, 8) * 0.018 }
        }
        className={`relative min-h-[64px] px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2.5 will-change-transform ${
          groupedRow
            ? isRecentlySaved
              ? 'bg-[var(--surface-subtle)]'
              : 'hover:bg-[var(--surface-subtle)]/60 transition-colors'
            : isRecentlySaved
              ? 'rounded-[22px] spatial-card ring-1 ring-[var(--ink)]'
              : 'rounded-[22px] spatial-card'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            onSelect(account);
          }}
          aria-label={`Open ${account.name} ledger`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-2xl focus:outline-none min-h-[44px]"
        >
          <span className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] font-display text-sm font-semibold flex items-center justify-center shrink-0">
            {account.name.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)] leading-snug truncate">
                {account.name}
              </p>
              {disambiguator && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[10px] font-medium font-tabular text-[var(--ink-muted)] shrink-0">
                  {disambiguator}
                </span>
              )}
            </div>
            <p
              className={`text-[12px] font-normal truncate ${
                overLimit
                  ? 'text-[var(--credit-red)]'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              {descriptionText}
            </p>
          </div>

          <div className="text-right shrink-0 pl-1 max-w-[140px] sm:max-w-[180px] whitespace-nowrap overflow-hidden">
            <p
              className={`font-display ${
                absBal >= 10000000 ? 'text-[13px] sm:text-sm' : 'text-[15px]'
              } font-semibold leading-tight whitespace-nowrap truncate ${
                account.balance > 0
                  ? 'text-[var(--credit-red)]'
                  : account.balance < 0
                    ? 'text-[var(--debit-green)]'
                    : 'text-[var(--ink)]'
              }`}
            >
              <OdometerNumber value={absBal} hidden={hideBalance} compact={absBal >= 1000000} />
            </p>
            <p className="text-[11px] font-medium text-[var(--ink-muted)] inline-flex items-center justify-end gap-0.5">
              {!overLimit && account.balance === 0 && (
                <Check className="w-2.5 h-2.5 stroke-[2.2]" />
              )}
              <span>{overLimit ? 'Limit' : statusText}</span>
            </p>
          </div>
        </button>

        <motion.button
          whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
          transition={SNAPPY_SPRING}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.tap();
            onQuickAdd(account, 'given');
          }}
          aria-label={`Quick entry for ${account.name}`}
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-[var(--ink)] hover:bg-[var(--brand-tint)] transition-colors"
        >
          <span className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] flex items-center justify-center">
            <Plus className="w-4 h-4 stroke-[1.9]" />
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
};
