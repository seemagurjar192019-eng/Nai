'use client';

import { useCallback } from 'react';
import type { User } from 'firebase/auth';
import { restoreBusinessBackup } from '@/lib/firestore-service';
import {
  applyRestoreBusinessBackup,
  type GuestVaultState,
} from '@/lib/guest-store';
import { sanitizeCsvCell, validateSafeBackupJson } from '@/lib/security';
import type {
  ActivityLog,
  BillDocument,
  Business,
  CashbookEntry,
  LedgerAccount,
  LedgerTransaction,
  StaffMember,
  StockItem,
} from '@/lib/types';

interface UseLedgerBackupOptions {
  currentBusiness: Business | undefined;
  activeAccounts: LedgerAccount[];
  activeTransactions: LedgerTransaction[];
  activeBills: BillDocument[];
  activeStockItems: StockItem[];
  activeCashbookEntries: CashbookEntry[];
  activeStaffMembers: StaffMember[];
  isGuestMode: boolean;
  user: User | null;
  cloudDek: CryptoKey | null;
  updateGuestVault: (updater: (prev: GuestVaultState) => GuestVaultState) => GuestVaultState;
  logActivity: (
    actionType: ActivityLog['actionType'],
    summary: string,
    targetName?: string,
    amount?: number
  ) => void;
}

export function useLedgerBackup({
  currentBusiness,
  activeAccounts,
  activeTransactions,
  activeBills,
  activeStockItems,
  activeCashbookEntries,
  activeStaffMembers,
  isGuestMode,
  user,
  cloudDek,
  updateGuestVault,
  logActivity,
}: UseLedgerBackupOptions) {
  const handleExportCsv = useCallback(() => {
    if (!currentBusiness) return;
    const rows: string[] = [
      ['Type', 'Account Name', 'Phone', 'Direction', 'Amount (INR)', 'Date', 'Note', 'Operator']
        .map((h) => sanitizeCsvCell(h))
        .join(','),
    ];
    const accMap = new Map(activeAccounts.map((a) => [a.id, a]));
    for (const tx of activeTransactions) {
      const acc = accMap.get(tx.accountId);
      rows.push(
        [
          sanitizeCsvCell(acc?.kind || 'customer'),
          sanitizeCsvCell(acc?.name || 'Customer'),
          sanitizeCsvCell(acc?.phone || ''),
          sanitizeCsvCell(tx.direction),
          sanitizeCsvCell(String(tx.amount)),
          sanitizeCsvCell(tx.billDate),
          sanitizeCsvCell(tx.note || tx.voiceRaw),
          sanitizeCsvCell(tx.createdByName || 'Shop Owner'),
        ].join(',')
      );
    }
    const csvContent = `\uFEFF${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBusiness.name.replace(/\s+/g, '_')}_ucred_ledger.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [currentBusiness, activeAccounts, activeTransactions]);

  const handleExportJson = useCallback(() => {
    if (!currentBusiness) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Ucred',
      business: currentBusiness,
      accounts: activeAccounts,
      transactions: activeTransactions,
      bills: activeBills,
      stockItems: activeStockItems,
      cashbookEntries: activeCashbookEntries,
      staffMembers: activeStaffMembers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBusiness.name.replace(/\s+/g, '_')}_ucred_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    currentBusiness,
    activeAccounts,
    activeTransactions,
    activeBills,
    activeStockItems,
    activeCashbookEntries,
    activeStaffMembers,
  ]);

  const handleRestoreJson = useCallback(
    async (file: File, options?: { mode?: 'merge' | 'replace' }) => {
      if (!currentBusiness) return;
      if (file.size > 5_000_000) {
        throw new Error('Backup file exceeds 5 MB limit.');
      }
      const text = await file.text();
      let rawParsed: unknown;
      try {
        rawParsed = JSON.parse(text);
      } catch {
        throw new Error('Selected file is not valid JSON.');
      }
      const safePayload = validateSafeBackupJson(rawParsed);
      const restoreMode = options?.mode === 'replace' ? 'replace' : 'merge';
      if (isGuestMode) {
        updateGuestVault(
          (prev) =>
            applyRestoreBusinessBackup(prev, currentBusiness.id, safePayload, {
              mode: restoreMode,
            }).vault
        );
        logActivity('account', `Restored JSON local backup (${restoreMode})`);
        return;
      }
      if (!user) return;
      await restoreBusinessBackup(user.uid, currentBusiness.id, safePayload, cloudDek, {
        mode: restoreMode,
      });
      logActivity('account', `Restored JSON cloud backup (${restoreMode})`);
    },
    [currentBusiness, isGuestMode, user, cloudDek, updateGuestVault, logActivity]
  );

  return {
    handleExportCsv,
    handleExportJson,
    handleRestoreJson,
  };
}
