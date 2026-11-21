'use client';

/**
 * Global Tactile Haptic Feedback Engine backed by Web Vibration API (`navigator.vibrate`).
 * Degrades silently on desktop or restricted mobile WebViews.
 */
function triggerVibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibrate restrictions on iOS Safari or locked frames
    }
  }
}

export const haptics = {
  /** Subtle 10ms crisp tick for pills, tabs, keypad keys, and selection cards */
  tap: (): void => triggerVibrate(10),

  /** Distinct 12ms tactile click for the raised Matte Royal Indigo Mic Orb */
  orbTap: (): void => triggerVibrate(12),

  /** Medium 18ms bump when crossing horizontal swipe-to-action thresholds */
  swipe: (): void => triggerVibrate(18),

  /** Celebratory triple pulse on ledger save or onboarding completion */
  success: (): void => triggerVibrate([20, 40, 30]),
};

export const haptic = haptics;
