/**
 * Unified Spatial Motion Engine (`components/motion/SpatialMotionEngine.ts`)
 * Standardizes 60fps spring physics, layout animations, gesture curves,
 * and tactile micro-interactions across all Ucred cards, sheets, and overlays.
 */

export const SPATIAL_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
  mass: 0.85,
};

export const SNAPPY_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.7,
};

export const GENTLE_SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 30,
  mass: 1.0,
};

export const BOUNCY_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.75,
};

export const SPATIAL_TRANSITION = {
  layout: SPATIAL_SPRING,
  opacity: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
};

export const TACTILE_TAP_ANIMATION = {
  scale: 0.985,
  transition: SNAPPY_SPRING,
};

export const CARD_HOVER_ANIMATION = {
  y: -2,
  transition: SPATIAL_SPRING,
};

export function getSpatialLayoutId(prefix: string, id: string | number): string {
  return `spatial-${prefix}-${id}`;
}

export function calculateStaggerDelay(idx: number, maxCap = 10, step = 0.02): number {
  return Math.min(idx, maxCap) * step;
}
