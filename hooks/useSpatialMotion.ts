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
  largeTitleOpacity: MotionValue<number>;
  largeTitleScale: MotionValue<number>;
  largeTitleY: MotionValue<number>;
  dockedPillOpacity: MotionValue<number>;
  dockedPillScale: MotionValue<number>;
  dockedPillY: MotionValue<number>;
  jellySkew: MotionValue<number>;
  /** Fires only at the 84px threshold boundary — never continuously on scroll */
  isHeroDocked: boolean;
}

const DOCK_THRESHOLD_PX = 84;

/**
 * 60fps GPU-Accelerated iOS 27 Scroll & Depth Motion Engine.
 * All frame-by-frame visual interpolation (`opacity`, `scale`, `y`, `skewY`) flows exclusively
 * through Framer Motion `MotionValue` transforms on compositor layers — zero scroll-loop setState.
 */
export function useSpatialMotion(
  scrollContainerRef: RefObject<HTMLElement | null>
): SpatialMotionValues {
  const { scrollY } = useScroll({ container: scrollContainerRef });
  const [isHeroDocked, setIsHeroDocked] = useState(false);

  // Discrete threshold crossing only updates React state when crossing threshold
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const nextDocked = latest >= DOCK_THRESHOLD_PX;
    setIsHeroDocked((prev) => (prev === nextDocked ? prev : nextDocked));
  });

  // iOS 27 Collapsing Large Title (0px -> 56px)
  const largeTitleOpacity = useTransform(scrollY, [0, 56], [1, 0]);
  const largeTitleScale = useTransform(scrollY, [0, 56], [1, 0.88]);
  const largeTitleY = useTransform(scrollY, [0, 56], [0, -10]);

  // Wallet Stack smooth compression into the top Dynamic Island (16px -> 140px)
  const heroOpacity = useTransform(scrollY, [28, 160], [1, 0.35]);
  const heroScale = useTransform(scrollY, [0, 160], [1, 0.94]);
  const heroY = useTransform(scrollY, [0, 160], [0, -10]);

  // Top Dynamic Island docked ₹ balance pill reveals inversely
  const dockedPillOpacity = useTransform(scrollY, [52, DOCK_THRESHOLD_PX + 10], [0, 1]);
  const dockedPillScale = useTransform(scrollY, [52, DOCK_THRESHOLD_PX + 10], [0.85, 1]);
  const dockedPillY = useTransform(scrollY, [52, DOCK_THRESHOLD_PX + 10], [6, 0]);

  // Tactile scroll-velocity jelly physics on party list rows
  const scrollVelocity = useVelocity(scrollY);
  const rawJellySkew = useTransform(scrollVelocity, [-1600, 0, 1600], [-1.35, 0, 1.35]);
  const jellySkew = useSpring(rawJellySkew, { stiffness: 320, damping: 28 });

  return {
    scrollY,
    heroOpacity,
    heroScale,
    heroY,
    largeTitleOpacity,
    largeTitleScale,
    largeTitleY,
    dockedPillOpacity,
    dockedPillScale,
    dockedPillY,
    jellySkew,
    isHeroDocked,
  };
}
