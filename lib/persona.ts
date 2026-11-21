export type PersonaCategoryId = 'personal' | 'kirana' | 'mandi' | 'wholesale';

export interface PersonaOptionMeta {
  id: PersonaCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  accentHex: string;
  tintBg: string;
}

export interface PersonaPrefs {
  onboarded: boolean;
  categories: PersonaCategoryId[];
  activeFocus: PersonaCategoryId;
}

export interface PersonaAdaptation {
  activeFocus: PersonaCategoryId;
  focusBadge: string;
  heroCaption: string;
  quickNotePlaceholder: string;
  quickNotePresets: string[];
  voicePlaceholder: string;
  voiceSamples: string[];
  emptyStateHint: string;
  addPartyPlaceholder: string;
  featuredToolsLabel: string;
}

export const PERSONA_STORAGE_KEY = 'ucred_persona_prefs_v1';

export const PERSONA_OPTIONS: PersonaOptionMeta[] = [
  {
    id: 'personal',
    title: 'Personal / Normal Khata',
    subtitle: 'Friends, rent, home staff & daily personal lending',
    badge: 'Personal',
    accentHex: '#0EA5E9',
    tintBg: '#E0F2FE',
  },
  {
    id: 'kirana',
    title: 'Dukaan / Kirana Store',
    subtitle: 'Daily customer udhaar, Parchi AI & live Galla cashbook',
    badge: 'Kirana',
    accentHex: '#4F46E5',
    tintBg: '#EEF2FF',
  },
  {
    id: 'mandi',
    title: 'Mandi / Vyapari (Bori, Wazan, Aadat)',
    subtitle: 'Lot weight, bori count, kisan hisaab & aadat commission',
    badge: 'Mandi',
    accentHex: '#D97706',
    tintBg: '#FEF3C7',
  },
  {
    id: 'wholesale',
    title: 'Wholesale / Distributor',
    subtitle: 'Bulk GST billing, credit limits, stock & route vasooli',
    badge: 'Wholesale',
    accentHex: '#059669',
    tintBg: '#DCFCE7',
  },
];

const VALID_IDS = new Set<PersonaCategoryId>(['personal', 'kirana', 'mandi', 'wholesale']);

export function normalizePersonaPrefs(raw: Partial<PersonaPrefs> | null | undefined): PersonaPrefs {
  const cleaned = Array.isArray(raw?.categories)
    ? raw.categories.filter((c): c is PersonaCategoryId => VALID_IDS.has(c))
    : [];
  const unique = Array.from(new Set(cleaned));
  const categories: PersonaCategoryId[] = unique.length > 0 ? unique : ['kirana'];
  const activeFocus: PersonaCategoryId =
    raw?.activeFocus && categories.includes(raw.activeFocus) ? raw.activeFocus : categories[0];

  return {
    onboarded: Boolean(raw?.onboarded),
    categories,
    activeFocus,
  };
}

export function loadPersonaPrefs(): PersonaPrefs {
  if (typeof window === 'undefined') {
    return { onboarded: false, categories: ['kirana'], activeFocus: 'kirana' };
  }
  try {
    const raw = window.localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!raw) {
      return { onboarded: false, categories: ['kirana'], activeFocus: 'kirana' };
    }
    const parsed = JSON.parse(raw) as Partial<PersonaPrefs>;
    return normalizePersonaPrefs(parsed);
  } catch {
    return { onboarded: false, categories: ['kirana'], activeFocus: 'kirana' };
  }
}

export function savePersonaPrefs(prefs: PersonaPrefs): PersonaPrefs {
  const normalized = normalizePersonaPrefs(prefs);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}

