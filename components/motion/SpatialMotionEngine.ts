export const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

export const SPATIAL_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

export const SNAPPY_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.7,
};

export const GENTLE_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.9,
};

export const BOUNCY_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.75,
};

export const SPATIAL_TRANSITION = {
  layout: SPATIAL_SPRING,
  opacity: { duration: 0.18, ease: APPLE_EASE },
};

/**
 * YouTube-style directional scroll chrome glide:
 * Keeps element visible while gliding out of frame, fading softly near the end;
 * fades back in immediately while gliding back into frame.
 */
export function getChromeGlideTransition(visible: boolean) {
  return {
    y: {
      type: 'spring' as const,
      stiffness: visible ? 290 : 240,
      damping: visible ? 28 : 30,
      mass: 0.88,
    },
    opacity: {
      duration: visible ? 0.18 : 0.22,
      delay: visible ? 0 : 0.08,
      ease: APPLE_EASE,
    },
  };
}

export const TAB_PAGE_TRANSITION = {
  duration: 0.2,
  ease: APPLE_EASE,
};

export const TACTILE_TAP_ANIMATION = {
  scale: 0.96,
  transition: SNAPPY_SPRING,
};

export const ICON_TAP_ANIMATION = {
  scale: 0.92,
  transition: SNAPPY_SPRING,
};

export const CARD_HOVER_ANIMATION = {
  y: -2,
  transition: SPATIAL_SPRING,
};

export function getSpatialLayoutId(prefix: string, id: string | number): string {
  return `spatial-${prefix}-${id}`;
}

export function calculateStaggerDelay(idx: number, maxCap = 8, step = 0.02): number {
  return Math.min(idx, maxCap) * step;
}
