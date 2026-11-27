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
import { APPLE_EASE, BOUNCY_SPRING, SNAPPY_SPRING } from '../motion/SpatialMotionEngine';

export interface MunimVoiceOrbProps {
  size?: 'dock' | 'mini' | 'hero';
  listening?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

const MAGNETIC_SPRING = { stiffness: 320, damping: 22, mass: 0.5 };

/**
 * Flagship Apple Monochrome Liquid Glass Voice Munim Orb.
 * GPU magnetic pull physics, Siri-grade concentric harmonic ripples, and zero color slop.
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
  const dim = isHero ? 'w-[76px] h-[76px]' : isDock ? 'w-[58px] h-[58px]' : 'w-11 h-11';
  const iconDim = isHero ? 'w-7 h-7' : isDock ? 'w-6 h-6' : 'w-5 h-5';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !orbRef.current) return;
    const rect = orbRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const clampedX = Math.max(-4, Math.min(4, (dx / (rect.width / 2)) * 4));
    const clampedY = Math.max(-4, Math.min(4, (dy / (rect.height / 2)) * 4));
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
      {/* Siri-Grade Concentric Acoustic Harmonic Ripples (Listening & Tap States) */}
      {!prefersReducedMotion && (
        <AnimatePresence>
          {listening ? (
            <>
              <motion.span
                key="ripple-1"
                aria-hidden="true"
                animate={{ scale: [1, 1.48, 1.8], opacity: [0.45, 0.18, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-[var(--ink)] pointer-events-none will-change-transform"
              />
              <motion.span
                key="ripple-2"
                aria-hidden="true"
                animate={{ scale: [1, 1.35, 1.62], opacity: [0.38, 0.14, 0] }}
                transition={{ duration: 1.8, delay: 0.55, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-[var(--ink)] pointer-events-none will-change-transform"
              />
            </>
          ) : (
            pulseSeq > 0 && (
              <motion.span
                key={pulseSeq}
                aria-hidden="true"
                initial={{ scale: 0.95, opacity: 0.38 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: APPLE_EASE }}
                className="absolute inset-0 rounded-full border border-[var(--ink)] pointer-events-none will-change-transform"
              />
            )
          )}
        </AnimatePresence>
      )}

      {/* Pure Monochrome Apple Voice Orb (Jet Black on Light / Crisp White on Dark) */}
      <motion.button
        type="button"
        style={prefersReducedMotion ? undefined : { x: pullX, y: pullY }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        transition={isDock ? BOUNCY_SPRING : SNAPPY_SPRING}
        onClick={handlePress}
        aria-label={ariaLabel}
        className={`relative ${dim} rounded-full bg-[var(--brand)] text-[var(--brand-fg)] flex items-center justify-center cursor-pointer border border-black/10 dark:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ink)] will-change-transform ${
          isHero
            ? 'ring-4 ring-[var(--brand-tint)]'
            : isDock
              ? 'shadow-[0_10px_24px_-6px_rgba(10,10,10,0.34),inset_0_1px_0_rgba(255,255,255,0.22)] dark:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.75)]'
              : 'ring-1 ring-[var(--glass-border)]'
        }`}
      >
        <Mic className={`${iconDim} relative z-10 stroke-[2]`} />
      </motion.button>
    </div>
  );
};
