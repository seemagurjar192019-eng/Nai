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
 * Flagship Apple iOS 27 Tactile Acoustic Click & Tone Synthesizer (Web Audio API).
 * Ultra-fast micro-pulses simulating physical mechanical switches and Taptic feedback.
 */
function playTactileTone(kind: 'tap' | 'keypad' | 'orb' | 'swipe' | 'select' | 'success'): void {
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (kind === 'tap' || kind === 'keypad') {
      // Crisp 8ms mechanical switch click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(kind === 'keypad' ? 1400 : 1200, now);
      filter.Q.setValueAtTime(3.2, now);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'keypad' ? 980 : 840, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.009);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.01);
    } else if (kind === 'select') {
      // Soft iOS picker wheel tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.008);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.024, now + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.009);
    } else if (kind === 'orb') {
      // Siri / Voice Munim warm acoustic pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (kind === 'swipe') {
      // Gesture threshold snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.022);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } else if (kind === 'success') {
      // Apple Pay / Cash two-note bell confirmation
      const playChime = (freq: number, startOffset: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + startOffset + dur);

        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.linearRampToValueAtTime(0.045, now + startOffset + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + dur + 0.01);
      };
      playChime(698.46, 0, 0.08); // F5
      playChime(1046.5, 0.065, 0.14); // C6
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
  /** Subtle 8ms mechanical tactile click + vibration for buttons, pills, and cards */
  tap: (): void => {
    triggerVibrate(8);
    playTactileTone('tap');
  },

  /** Ultra-snappy numeric keypad keypress */
  keypad: (): void => {
    triggerVibrate(6);
    playTactileTone('keypad');
  },

  /** Segmented control and filter tab selection click */
  select: (): void => {
    triggerVibrate(6);
    playTactileTone('select');
  },

  /** Warm acoustic pulse for the raised Voice Munim orb */
  orbTap: (): void => {
    triggerVibrate(12);
    playTactileTone('orb');
  },

  /** Medium 18ms bump when crossing horizontal swipe thresholds */
  swipe: (): void => {
    triggerVibrate(18);
    playTactileTone('swipe');
  },

  /** Apple Pay two-note melodic chime + double-pulse confirmation on save */
  success: (): void => {
    triggerVibrate([12, 28, 16]);
    playTactileTone('success');
  },
};

export const haptic = haptics;
