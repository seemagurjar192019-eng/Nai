'use client';

import React, { useState } from 'react';
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from 'framer-motion';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { haptics } from '@/utils/haptics';

export type SheetDetent = 'peek' | 'full';

export interface DetentSheetOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialDetent?: SheetDetent;
  allowDetentToggle?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const SHEET_SPRING = { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.88 };

/**
 * iOS 27 Interactive Two-Detent Sheet Presentation (`66%` Peek <-> `94%` Full)
 * with live drag controls, velocity flick dismissal, and solid matte ceramic geometry.
 */
export const DetentSheetOverlay: React.FC<DetentSheetOverlayProps> = ({
  open,
  onClose,
  title,
  subtitle,
  initialDetent = 'peek',
  allowDetentToggle = true,
  maxWidthClass = 'max-w-[460px]',
  children,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const [detent, setDetent] = useState<SheetDetent>(initialDetent);

  const heightTarget = detent === 'full' ? '94dvh' : '68dvh';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ios27-detent-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-0 sm:p-4 sm:items-center"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { y: 0, maxHeight: heightTarget }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { y: '100%', transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
            }
            transition={SHEET_SPRING}
            drag={prefersReducedMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.14, bottom: 0.42 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 125 || info.velocity.y > 460) {
                haptics.swipe();
                onClose();
              } else if (info.offset.y < -65 || info.velocity.y < -360) {
                if (allowDetentToggle && detent !== 'full') {
                  haptics.tap();
                  setDetent('full');
                }
              } else if (info.offset.y > 55 && detent === 'full' && allowDetentToggle) {
                haptics.tap();
                setDetent('peek');
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${maxWidthClass} rounded-t-[34px] sm:rounded-[34px] spatial-sheet flex flex-col overflow-hidden pb-safe will-change-transform`}
          >
            {/* Interactive Grab Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
            >
              <span className="w-11 h-1.5 rounded-full bg-[var(--surface-subtle)]" />
            </div>

            {/* Crisp Header Bar */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button, input, a')) return;
                dragControls.start(e);
              }}
              className="px-5 pt-1 pb-3 flex items-center justify-between gap-3 border-b border-[var(--surface-border)] shrink-0"
            >
              <div className="min-w-0">
                <h3 className="font-display text-base font-extrabold text-[var(--ink)] truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {allowDetentToggle && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setDetent((d) => (d === 'full' ? 'peek' : 'full'));
                    }}
                    aria-label={detent === 'full' ? 'Compact sheet size' : 'Expand sheet'}
                    className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center active:scale-90 transition"
                  >
                    {detent === 'full' ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onClose();
                  }}
                  aria-label={`Close ${title}`}
                  className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center active:scale-90 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Detent Content */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4">
              {children}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
