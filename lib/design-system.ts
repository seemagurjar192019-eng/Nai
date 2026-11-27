import { wcagContrast } from 'culori';
import { z } from 'zod';

/**
 * Ucred Apple Minimal Monochrome — Dual-Theme Fintech Color System
 * Pure White & Jet Black Canvas · Translucent Sky Notice Tint · Amount-Only Semantic Accents
 */
export const UCRED_COLOR_SYSTEM = {
  name: 'Ucred Minimal Monochrome',
  light: {
    canvas: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSubtle: '#F5F5F7',
    border: '#E5E5EA',
    ink: '#0A0A0A',
    inkMuted: '#6E6E73',
    brand: '#0A0A0A',
    brandHover: '#262628',
    brandFg: '#FFFFFF',
    accent: '#0A0A0A',
    accentFg: '#FFFFFF',
    accentTint: '#F2F4F8',
    creditRed: '#B91C1C',
    debitGreen: '#15803D',
    alertAmber: '#B45309',
    munimGradient: 'linear-gradient(155deg, #27272A 0%, #09090B 100%)',
  },
  dark: {
    canvas: '#000000',
    surface: '#121214',
    surfaceSubtle: '#1C1C1F',
    border: '#27272A',
    ink: '#F5F5F7',
    inkMuted: '#98989D',
    brand: '#FFFFFF',
    brandHover: '#E5E5EA',
    brandFg: '#0A0A0A',
    accent: '#FFFFFF',
    accentFg: '#0A0A0A',
    accentTint: '#1C1C1F',
    creditRed: '#F87171',
    debitGreen: '#4ADE80',
    alertAmber: '#FBBF24',
    munimGradient: 'linear-gradient(155deg, #27272A 0%, #141417 100%)',
  },
} as const;

export function verifyPaletteContrast(): {
  lightBodyRatio: number;
  lightBrandRatio: number;
  lightAccentRatio: number;
  darkBodyRatio: number;
  darkBrandRatio: number;
  darkAccentRatio: number;
} {
  const l = UCRED_COLOR_SYSTEM.light;
  const d = UCRED_COLOR_SYSTEM.dark;
  return {
    lightBodyRatio: Math.round(wcagContrast(l.ink, l.canvas) * 100) / 100,
    lightBrandRatio: Math.round(wcagContrast(l.brandFg, l.brand) * 100) / 100,
    lightAccentRatio: Math.round(wcagContrast(l.accentFg, l.accent) * 100) / 100,
    darkBodyRatio: Math.round(wcagContrast(d.ink, d.canvas) * 100) / 100,
    darkBrandRatio: Math.round(wcagContrast(d.brandFg, d.brand) * 100) / 100,
    darkAccentRatio: Math.round(wcagContrast(d.accent, d.surface) * 100) / 100,
  };
}

/** Strict Zod schemas synced with firebase-blueprint.json & firestore.rules */
export const indianMobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number starting with 6-9.');

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit SMS verification code.');

export const firestoreIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const accountInputSchema = z.object({
  kind: z.enum(['customer', 'supplier']),
  name: z.string().trim().min(1, 'Party name is required.').max(100),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number.'),
  dueDate: z.string().trim().max(24).optional().default(''),
  creditLimit: z.number().min(0).max(100_000_000).optional().default(0),
});

export const businessProfileInputSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required.').max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number.'),
  gstNumber: z
    .string()
    .trim()
    .max(24)
    .refine(
      (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.toUpperCase()),
      'GSTIN must be 15 valid characters.'
    ),
  upiId: z
    .string()
    .trim()
    .max(100)
    .refine((v) => !v || /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(v), 'Invalid UPI ID format.'),
  businessType: z.string().trim().max(60),
  category: z.string().trim().max(60),
  address: z.string().trim().max(240),
  email: z.string().trim().max(120),
  about: z.string().trim().max(300),
});
