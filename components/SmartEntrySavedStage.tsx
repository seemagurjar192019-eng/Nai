'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { haptic } from '@/utils/haptics';
import { OdometerNumber } from './motion/OdometerNumber';
import { APPLE_EASE, BOUNCY_SPRING } from './motion/SpatialMotionEngine';

interface SmartEntrySavedStageProps {
  partyName: string;
  previousBalance: number;
  newBalance: number;
  amount: number;
  direction: 'given' | 'received';
}

export const SmartEntrySavedStage: React.FC<SmartEntrySavedStageProps> = ({
  partyName,
  previousBalance,
  newBalance,
  amount,
  direction,
}) => {
  const isGiven = direction === 'given';

  useEffect(() => {
    haptic.success();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0.7, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.35, y: 120 }}
      transition={{ duration: 0.34, ease: APPLE_EASE }}
      className="py-6 px-3 flex flex-col items-center justify-center text-center space-y-4"
    >
      {/* Clean iOS Apple Pay-Style Animated Checkmark Ring */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <motion.span
          aria-hidden="true"
          initial={{ scale: 0.85, opacity: 0.5 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.65, ease: APPLE_EASE }}
          className="absolute inset-1 rounded-full border-2 border-[var(--debit-green)] pointer-events-none"
        />

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={BOUNCY_SPRING}
          className="w-16 h-16 rounded-full bg-[var(--debit-tint)] text-[var(--debit-green)] flex items-center justify-center shadow-md"
        >
          <motion.span
            initial={{ scale: 0.4, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ ...BOUNCY_SPRING, delay: 0.06 }}
            className="flex items-center justify-center"
          >
            <Check className="w-9 h-9 stroke-[3]" />
          </motion.span>
        </motion.div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-extrabold text-[var(--debit-green)]">
          Saved to {partyName}
        </p>
        <p className="font-display text-2xl font-extrabold font-tabular text-[var(--ink)]">
          <OdometerNumber
            value={Math.abs(newBalance)}
            prefix={newBalance < 0 ? 'Adv ' : ''}
          />
        </p>
        <p className="text-[11px] font-semibold text-[var(--ink-muted)] font-tabular">
          {isGiven ? 'Credit +' : 'Received -'}₹{amount.toLocaleString('en-IN')} · Prev ₹
          {Math.abs(previousBalance).toLocaleString('en-IN')}
        </p>
      </div>
    </motion.div>
  );
};
