'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface VoiceWaveformProps {
  active: boolean;
  aiParsing?: boolean;
}

const BASE_WEIGHTS = [0.42, 0.68, 0.86, 1, 0.86, 0.68, 0.42] as const;
const IDLE_LEVELS = [6, 8, 11, 14, 11, 8, 6];

/**
 * 7-Bar Real-Time Audio-Reactive SVG Equalizer (`AnalyserNode` backed).
 * Smoothly modulates heights to real mic RMS amplitude when `active` and mic permission is granted,
 * with zero-cost fallback pulse during typing/AI parsing or unsupported headless browsers.
 */
export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  active,
  aiParsing = false,
}) => {
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    const startTime = performance.now();

    const startSimLoop = () => {
      const tick = (now: number) => {
        if (cancelled) return;
        const t = (now - startTime) / 1000;
        setLevels(
          BASE_WEIGHTS.map((w, i) => {
            const osc = 0.5 + 0.5 * Math.sin(t * 6.5 + i * 0.9);
            return Math.round(7 + w * (12 + osc * 16));
          })
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const connectMic = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        startSimLoop();
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
          startSimLoop();
          return;
        }
        ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = (now: number) => {
          if (cancelled) return;
          analyser.getByteFrequencyData(dataArray);
          const t = (now - startTime) / 1000;
          setLevels(
            BASE_WEIGHTS.map((w, i) => {
              const bin = dataArray[Math.min(dataArray.length - 1, i * 2 + 1)] ?? 0;
              const norm = Math.max(0.14, bin / 255);
              const ambient = 0.12 * (0.5 + 0.5 * Math.sin(t * 5 + i));
              return Math.min(34, Math.max(6, Math.round(6 + w * 28 * Math.min(1, norm + ambient))));
            })
          );
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        startSimLoop();
      }
    };

    void connectMic();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      if (ctx) ctx.close().catch(() => {});
    };
  }, [active]);

  const displayLevels = active ? levels : IDLE_LEVELS;

  return (
    <div
      aria-label={active ? 'Live audio waveform' : 'Paused waveform'}
      className="flex items-center justify-center gap-1.5 h-11 px-2 flex-1"
    >
      {displayLevels.map((h, i) => (
        <motion.span
          key={i}
          animate={
            aiParsing
              ? { height: [8, 28, 12, 30, 8], opacity: [0.55, 1, 0.7, 1, 0.55] }
              : { height: active ? h : 6, opacity: active ? 0.96 : 0.35 }
          }
          transition={
            aiParsing
              ? {
                  duration: 0.65,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                  delay: i * 0.06,
                }
              : { duration: 0.08, ease: 'linear' }
          }
          style={{ background: 'var(--munim-gradient)' }}
          className="w-1 rounded-full block will-change-transform"
        />
      ))}
    </div>
  );
};
