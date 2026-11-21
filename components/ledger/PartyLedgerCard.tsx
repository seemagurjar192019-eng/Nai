'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { MessageSquare, Plus } from 'lucide-react';
import { formatINR, getAvatarColor } from '@/lib/i18n';
import type { CustomerTrustScore, LedgerAccount, TxDirection } from '@/types';
import { haptics } from '@/utils/haptics';
import { OdometerNumber } from '../motion/OdometerNumber';

const RING_RADIUS = 19;
const SPRING_FAST = { type: 'spring' as const, stiffness: 460, damping: 26 };
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
 * Spatial Party Ledger Card with:
 * - Z-axis `layoutId` shared card-to-statement morph
 * - Velocity swipe revealing detached 'Receive ₹' and 'WhatsApp' pills
 * - Neighbour repulsion (`±3px`) when an adjacent card is pressed/dragged
 */
export const PartyLedgerCard: React.FC<PartyLedgerCardProps> = ({
  account,
  idx,
  trust,
  hideBalance,
  isSelected,
  isRecentlySaved,
  repulsionOffsetY,
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
    return <div className="min-h-[72px] rounded-[24px] opacity-0 pointer-events-none" aria-hidden="true" />;
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
        ? `Trust ${trust.score}/100${account.dueDate ? ` · Due ${account.dueDate}` : ''}`
        : account.phone
          ? `+91 ${account.phone}`
          : 'Tap for ledger';

  const rightPillVisible = dragX > 14;
  const leftPillVisible = dragX < -14;

  return (
    <div className="relative rounded-[24px] touch-pan-y">
      {/* Detached Spring-Popping Swipe Action Pills */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[24px] flex items-center justify-between px-2.5 pointer-events-none"
      >
        <motion.span
          animate={{
            scale: rightPillVisible ? (dragX > SWIPE_THRESHOLD ? 1.04 : 0.94) : 0.72,
            opacity: rightPillVisible ? 1 : 0,
          }}
          transition={SPRING_FAST}
          className="min-h-[38px] px-3.5 rounded-full bg-[var(--debit-green)] text-white inline-flex items-center gap-1.5 text-xs font-extrabold shadow-sm"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden="true">
            <motion.path
              d="M8 3v10m0 0-3.5-3.5M8 13l3.5-3.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: rightPillVisible ? 1 : 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            />
          </svg>
          <span>Receive ₹</span>
        </motion.span>

        <motion.span
          animate={{
            scale: leftPillVisible ? (dragX < -SWIPE_THRESHOLD ? 1.04 : 0.94) : 0.72,
            opacity: leftPillVisible ? 1 : 0,
          }}
          transition={SPRING_FAST}
          className="min-h-[38px] px-3.5 rounded-full bg-[var(--brand)] text-white inline-flex items-center gap-1.5 text-xs font-extrabold shadow-sm"
        >
          <MessageSquare className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>WhatsApp</span>
        </motion.span>
      </div>

      <motion.div
        layoutId={`party-card-${account.id}`}
        {...(bind() as Record<string, unknown>)}
        style={{ touchAction: 'pan-y' }}
        onPointerEnter={() => onInteractionStart?.(idx)}
        onPointerDown={() => onInteractionStart?.(idx)}
        onPointerUp={() => onInteractionEnd?.()}
        onPointerCancel={() => onInteractionEnd?.()}
        onPointerLeave={() => onInteractionEnd?.()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: repulsionOffsetY,
          x: dragX,
          scale: isRecentlySaved ? 1.02 : 1,
        }}
        whileTap={{ scale: 0.98 }}
        transition={
          isDragging
            ? { duration: 0 }
            : { ...SPRING_FAST, delay: Math.min(idx, 10) * 0.02 }
        }
        className={`relative rounded-[24px] spatial-card px-3.5 py-3 flex items-center justify-between gap-2.5 will-change-transform ${
          isRecentlySaved
            ? 'bg-[var(--debit-tint)] ring-2 ring-[var(--debit-green)]'
            : 'bg-[var(--surface)]'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            onSelect(account);
          }}
          aria-label={`Open ${account.name} khata`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-2xl focus:outline-none"
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
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold font-tabular shrink-0 ${
                    trust.band === 'high-risk'
                      ? 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                      : trust.band === 'watch'
                        ? 'bg-[var(--alert-tint)] text-[var(--alert-amber)]'
                        : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                  }`}
                >
                  {trust.score}
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

          <div className="text-right shrink-0 pl-1">
            <p
              className={`font-display text-base font-extrabold leading-tight ${
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
              className={`text-[10px] font-extrabold uppercase tracking-wider ${
                overLimit
                  ? 'text-[var(--alert-amber)]'
                  : account.balance > 0
                    ? 'text-[var(--credit-red)]'
                    : account.balance < 0
                      ? 'text-[var(--debit-green)]'
                      : 'text-[var(--ink-muted)]'
              }`}
            >
              {overLimit ? 'Limit' : statusText}
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
          aria-label={`Quick ₹ entry for ${account.name}`}
          className="min-w-[44px] min-h-[42px] px-2.5 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] font-extrabold text-xs inline-flex items-center justify-center gap-0.5 shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>₹</span>
        </motion.button>
      </motion.div>
    </div>
  );
};
