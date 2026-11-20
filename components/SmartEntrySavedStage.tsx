'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AnimatedRupeeNumber } from './AnimatedRupeeNumber';

interface SmartEntrySavedStageProps {
  partyName: string;
  previousBalance: number;
  newBalance: number;
  amount: number;
  direction: 'given' | 'received';
}

const SPARKLES = [
  { tx: '-38px', ty: '-36px', color: 'bg-emerald-400', delay: '0.02s', size: 'w-2 h-2' },
  { tx: '38px', ty: '-34px', color: 'bg-amber-400', delay: '0.05s', size: 'w-2.5 h-2.5' },
  { tx: '-48px', ty: '6px', color: 'bg-indigo-400', delay: '0.08s', size: 'w-1.5 h-1.5' },
  { tx: '48px', ty: '8px', color: 'bg-emerald-500', delay: '0.04s', size: 'w-2 h-2' },
  { tx: '-26px', ty: '36px', color: 'bg-cyan-400', delay: '0.1s', size: 'w-2 h-2' },
  { tx: '28px', ty: '34px', color: 'bg-amber-300', delay: '0.06s', size: 'w-1.5 h-1.5' },
  { tx: '0px', ty: '-48px', color: 'bg-emerald-300', delay: '0.03s', size: 'w-2 h-2' },
  { tx: '0px', ty: '46px', color: 'bg-indigo-300', delay: '0.09s', size: 'w-1.5 h-1.5' },
];

export const SmartEntrySavedStage: React.FC<SmartEntrySavedStageProps> = ({
  partyName,
  previousBalance,
  newBalance,
  amount,
  direction,
}) => {
  const isGiven = direction === 'given';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      void confetti({
        particleCount: 28,
        spread: 62,
        startVelocity: 24,
        scalar: 0.78,
        ticks: 110,
        origin: { y: 0.62 },
        colors: ['#4F46E5', '#06B6D4', '#16A34A', '#F59E0B'],
        disableForReducedMotion: true,
      });
    } catch {
      // Ignore canvas-confetti errors in restricted environments
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0.7, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.35, y: 120 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="py-6 px-3 flex flex-col items-center justify-center text-center space-y-4"
    >
      {/* Emerald Checkmark SVG PathLength Draw + Confetti Sparkle Burst */}
      <div className="relative flex items-center justify-center w-20 h-20">
        {SPARKLES.map((sp, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={
              {
                '--tx': sp.tx,
                '--ty': sp.ty,
                animationDelay: sp.delay,
              } as React.CSSProperties
            }
            className={`sparkle-particle absolute rounded-full ${sp.color} ${sp.size}`}
          />
        ))}

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
          className="w-16 h-16 rounded-full bg-[var(--debit-tint)] flex items-center justify-center shadow-md"
        >
          <svg
            viewBox="0 0 36 36"
            className="w-9 h-9 text-[var(--debit-green)]"
            fill="none"
            aria-hidden="true"
          >
            <motion.path
              d="M9 18.5L15.2 24.5L27 12"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
            />
          </svg>
        </motion.div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-extrabold text-[var(--debit-green)]">
          Saved to {partyName}
        </p>
        <p className="font-display text-2xl font-extrabold font-tabular text-[var(--ink)]">
          <AnimatedRupeeNumber
            value={Math.abs(newBalance)}
            prefix={newBalance < 0 ? 'Adv ' : ''}
          />
        </p>
        <p className="text-[11px] font-semibold text-[var(--ink-muted)] font-tabular">
          {isGiven ? 'Given +' : 'Received -'}₹{amount.toLocaleString('en-IN')} · Prev ₹
          {Math.abs(previousBalance).toLocaleString('en-IN')}
        </p>
      </div>
    </motion.div>
  );
};
