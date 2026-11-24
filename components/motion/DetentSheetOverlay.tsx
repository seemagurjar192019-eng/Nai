'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { SPATIAL_SPRING } from './SpatialMotionEngine';

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

const emptySubscribe = () => () => {};

/**
 * iOS 27 Interactive Two-Detent Sheet Presentation (`68%` Peek <-> `94%` Full)
 * Rendered via React Portal directly into `document.body` to avoid CSS transform containing block
 * trapping, ensuring instant response and 60fps physics across all parent tabs and scroll views.
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
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const [manualDetent, setManualDetent] = useState<SheetDetent | null>(null);
  const dragY = useMotionValue(0);
  const backdropFade = useTransform(dragY, [0, 260], [1, 0.25]);

  const detent = manualDetent ?? initialDetent;

  const handleClose = React.useCallback(() => {
    setManualDetent(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    dragY.set(0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, dragY, handleClose]);

  if (!isClient || typeof document === 'undefined') {
    return null;
  }

  const heightTarget = detent === 'full' ? '94dvh' : '68dvh';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="ios27-detent-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
          style={prefersReducedMotion ? undefined : { opacity: backdropFade }}
          onClick={handleClose}
          className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center p-0 sm:p-4 sm:items-center touch-none select-none"
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
            transition={SPATIAL_SPRING}
            drag={prefersReducedMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.12, bottom: 0.4 }}
            onDrag={(_, info) => {
              dragY.set(Math.max(0, info.offset.y));
            }}
            onDragEnd={(_, info) => {
              dragY.set(0);
              if (info.offset.y > 125 || info.velocity.y > 460) {
                haptics.swipe();
                handleClose();
              } else if (info.offset.y < -65 || info.velocity.y < -360) {
                if (allowDetentToggle && detent !== 'full') {
                  haptics.tap();
                  setManualDetent('full');
                }
              } else if (info.offset.y > 55 && detent === 'full' && allowDetentToggle) {
                haptics.tap();
                setManualDetent('peek');
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${maxWidthClass} rounded-t-[34px] sm:rounded-[34px] spatial-sheet flex flex-col overflow-hidden pb-safe will-change-transform shadow-2xl touch-auto select-auto`}
          >
            {/* Interactive Grab Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
            >
              <span className="w-11 h-1.5 rounded-full bg-[var(--surface-border)]" />
            </div>

            {/* Crisp Header Bar */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button, input, a')) return;
                dragControls.start(e);
              }}
              className="px-5 pt-1 pb-3 flex items-center justify-between gap-3 border-b border-[var(--surface-border)] shrink-0 touch-none"
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
                      setManualDetent(detent === 'full' ? 'peek' : 'full');
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
                    handleClose();
                  }}
                  aria-label={`Close ${title}`}
                  className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center active:scale-90 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Detent Content */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4 overscroll-contain">
              {children}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
