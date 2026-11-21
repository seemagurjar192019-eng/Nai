'use client';

import { useMemo } from 'react';
import {
  filterAccountsByPersona,
  getPersonaAdaptation,
  getPersonaCapabilities,
  type PersonaAdaptation,
  type PersonaCapabilities,
  type PersonaPrefs,
} from '@/lib/persona';
import type { LedgerAccount, LedgerTransaction } from '@/types';

export interface PersonaGateResult {
  adaptation: PersonaAdaptation;
  capabilities: PersonaCapabilities;
  scopedAccounts: LedgerAccount[];
  scopedTransactions: LedgerTransaction[];
}

/**
 * Enforces strict persona gating across navigation, hero metrics, and unified party records.
 * Keeps one shop database while filtering records by active `personaContext` unless `showAll` is enabled.
 */
export function usePersonaGate(
  prefs: PersonaPrefs,
  accounts: LedgerAccount[],
  transactions: LedgerTransaction[],
  showAll: boolean
): PersonaGateResult {
  const adaptation = useMemo(
    () => getPersonaAdaptation(prefs.categories, prefs.activeFocus),
    [prefs.categories, prefs.activeFocus]
  );

  const capabilities = useMemo(
    () => getPersonaCapabilities(adaptation.activeFocus),
    [adaptation.activeFocus]
  );

  const scopedAccounts = useMemo(() => {
    const byContext = filterAccountsByPersona(accounts, adaptation.activeFocus, showAll);
    if (!capabilities.showSuppliers) {
      return byContext.filter((acc) => acc.kind !== 'supplier');
    }
    return byContext;
  }, [accounts, adaptation.activeFocus, showAll, capabilities.showSuppliers]);

  const scopedTransactions = useMemo(() => {
    const allowedIds = new Set(scopedAccounts.map((acc) => acc.id));
    return transactions.filter((tx) => allowedIds.has(tx.accountId));
  }, [transactions, scopedAccounts]);

  return {
    adaptation,
    capabilities,
    scopedAccounts,
    scopedTransactions,
  };
}
