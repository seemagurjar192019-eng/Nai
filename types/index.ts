export * from '@/lib/types';
export type {
  MandiAadatCalculation,
  MandiAadatInput,
  PersonaAdaptation,
  PersonaCapabilities,
  PersonaCategoryId,
  PersonaOptionMeta,
  PersonaPrefs,
} from '@/lib/persona';

export type MainTab = 'ledger' | 'collection' | 'bills' | 'stock' | 'more';
export type CashKhataSegment = 'customer' | 'supplier' | 'galla';
