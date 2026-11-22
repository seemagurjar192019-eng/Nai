'use client';

const SOUND_PREF_KEY = 'ucred_sound_enabled_v1';
const HAPTIC_PREF_KEY = 'ucred_haptics_enabled_v1';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function getSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = window.localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, String(Boolean(enabled)));
  } catch {
    // Ignore storage error
  }
}

export function getHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = window.localStorage.getItem(HAPTIC_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HAPTIC_PREF_KEY, String(Boolean(enabled)));
  } catch {
    // Ignore storage error
  }
}

/**
 * Zero-cost iOS 27 tactile click & confirmation tone synthesizer (Web Audio API).
 * No external MP3 assets required; gracefully silent when muted or unsupported.
 */
function playTactileTone(kind: 'tap' | 'orb' | 'swipe' | 'success'): void {
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const playNote = (
      freqStart: number,
      freqEnd: number,
      durationSec: number,
      gainPeak: number,
      offsetSec: number = 0,
      type: OscillatorType = 'sine'
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now + offsetSec);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(80, freqEnd),
        now + offsetSec + durationSec
      );
      gain.gain.setValueAtTime(0.0001, now + offsetSec);
      gain.gain.linearRampToValueAtTime(gainPeak, now + offsetSec + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offsetSec + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offsetSec);
      osc.stop(now + offsetSec + durationSec + 0.01);
    };

    if (kind === 'tap') {
      playNote(920, 420, 0.014, 0.028, 0, 'triangle');
    } else if (kind === 'orb') {
      playNote(520, 780, 0.045, 0.036, 0, 'sine');
    } else if (kind === 'swipe') {
      playNote(680, 980, 0.025, 0.03, 0, 'sine');
    } else if (kind === 'success') {
      playNote(660, 880, 0.075, 0.038, 0, 'sine');
      playNote(880, 1180, 0.11, 0.042, 0.055, 'sine');
    }
  } catch {
    // Ignore Web Audio autoplay restrictions
  }
}

function triggerVibrate(pattern: number | number[]): void {
  if (!getHapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibrate restrictions on iOS Safari or locked frames
    }
  }
}

export const haptics = {
  /** Subtle 10ms iOS tactile click + vibrate for pills, tabs, keypad keys, and cards */
  tap: (): void => {
    triggerVibrate(10);
    playTactileTone('tap');
  },

  /** Distinct 12ms tactile click + soft upward chime for the raised Voice Orb */
  orbTap: (): void => {
    triggerVibrate(12);
    playTactileTone('orb');
  },

  /** Medium 18ms bump when crossing horizontal swipe-to-action thresholds */
  swipe: (): void => {
    triggerVibrate(18);
    playTactileTone('swipe');
  },

  /** Apple Pay-style two-note confirmation chime + double-pulse haptic on save */
  success: (): void => {
    triggerVibrate([14, 32, 18]);
    playTactileTone('success');
  },
};

export const haptic = haptics;
