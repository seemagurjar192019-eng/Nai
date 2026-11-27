'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Info, X } from 'lucide-react';
import { formatINRCompact } from '@/lib/i18n';
import { haptics } from '@/utils/haptics';
import { APPLE_EASE, SNAPPY_SPRING } from '../motion/SpatialMotionEngine';

export interface NoticeBoardBannerProps {
  partyCount: number;
  overdueCount: number;
  overdueTotal: number;
  todayInflow: number;
  todayOutflow: number;
  isPersonalMode: boolean;
  dismissedKey: string | null;
  onDismiss: (key: string) => void;
  onReviewOverdue: () => void;
  onListenSummary: () => void;
  onOpenVoice: () => void;
}

/**
 * ChatGPT-Style Sleek Low-Opacity Light Blue Notice Strip:
 * - Lives cleanly inside the active ledger feed right above the party rows
 * - Translucent soft cobalt-ice tint (6.5% light / 9% dark) with whisper-thin border
 * - Never duplicates empty-state "Add Party" copy; delivers compact, contextual intelligence
 */
export const NoticeBoardBanner: React.FC<NoticeBoardBannerProps> = ({
  partyCount,
  overdueCount,
  overdueTotal,
  todayInflow,
  todayOutflow,
  isPersonalMode,
  dismissedKey,
  onDismiss,
  onReviewOverdue,
  onListenSummary,
  onOpenVoice,
}) => {
  const prefersReducedMotion = useReducedMotion();

  let noticeKey = 'voice-tip';
  let title = 'Voice Entry';
  let body = isPersonalMode
    ? 'Speak "Paid Rohan 500" to log.'
    : 'Speak "Sharma credit 500" or scan a bill.';
  let actionLabel: string | null = 'Try Voice';
  let onAction: (() => void) | null = onOpenVoice;

  if (overdueCount > 0) {
    noticeKey = `overdue-${overdueCount}-${Math.round(overdueTotal)}`;
    title = `${overdueCount} ${overdueCount === 1 ? 'party' : 'parties'} due today`;
    body = `${formatINRCompact(overdueTotal)} pending collection.`;
    actionLabel = 'Review';
    onAction = onReviewOverdue;
  } else if (partyCount > 0 && (todayInflow > 0 || todayOutflow > 0)) {
    noticeKey = `today-${Math.round(todayInflow)}-${Math.round(todayOutflow)}`;
    title = "Today's Counter";
    body = `In ${formatINRCompact(todayInflow)} · Out ${formatINRCompact(todayOutflow)} today.`;
    actionLabel = 'Listen';
    onAction = onListenSummary;
  }

  const isVisible = dismissedKey !== noticeKey;

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.aside
          key={noticeKey}
          aria-label="Notice Board"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -4, transition: { duration: 0.14, ease: APPLE_EASE } }
          }
          transition={SNAPPY_SPRING}
          className="notice-board-surface rounded-[18px] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-[var(--notice-icon)]/12 text-[var(--notice-icon)] flex items-center justify-center shrink-0"
            >
              <Info className="w-3.5 h-3.5 stroke-[2.2]" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug text-[var(--ink-muted)]">
                <span className="font-semibold text-[var(--ink)]">{title}</span>
                <span aria-hidden="true"> · </span>
                <span>{body}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onAction?.();
                }}
                className="min-h-[36px] px-2.5 rounded-full text-[12px] font-semibold text-[var(--notice-icon)] hover:bg-[var(--notice-icon)]/10 inline-flex items-center gap-1 whitespace-nowrap active:scale-[0.97] transition"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="w-3 h-3 stroke-[2.2]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onDismiss(noticeKey);
              }}
              aria-label="Dismiss notice"
              className="w-8 h-8 rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--ink)]/5 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5 stroke-[2]" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
