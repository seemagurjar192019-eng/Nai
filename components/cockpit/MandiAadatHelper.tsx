'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy, Scale } from 'lucide-react';
import { formatINR } from '@/lib/i18n';
import { calculateMandiAadatTotals } from '@/lib/persona';
import { haptics } from '@/utils/haptics';

const SPRING_SHEET = { type: 'spring' as const, stiffness: 360, damping: 30 };

/**
 * Compact inline Bori / Wazan / Aadat Commission Calculator rendered strictly in Mandi / Vyapari mode.
 */
export const MandiAadatHelper: React.FC = () => {
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
    const summary = `${calc.formattedNote} = ${formatINR(calc.netTotal)} (Aadat ${formatINR(calc.aadatFee)})`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section
      aria-label="Mandi Bori Wazan Aadat Calculator"
      className="rounded-[24px] spatial-card p-3.5 space-y-2"
    >
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-[var(--alert-tint)] text-[var(--alert-amber)] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[var(--ink)] truncate">
              Bori · Wazan · Aadat Calculator
            </p>
            <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate font-tabular">
              Sample Lot: {formatINR(calc.netTotal)} ({aadatPct || '0'}% Aadat)
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
            transition={SPRING_SHEET}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-2xl bg-[var(--app-bg)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Bori Count
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={boriCount}
                    onChange={(e) => setBoriCount(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--app-bg)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Wazan (kg)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--app-bg)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Rate / Quintal (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={ratePerQuintal}
                    onChange={(e) => setRatePerQuintal(e.target.value)}
                    className="w-full bg-transparent text-sm font-extrabold font-tabular text-[var(--ink)] outline-none"
                  />
                </label>

                <label className="rounded-2xl bg-[var(--app-bg)] px-3 py-2 space-y-0.5">
                  <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Aadat (%)
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

              <div className="rounded-2xl bg-[var(--brand-tint)] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--ink-muted)] font-tabular">
                    Gross {formatINR(calc.grossAmount)} + Aadat {formatINR(calc.aadatFee)}
                  </p>
                  <p className="font-display text-base font-extrabold text-[var(--brand-accent)] font-tabular">
                    Net: {formatINR(calc.netTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="min-h-[34px] px-3 rounded-xl bg-[var(--surface)] text-[11px] font-extrabold text-[var(--ink)] inline-flex items-center gap-1 shadow-xs active:scale-95 transition shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--debit-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Hisaab'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
