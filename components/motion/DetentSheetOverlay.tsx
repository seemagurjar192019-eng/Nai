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
import { APPLE_EASE, SNAPPY_SPRING, SPATIAL_SPRING } from './SpatialMotionEngine';

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

  const sheetHeightClass = allowDetentToggle
    ? detent === 'full'
      ? 'h-[90dvh]'
      : 'h-[70dvh]'
    : 'max-h-[90dvh]';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="ios27-detent-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: APPLE_EASE } }}
          style={prefersReducedMotion ? undefined : { opacity: backdropFade }}
          onClick={handleClose}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-end justify-center p-0 sm:p-4 sm:items-center touch-none select-none"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 0.9 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { y: '100%', opacity: 0.85, transition: { duration: 0.2, ease: APPLE_EASE } }
            }
            transition={SPATIAL_SPRING}
            drag={prefersReducedMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, bottom: 0.42 }}
            onDrag={(_, info) => {
              dragY.set(Math.max(0, info.offset.y));
            }}
            onDragEnd={(_, info) => {
              dragY.set(0);
              if (info.offset.y > 120 || info.velocity.y > 460) {
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
            className={`w-full ${maxWidthClass} ${sheetHeightClass} rounded-t-[30px] sm:rounded-[30px] liquid-glass-elevated flex flex-col overflow-hidden pb-safe will-change-transform touch-auto select-auto`}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
            >
              <span className="w-10 h-1 rounded-full bg-[var(--ink-muted)]/30" />
            </div>

            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button, input, a')) return;
                dragControls.start(e);
              }}
              className="px-5 pt-1 pb-3 flex items-center justify-between gap-3 border-b border-[var(--glass-border)] shrink-0 touch-none"
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
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    transition={SNAPPY_SPRING}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setManualDetent(detent === 'full' ? 'peek' : 'full');
                    }}
                    aria-label={detent === 'full' ? 'Compact sheet size' : 'Expand sheet'}
                    className="w-11 h-11 rounded-full bg-[var(--surface-subtle)]/80 text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center transition"
                  >
                    {detent === 'full' ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={SNAPPY_SPRING}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    handleClose();
                  }}
                  aria-label={`Close ${title}`}
                  className="w-11 h-11 rounded-full bg-[var(--surface-subtle)]/80 text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

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