export function getTimeGreeting(hour?: number): string {
  const h = typeof hour === 'number' ? hour : new Date().getHours();
  if (h >= 4 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getPersonaAdaptation(
  categories: PersonaCategoryId[],
  activeFocus?: PersonaCategoryId
): PersonaAdaptation {
  const safeCats = categories.length > 0 ? categories : (['kirana'] as PersonaCategoryId[]);
  const focus = activeFocus && safeCats.includes(activeFocus) ? activeFocus : safeCats[0];

  switch (focus) {
    case 'personal':
      return {
        activeFocus: 'personal',
        focusBadge: 'Personal Khata',
        heroCaption: 'Personal Hisaab · Zero Cloud Lock',
        quickNotePlaceholder: 'Note (e.g. Cab split, Rent, Chai, Dinner)',
        quickNotePresets: ['Lunch Split', 'Rent', 'UPI Return', 'Travel'],
        voicePlaceholder: 'Rahul 500 udhaar ya Amit 300 mila',
        voiceSamples: [
          'Rahul 500 udhaar',
          'Amit 1200 wapas mila',
          'Rahul ka hisaab batao',
          'Aaj ka hisaab',
        ],
        emptyStateHint: 'Add a friend or contact, or tap the glowing Munim Orb to speak.',
        addPartyPlaceholder: 'Rahul Sharma',
        featuredToolsLabel: 'Expense Log & Exports',
      };
    case 'mandi':
      return {
        activeFocus: 'mandi',
        focusBadge: 'Mandi / Vyapari',
        heroCaption: 'Bori · Wazan · Aadat Hisaab',
        quickNotePlaceholder: 'Note (e.g. 12 Bori Gehu, 520kg Wazan, Aadat 2%)',
        quickNotePresets: ['10 Bori', 'Wazan Kata', 'Aadat Jama', 'Bilty Paid'],
        voicePlaceholder: 'Kisan 12 bori gehu 24000 udhaar ya Aadat 1500 mila',
        voiceSamples: [
          'Ramesh 12 bori gehu 24000 udhaar',
          'Kisan 8500 aadat mila',
          'Ramesh ka hisaab batao',
          'Aaj ka hisaab',
        ],
        emptyStateHint:
          'Record Bori, Wazan, and Aadat entries by voice or snap a handwritten mandi parchi.',
        addPartyPlaceholder: 'Kisan / Aadat Party',
        featuredToolsLabel: 'Mandi Parchi & Galla',
      };
    case 'wholesale':
      return {
        activeFocus: 'wholesale',
        focusBadge: 'Wholesale',
        heroCaption: 'Distributors · GST & Credit Control',
        quickNotePlaceholder: 'Note (e.g. 5 Carton Oil, Invoice #42, NEFT)',
        quickNotePresets: ['GST Bill', 'NEFT Jama', 'Cartoon Lot', 'Route Due'],
        voicePlaceholder: 'Gupta Traders 15000 udhaar ya 8000 NEFT mila',
        voiceSamples: [
          'Gupta Traders 15000 udhaar',
          'Verma ka 10 carton oil 12000 bill banao',
          'Gupta Traders ka hisaab batao',
          'Aaj ka hisaab',
        ],
        emptyStateHint:
          'Track distributor credit limits, GST invoices, stock deduction, and route vasooli.',
        addPartyPlaceholder: 'Gupta Distributors',
        featuredToolsLabel: 'GST Bills & Stock Dispatch',
      };
    case 'kirana':
    default:
      return {
        activeFocus: 'kirana',
        focusBadge: 'Kirana Store',
        heroCaption: 'Daily Dukaan Khata & Live Galla',
        quickNotePlaceholder: 'Optional note (e.g. Chini, Atta, Oil, UPI)',
        quickNotePresets: ['Atta / Ration', 'UPI Mila', 'Parchi Udhaar', 'Doodh Bread'],
        voicePlaceholder: 'Ramesh 500 udhaar aur Suresh 300 mila',
        voiceSamples: [
          'Ramesh 500 udhaar',
          'Ramesh ka hisaab batao',
          'Aaj ka hisaab',
          'Verma ka 2 atta 480 aur 1 oil 175 bill banao',
        ],
        emptyStateHint:
          'Add your first customer, tap the Voice Orb below to speak, or snap a parchi.',
        addPartyPlaceholder: 'Ramesh Kirana',
        featuredToolsLabel: 'Galla, Stock & AI Parchi',
      };
  }
}

export interface PersonaCapabilities {
  focus: PersonaCategoryId;
  showGalla: boolean;
  showSuppliers: boolean;
  showGstBills: boolean;
  showStock: boolean;
  showMandiCalculator: boolean;
  feedTitle: string;
  primarySegmentLabel: string;
  secondarySegmentLabel: string | null;
  gallaSegmentLabel: string | null;
  leftDockLabel: string;
  rightDockLabel: string;
  lenaLabel: string;
  denaLabel: string;
}

/**
 * Strict Persona Gating Matrix:
 * - personal: hides Galla, Suppliers, GST Bills & Stock completely; exposes Friends/Contacts + Notes/Activity.
 * - kirana: Customers, Suppliers, Live Galla, GST Bills & Stock.
 * - mandi: Kisan, Vyapari, Mandi Cash + Bori/Wazan/Aadat inline calculator.
 * - wholesale: Parties, Suppliers, Bulk GST Bills, Stock & Route Vasooli.
 */
export function getPersonaCapabilities(focus: PersonaCategoryId): PersonaCapabilities {
  switch (focus) {
    case 'personal':
      return {
        focus: 'personal',
        showGalla: false,
        showSuppliers: false,
        showGstBills: false,
        showStock: false,
        showMandiCalculator: false,
        feedTitle: 'Contacts',
        primarySegmentLabel: 'Contacts',
        secondarySegmentLabel: null,
        gallaSegmentLabel: null,
        leftDockLabel: 'Notes',
        rightDockLabel: 'Activity',
        lenaLabel: 'Lena',
        denaLabel: 'Dena',
      };
    case 'mandi':
      return {
        focus: 'mandi',
        showGalla: true,
        showSuppliers: true,
        showGstBills: true,
        showStock: false,
        showMandiCalculator: true,
        feedTitle: 'Mandi Hisaab',
        primarySegmentLabel: 'Kisan',
        secondarySegmentLabel: 'Vyapari',
        gallaSegmentLabel: 'Mandi Cash',
        leftDockLabel: 'Vasooli',
        rightDockLabel: 'Bills',
        lenaLabel: 'Lena',
        denaLabel: 'Dena',
      };
    case 'wholesale':
      return {
        focus: 'wholesale',
        showGalla: true,
        showSuppliers: true,
        showGstBills: true,
        showStock: true,
        showMandiCalculator: false,
        feedTitle: 'Trade Khata',
        primarySegmentLabel: 'Parties',
        secondarySegmentLabel: 'Suppliers',
        gallaSegmentLabel: 'Galla',
        leftDockLabel: 'Vasooli',
        rightDockLabel: 'Bills',
        lenaLabel: 'Lena',
        denaLabel: 'Dena',
      };
    case 'kirana':
    default:
      return {
        focus: 'kirana',
        showGalla: true,
        showSuppliers: true,
        showGstBills: true,
        showStock: true,
        showMandiCalculator: false,
        feedTitle: 'Cash & Khata',
        primarySegmentLabel: 'Customers',
        secondarySegmentLabel: 'Suppliers',
        gallaSegmentLabel: 'Galla',
        leftDockLabel: 'Vasooli',
        rightDockLabel: 'Bills',
        lenaLabel: 'Lena',
        denaLabel: 'Dena',
      };
  }
}

/**
 * Filters a shop's unified account list by active persona mode.
 * Legacy/untagged accounts (`!personaContext`) remain visible across modes so zero data disappears;
 * toggled `showAll = true` exposes every record regardless of mode tag.
 */
export function filterAccountsByPersona<T extends { personaContext?: PersonaCategoryId }>(
  accounts: T[],
  activeFocus: PersonaCategoryId,
  showAll: boolean
): T[] {
  if (showAll) return accounts;
  return accounts.filter((acc) => !acc.personaContext || acc.personaContext === activeFocus);
}

export interface MandiAadatInput {
  boriCount: number;
  weightKg: number;
  ratePerQuintal: number;
  aadatPct: number;
}

export interface MandiAadatCalculation {
  grossAmount: number;
  aadatFee: number;
  netTotal: number;
  formattedNote: string;
}

/**
 * Pure deterministic Mandi / Vyapari Bori, Wazan & Aadat commission math.
 */
export function calculateMandiAadatTotals(input: MandiAadatInput): MandiAadatCalculation {
  const bori = Math.max(0, Math.round((Number(input.boriCount) || 0) * 100) / 100);
  const kg = Math.max(0, Math.round((Number(input.weightKg) || 0) * 100) / 100);
  const rate = Math.max(0, Math.round((Number(input.ratePerQuintal) || 0) * 100) / 100);
  const pct = Math.max(0, Math.min(25, Math.round((Number(input.aadatPct) || 0) * 100) / 100));

  const grossAmount = Math.round(((kg / 100) * rate) * 100) / 100;
  const aadatFee = Math.round((grossAmount * (pct / 100)) * 100) / 100;
  const netTotal = Math.round((grossAmount + aadatFee) * 100) / 100;

  const parts: string[] = [];
  if (bori > 0) parts.push(`${bori} Bori`);
  if (kg > 0) parts.push(`${kg}kg`);
  if (rate > 0) parts.push(`@ ₹${rate.toLocaleString('en-IN')}/qtl`);
  if (pct > 0) parts.push(`+${pct}% Aadat`);

  return {
    grossAmount,
    aadatFee,
    netTotal,
    formattedNote: parts.join(' · ') || 'Mandi Lot',
  };
}

