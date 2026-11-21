'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatINR } from '@/lib/i18n';

export interface OdometerNumberProps {
  value: number;
  hidden?: boolean;
  prefix?: string;
  className?: string;
}

const ROLL_SPRING = { type: 'spring' as const, stiffness: 440, damping: 32, mass: 0.72 };

/**
 * 60fps GPU-Only Vertical Odometer Numerals.
 * Animates strictly compositor properties (`transform` Y-translation + `opacity`)
 * with zero CSS `filter` blur and smooth `₹••••` privacy masking transitions.
 */
export const OdometerNumber: React.FC<OdometerNumberProps> = ({
  value,
  hidden = false,
  prefix = '',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const [rollDirection, setRollDirection] = useState<'up' | 'down' | null>(null);
  const [rollEpoch, setRollEpoch] = useState(0);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const dir: 'up' | 'down' = endVal >= startVal ? 'up' : 'down';

    if (prefersReducedMotion) {
      prevValueRef.current = endVal;
      const timer = window.setTimeout(() => setDisplayValue(endVal), 0);
      return () => window.clearTimeout(timer);
    }

    const kickTimer = window.setTimeout(() => {
      setRollDirection(dir);
      setRollEpoch((e) => e + 1);
    }, 0);

    const duration = 360;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round((startVal + (endVal - startVal) * eased) * 100) / 100;
      setDisplayValue(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(kickTimer);
      cancelAnimationFrame(rafId);
      prevValueRef.current = endVal;
    };
  }, [value, prefersReducedMotion]);

  const initialY = rollEpoch === 0 ? 0 : rollDirection === 'down' ? -12 : 12;
  const formattedText = hidden ? '₹••••' : `${prefix}${formatINR(displayValue)}`;

  return (
    <span className={`inline-block overflow-hidden align-bottom font-tabular ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={hidden ? 'masked' : `val-${rollEpoch}`}
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : {
                  y: hidden ? 8 : initialY,
                  opacity: 0.35,
                }
          }
          animate={{ y: 0, opacity: 1 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : {
                  y: hidden ? -8 : -initialY,
                  opacity: 0,
                  transition: { duration: 0.14, ease: 'easeOut' },
                }
          }
          transition={ROLL_SPRING}
          className="inline-block will-change-transform"
        >
          {formattedText}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
