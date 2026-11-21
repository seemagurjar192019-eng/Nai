'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface ApertureIrisOverlayProps {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}

const IRIS_SPRING = { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.88 };

/**
 * Spatial Aperture Iris Reveal transitioning cleanly from the dead-center Matte Indigo Mic Orb
 * into a 100% solid opaque matte canvas (`--surface`) with zero glass/backdrop blur.
 */
export const ApertureIrisOverlay: React.FC<ApertureIrisOverlayProps> = ({
  open,
  onClose,
  ariaLabel = 'Voice Munim Assistant',
  children,
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : {
                    clipPath: 'circle(24px at 50% 92%)',
                    opacity: 0.65,
                    scale: 0.96,
                  }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : {
                    clipPath: 'circle(150% at 50% 50%)',
                    opacity: 1,
                    scale: 1,
                  }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : {
                    clipPath: 'circle(24px at 50% 92%)',
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                  }
            }
            transition={IRIS_SPRING}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] rounded-t-[28px] sm:rounded-[28px] bg-[var(--surface)] shadow-[var(--spatial-sheet-shadow)] max-h-[92dvh] overflow-hidden flex flex-col will-change-transform"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
