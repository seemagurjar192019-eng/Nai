'use client';

import { useState, type RefObject } from 'react';
import {
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';

export interface SpatialMotionValues {
  scrollY: MotionValue<number>;
  heroOpacity: MotionValue<number>;
  heroScale: MotionValue<number>;
  heroY: MotionValue<number>;
  dockedPillOpacity: MotionValue<number>;
  dockedPillScale: MotionValue<number>;
  dockedPillY: MotionValue<number>;
  jellySkew: MotionValue<number>;
  /** Fires only at the 90px threshold boundary — never continuously on scroll */
  isHeroDocked: boolean;
}

const DOCK_THRESHOLD_PX = 90;

/**
 * 60fps GPU-Accelerated Scroll & Depth Motion Engine.
 * All frame-by-frame visual interpolation (`opacity`, `scale`, `y`, `skewY`) flows exclusively
 * through Framer Motion `MotionValue` transforms on compositor layers — zero scroll-loop setState.
 */
export function useSpatialMotion(
  scrollContainerRef: RefObject<HTMLElement | null>
): SpatialMotionValues {
  const { scrollY } = useScroll({ container: scrollContainerRef });
  const [isHeroDocked, setIsHeroDocked] = useState(false);

  // Discrete threshold crossing only updates React state when crossing 90px
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const nextDocked = latest >= DOCK_THRESHOLD_PX;
    setIsHeroDocked((prev) => (prev === nextDocked ? prev : nextDocked));
  });

  // Hero Balance Card smooth compression into the top Dynamic Island (0px -> 90px)
  const heroOpacity = useTransform(scrollY, [10, DOCK_THRESHOLD_PX], [1, 0]);
  const heroScale = useTransform(scrollY, [0, DOCK_THRESHOLD_PX], [1, 0.94]);
  const heroY = useTransform(scrollY, [0, DOCK_THRESHOLD_PX], [0, -14]);

  // Top Dynamic Island docked ₹ balance pill reveals inversely
  const dockedPillOpacity = useTransform(scrollY, [56, DOCK_THRESHOLD_PX + 8], [0, 1]);
  const dockedPillScale = useTransform(scrollY, [56, DOCK_THRESHOLD_PX + 8], [0.85, 1]);
  const dockedPillY = useTransform(scrollY, [56, DOCK_THRESHOLD_PX + 8], [6, 0]);

  // Tactile scroll-velocity jelly physics on party list rows
  const scrollVelocity = useVelocity(scrollY);
  const rawJellySkew = useTransform(scrollVelocity, [-1600, 0, 1600], [-1.35, 0, 1.35]);
  const jellySkew = useSpring(rawJellySkew, { stiffness: 320, damping: 28 });

  return {
    scrollY,
    heroOpacity,
    heroScale,
    heroY,
    dockedPillOpacity,
    dockedPillScale,
    dockedPillY,
    jellySkew,
    isHeroDocked,
  };
}
