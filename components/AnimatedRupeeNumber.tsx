'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { formatINR } from '@/lib/i18n';

interface AnimatedRupeeNumberProps {
  value: number;
  hidden?: boolean;
  prefix?: string;
  className?: string;
}

export const AnimatedRupeeNumber: React.FC<AnimatedRupeeNumberProps> = ({
  value,
  hidden = false,
  prefix = '',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [rollDirection, setRollDirection] = useState<'up' | 'down' | null>(null);
  const [rollEpoch, setRollEpoch] = useState(0);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const dir: 'up' | 'down' = endVal >= startVal ? 'up' : 'down';

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      prevValueRef.current = endVal;
      const timer = window.setTimeout(() => {
        setDisplayValue(endVal);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const kickTimer = window.setTimeout(() => {
      setRollDirection(dir);
      setRollEpoch((e) => e + 1);
    }, 0);

    const duration = 420;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out for crisp Apple/Tenmin odometer settle
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
  }, [value]);

  const initialY = rollEpoch === 0 ? 0 : rollDirection === 'down' ? -8 : 8;

  return (
    <span className={`inline-block overflow-hidden align-bottom font-tabular ${className}`}>
      <motion.span
        key={hidden ? 'hidden' : rollEpoch}
        initial={rollEpoch > 0 && !hidden ? { y: initialY, opacity: 0.72 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 460, damping: 28 }}
        className="inline-block"
      >
        {hidden ? '₹••••' : `${prefix}${formatINR(displayValue)}`}
      </motion.span>
    </span>
  );
};
