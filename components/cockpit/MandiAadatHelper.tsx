'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Copy, Scale } from 'lucide-react';
import { formatINR } from '@/lib/i18n';
import { calculateMandiAadatTotals } from '@/lib/persona';
import { haptics } from '@/utils/haptics';
import { SNAPPY_SPRING } from '../motion/SpatialMotionEngine';

/**
 * Compact inline Bori / Wazan / Aadat Commission Calculator rendered strictly in Mandi / Vyapari mode.
 */
export const MandiAadatHelper: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [boriCount, setBoriCount] = useState('10');
  const [weightKg, setWeightKg] = useState('500');
  const [ratePerQuintal, setRatePerQuintal] = useState('2400');
  const [aadatPct, setAadatPct] = useState('2');
  const [copied, setCopied] = useState(false);

  const calc = useMemo(
    () =>
      calculateMandiAadatTotals({
        boriCount: Number(boriCount) || 0,
        weightKg: Number(weightKg) || 0,
        ratePerQuintal: Number(ratePerQuintal) || 0,
        aadatPct: Number(aadatPct) || 0,
      }),
    [boriCount, weightKg, ratePerQuintal, aadatPct]
  );

  const handleCopySummary = () => {
    haptics.tap();
    const summary = `${calc.formattedNote} = ${formatINR(calc.netTotal)} (Fee ${formatINR(calc.aadatFee)})`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section
      aria-label="Grain and Produce Trade Calculator"
      className="rounded-[22px] ios27-ceramic-tile p-3.5 space-y-2"
    >
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[var(--ink)] truncate">
              Batch · Weight · Commission Calculator
            </p>
            <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate font-tabular">
              Sample Lot: {formatINR(calc.netTotal)} ({aadatPct || '0'}% fee)
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--ink-muted)] shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, clipPath: 'inset(0% 0% 100% 0%)' }
            }
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -4, clipPath: 'inset(0% 0% 100% 0%)' }
            }
            transition={SNAPPY_SPRING}
            className="overflow-hidden will-change-transform"
          >
            <div className="pt-2 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Bags Count
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={boriCount}
                    onChange={(e) => setBoriCount(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Weight (kg)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Rate / 100kg (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={ratePerQuintal}
                    onChange={(e) => setRatePerQuintal(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Commission (%)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="0.25"
                    value={aadatPct}
                    onChange={(e) => setAadatPct(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--ink-muted)] font-tabular">
                    Gross {formatINR(calc.grossAmount)} + Fee {formatINR(calc.aadatFee)}
                  </p>
                  <p className="font-display text-base font-extrabold text-[var(--ink)] font-tabular">
                    Net: {formatINR(calc.netTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="min-h-[40px] px-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs active:scale-95 transition shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
