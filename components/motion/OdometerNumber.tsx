'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatINR } from '@/lib/i18n';

export interface OdometerNumberProps {
  value: number;
  hidden?: boolean;
  prefix?: string;
  className?: string;
}

const DIGIT_STRIP = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const REEL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.78 };

interface DigitReelProps {
  digit: number;
  reducedMotion: boolean;
}

const DigitReel: React.FC<DigitReelProps> = ({ digit, reducedMotion }) => {
  const safeDigit = Math.max(0, Math.min(9, digit));
  if (reducedMotion) {
    return <span className="inline-block">{safeDigit}</span>;
  }

  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1em] overflow-hidden align-bottom leading-none"
    >
      <motion.span
        initial={false}
        animate={{ y: `-${safeDigit * 10}%` }}
        transition={REEL_SPRING}
        className="flex flex-col will-change-transform"
      >
        {DIGIT_STRIP.map((d) => (
          <span key={d} className="block h-[1em] leading-[1em]">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

/**
 * 60fps True Per-Digit Vertical Slot Odometer Numerals.
 * Renders discrete 0–9 vertical reels translated solely via GPU `transform` (`translateY`),
 * eliminating float-jitter while preserving exact Indian comma grouping and screen-reader fidelity.
 */
export const OdometerNumber: React.FC<OdometerNumberProps> = ({
  value,
  hidden = false,
  prefix = '',
  className = '',
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const formattedText = hidden ? '₹••••' : `${prefix}${formatINR(value)}`;
  const chars = formattedText.split('');

  return (
    <span
      aria-label={formattedText}
      className={`inline-flex items-baseline overflow-hidden align-bottom font-tabular ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {hidden ? (
          <motion.span
            key="masked"
            initial={prefersReducedMotion ? { opacity: 1 } : { y: 8, opacity: 0.35 }}
            animate={{ y: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { y: -8, opacity: 0, transition: { duration: 0.14, ease: 'easeOut' } }
            }
            transition={REEL_SPRING}
            className="inline-block will-change-transform"
          >
            ₹••••
          </motion.span>
        ) : (
          <motion.span
            key="visible-reels"
            initial={prefersReducedMotion ? { opacity: 1 } : { y: -8, opacity: 0.35 }}
            animate={{ y: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { y: 8, opacity: 0, transition: { duration: 0.14, ease: 'easeOut' } }
            }
            transition={REEL_SPRING}
            className="inline-flex items-baseline will-change-transform"
          >
            <span className="sr-only">{formattedText}</span>
            {chars.map((char, idx) => {
              const fromRight = chars.length - 1 - idx;
              if (char >= '0' && char <= '9') {
                return (
                  <DigitReel
                    key={`d-${fromRight}`}
                    digit={Number(char)}
                    reducedMotion={prefersReducedMotion}
                  />
                );
              }
              return (
                <span key={`s-${fromRight}-${char}`} aria-hidden="true" className="inline-block leading-none">
                  {char}
                </span>
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};
