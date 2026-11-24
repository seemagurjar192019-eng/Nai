'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { Check, MessageSquare, Plus } from 'lucide-react';
import { formatINR, getAvatarColor } from '@/lib/i18n';
import type { CustomerTrustScore, LedgerAccount, TxDirection } from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';
import { SNAPPY_SPRING } from '../motion/SpatialMotionEngine';

const RING_RADIUS = 19;
const SWIPE_ARC_RADIUS = 8;
const SWIPE_ARC_CIRCUMFERENCE = 2 * Math.PI * SWIPE_ARC_RADIUS;
const SPRING_FAST = SNAPPY_SPRING;
const SWIPE_THRESHOLD = 58;

export function TrustAvatarRing({
  name,
  score,
  hasTrust,
  size = 'md',
}: {
  name: string;
  score: number;
  hasTrust: boolean;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.max(0, Math.min(100, hasTrust ? score : 100));
  const strokeColor = !hasTrust
    ? 'var(--brand-accent)'
    : clamped >= 70
      ? 'var(--debit-green)'
      : clamped >= 50
        ? 'var(--alert-amber)'
        : 'var(--credit-red)';
  const outerCls = size === 'sm' ? 'w-11 h-11' : 'w-12 h-12';
  const innerCls = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-base';

  return (
    <div className={`relative ${outerCls} shrink-0 flex items-center justify-center`}>
      <svg viewBox="0 0 44 44" className={`${outerCls} -rotate-90`} aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeWidth="2.8"
          fill="none"
          className="stroke-[var(--surface-subtle)]"
        />
        <motion.circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeWidth="2.8"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped / 100 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div
        style={{ backgroundColor: getAvatarColor(name) }}
        className={`absolute ${innerCls} rounded-full text-white font-extrabold flex items-center justify-center shadow-sm`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

export interface PartyLedgerCardProps {
  account: LedgerAccount;
  idx: number;
  trust?: CustomerTrustScore;
  hideBalance: boolean;
  isSelected: boolean;
  isRecentlySaved: boolean;
  repulsionOffsetY: number;
  groupedRow?: boolean;
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
 * iOS 27 Spatial Party Card:
 * - Z-axis `layoutId` shared card-to-statement morph
 * - Progressive circular SVG swipe arc drawing while dragging right ('Receive ₹') or left ('Remind')
 * - Neighbour repulsion (`±3px`) when an adjacent card is active
 */
export const PartyLedgerCard: React.FC<PartyLedgerCardProps> = ({
  account,
  idx,
  trust,
  hideBalance,
  isSelected,
  isRecentlySaved,
  repulsionOffsetY,
  groupedRow = false,
  dueLabel,
  advanceLabel,
  settledLabel,
  onSelect,
  onQuickAdd,
  onSwipeRemind,
  onInteractionStart,
  onInteractionEnd,
}) => {
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

  // Reserve slot without duplicating layoutId while foreground PartyStatementView is open
  if (isSelected) {
    return (
      <div className="min-h-[72px] rounded-[24px] opacity-0 pointer-events-none" aria-hidden="true" />
    );
  }

  const absBal = Math.abs(account.balance);
  const statusText =
    account.balance > 0 ? dueLabel : account.balance < 0 ? advanceLabel : settledLabel;
  const overLimit = Boolean(
    account.creditLimit && account.creditLimit > 0 && account.balance > account.creditLimit
  );
  const descriptionText = overLimit
    ? `Over Limit · ${formatINR(account.creditLimit || 0)}`
    : account.lastNote && account.lastNote !== 'Added Today'
      ? account.lastNote
      : trust && account.kind === 'customer'
        ? `Score ${trust.score}/100${account.dueDate ? ` · Due ${account.dueDate}` : ''}`
        : account.phone
          ? `+91 ${account.phone}`
          : 'Tap for ledger';

  const rightProgress = Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD));
  const leftProgress = Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD));
  const rightPillVisible = dragX > 12;
  const leftPillVisible = dragX < -12;

  return (
    <div className={`relative touch-pan-y ${groupedRow ? '' : 'rounded-[24px]'}`}>
      {/* Detached Spring-Popping Swipe Action Pills with Progressive Circular SVG Arcs */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-between px-3 pointer-events-none ${
          groupedRow ? 'bg-[var(--app-bg)]/60' : 'rounded-[24px]'
        }`}
      >
        <motion.span
          animate={{
            scale: rightPillVisible ? (rightProgress >= 1 ? 1.05 : 0.94) : 0.72,
            opacity: rightPillVisible ? 1 : 0,
          }}
          transition={SPRING_FAST}
          className="min-h-[38px] px-3.5 rounded-full bg-[var(--debit-green)] text-white inline-flex items-center gap-1.5 text-xs font-extrabold shadow-sm"
        >
          <svg viewBox="0 0 22 22" className="w-4 h-4 -rotate-90" fill="none" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r={SWIPE_ARC_RADIUS}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2.4"
            />
            <circle
              cx="11"
              cy="11"
              r={SWIPE_ARC_RADIUS}
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={SWIPE_ARC_CIRCUMFERENCE}
              strokeDashoffset={SWIPE_ARC_CIRCUMFERENCE * (1 - rightProgress)}
            />
          </svg>
          <span>Receive ₹</span>
        </motion.span>

        <motion.span
          animate={{
            scale: leftPillVisible ? (leftProgress >= 1 ? 1.05 : 0.94) : 0.72,
            opacity: leftPillVisible ? 1 : 0,
          }}
          transition={SPRING_FAST}
          className="min-h-[38px] px-3.5 rounded-full bg-[var(--brand)] text-white inline-flex items-center gap-1.5 text-xs font-extrabold shadow-sm"
        >
          <svg viewBox="0 0 22 22" className="w-4 h-4 -rotate-90" fill="none" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r={SWIPE_ARC_RADIUS}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2.4"
            />
            <circle
              cx="11"
              cy="11"
              r={SWIPE_ARC_RADIUS}
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={SWIPE_ARC_CIRCUMFERENCE}
              strokeDashoffset={SWIPE_ARC_CIRCUMFERENCE * (1 - leftProgress)}
            />
          </svg>
          <MessageSquare className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Remind</span>
        </motion.span>
      </div>

      <motion.div
        layoutId={`party-card-${account.id}`}
        {...(bind() as Record<string, unknown>)}
        style={{ touchAction: 'pan-y' }}
        onPointerEnter={() => onInteractionStart?.(idx)}
        onPointerLeave={() => onInteractionEnd?.()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: repulsionOffsetY,
          x: dragX,
          scale: isRecentlySaved ? 1.015 : 1,
        }}
        whileTap={{ scale: 0.985 }}
        transition={
          isDragging
            ? { duration: 0 }
            : { ...SPRING_FAST, delay: Math.min(idx, 10) * 0.02 }
        }
        className={`relative px-4 py-3 flex items-center justify-between gap-2.5 will-change-transform ${
          groupedRow
            ? isRecentlySaved
              ? 'bg-[var(--debit-tint)]'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-subtle)]/45 transition-colors'
            : isRecentlySaved
              ? 'rounded-[24px] spatial-card bg-[var(--debit-tint)] ring-2 ring-[var(--debit-green)]'
              : 'rounded-[24px] spatial-card bg-[var(--surface)]'
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
          <TrustAvatarRing
            name={account.name}
            score={trust?.score ?? 100}
            hasTrust={Boolean(trust && account.kind === 'customer')}
            size="sm"
          />

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[15px] font-extrabold text-[var(--ink)] leading-snug truncate">
                {account.name}
              </p>
              {trust && account.kind === 'customer' && (
                <span
                  className={`text-[11px] font-extrabold font-tabular shrink-0 ${
                    trust.band === 'high-risk'
                      ? 'text-[var(--credit-red)]'
                      : trust.band === 'watch'
                        ? 'text-[var(--alert-amber)]'
                        : 'text-[var(--debit-green)]'
                  }`}
                >
                  · {trust.score}
                </span>
              )}
            </div>
            <p
              className={`text-[11px] font-semibold truncate ${
                overLimit || (trust?.band === 'high-risk' && account.balance > 0)
                  ? 'text-[var(--credit-red)]'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              {descriptionText}
            </p>
          </div>

          <div className="text-right shrink-0 pl-1 max-w-[130px] sm:max-w-[160px] truncate">
            <p
              className={`font-display text-sm sm:text-base font-extrabold leading-tight truncate ${
                account.balance > 0
                  ? 'text-[var(--credit-red)]'
                  : account.balance < 0
                    ? 'text-[var(--debit-green)]'
                    : 'text-[var(--ink-muted)]'
              }`}
            >
              <OdometerNumber value={absBal} hidden={hideBalance} />
            </p>
            <p
              className={`text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center justify-end gap-0.5 ${
                overLimit
                  ? 'text-[var(--alert-amber)]'
                  : account.balance > 0
                    ? 'text-[var(--credit-red)]'
                    : account.balance < 0
                      ? 'text-[var(--debit-green)]'
                      : 'text-[var(--ink-muted)]'
              }`}
            >
              {!overLimit && account.balance === 0 && (
                <Check className="w-2.5 h-2.5 text-[var(--debit-green)] stroke-[3]" />
              )}
              <span>{overLimit ? 'Limit' : statusText}</span>
            </p>
          </div>
        </button>

        <motion.button
          whileTap={{ scale: 0.9, y: 1 }}
          transition={SPRING_FAST}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.tap();
            onQuickAdd(account, 'given');
          }}
          aria-label={`Quick entry for ${account.name}`}
          className="min-w-[44px] min-h-[42px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] font-extrabold text-xs inline-flex items-center justify-center gap-0.5 shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>₹</span>
        </motion.button>
      </motion.div>
    </div>
  );
};
