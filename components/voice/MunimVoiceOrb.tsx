'use client';

import React, { useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { Mic } from 'lucide-react';
import { haptics } from '@/utils/haptics';

export interface MunimVoiceOrbProps {
  size?: 'dock' | 'mini' | 'hero';
  listening?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

const ORB_SPRING = { type: 'spring' as const, stiffness: 440, damping: 24, mass: 0.8 };
const MAGNETIC_SPRING = { stiffness: 320, damping: 22, mass: 0.5 };

/**
 * Centered Matte Royal Indigo (#4F46E5) Mic Orb.
 * Features a 60fps GPU CSS breathing halo ring (`orb-halo-breath`) and subtle ±5px magnetic pull.
 * Zero cartoon faces, zero cyan neon gradients, zero glass/backdrop blur.
 */
export const MunimVoiceOrb: React.FC<MunimVoiceOrbProps> = ({
  size = 'dock',
  listening = false,
  onClick,
  ariaLabel = 'Open Voice Munim entry',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [pulseSeq, setPulseSeq] = useState(0);
  const orbRef = useRef<HTMLDivElement | null>(null);

  const rawPullX = useMotionValue(0);
  const rawPullY = useMotionValue(0);
  const pullX = useSpring(rawPullX, MAGNETIC_SPRING);
  const pullY = useSpring(rawPullY, MAGNETIC_SPRING);

  const isDock = size === 'dock';
  const isHero = size === 'hero';
  const dim = isHero ? 'w-[80px] h-[80px]' : isDock ? 'w-[60px] h-[60px]' : 'w-12 h-12';
  const iconDim = isHero ? 'w-7 h-7' : isDock ? 'w-6 h-6' : 'w-5 h-5';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !orbRef.current) return;
    const rect = orbRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const clampedX = Math.max(-5, Math.min(5, (dx / (rect.width / 2)) * 5));
    const clampedY = Math.max(-5, Math.min(5, (dy / (rect.height / 2)) * 5));
    rawPullX.set(clampedX);
    rawPullY.set(clampedY);
  };

  const handlePointerLeave = () => {
    rawPullX.set(0);
    rawPullY.set(0);
  };

  const handlePress = () => {
    haptics.orbTap();
    setPulseSeq((s) => s + 1);
    onClick?.();
  };

  return (
    <div
      ref={orbRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      className="relative inline-flex items-center justify-center select-none"
    >
      {/* Continuous 60fps GPU CSS Breathing Halo Ring (Zero Blur) */}
      {!prefersReducedMotion && (
        <span
          aria-hidden="true"
          className="orb-halo-breath absolute inset-0 rounded-full border-2 border-[#4F46E5] pointer-events-none will-change-transform"
        />
      )}

      {/* Active Listening / Tap Ripple Ring */}
      <AnimatePresence>
        {(listening || pulseSeq > 0) && !prefersReducedMotion && (
          <motion.span
            key={pulseSeq}
            aria-hidden="true"
            initial={{ scale: 0.92, opacity: 0.55 }}
            animate={{ scale: listening ? 1.7 : 1.55, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-full border-2 border-[#4F46E5] pointer-events-none will-change-transform"
          />
        )}
      </AnimatePresence>

      {/* Crisp Matte Royal Indigo Orb with white Mic icon */}
      <motion.button
        type="button"
        style={
          prefersReducedMotion
            ? { backgroundColor: 'var(--brand)' }
            : { backgroundColor: 'var(--brand)', x: pullX, y: pullY }
        }
        whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        transition={ORB_SPRING}
        onClick={handlePress}
        aria-label={ariaLabel}
        className={`relative ${dim} rounded-full text-white flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4F46E5] shadow-[0_10px_24px_-4px_rgba(79,70,229,0.42)] will-change-transform ${
          isDock
            ? 'ring-[5px] ring-[#F5F6F8] dark:ring-[#0B0C0E]'
            : isHero
              ? 'ring-4 ring-[#EEF2FF] dark:ring-[#1E1B4B]'
              : 'ring-2 ring-[var(--surface)]'
        }`}
      >
        <Mic className={`${iconDim} relative z-10 stroke-[2.3]`} />
      </motion.button>
    </div>
  );
};
