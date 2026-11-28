import type { LedgerTransaction, TxDirection } from './types';

export interface DuplicateMatchResult {
  duplicate: LedgerTransaction;
  minutesAgo: number;
}

/**
 * Checks whether an entry with the exact same account, direction, and amount
 * was recorded within `windowMs` (default: 5 minutes) to prevent accidental double-entries.
 */
export function findRecentDuplicateTransaction(params: {
  transactions: LedgerTransaction[];
  accountId: string;
  direction: TxDirection;
  amount: number;
  nowMs?: number;
  windowMs?: number;
}): DuplicateMatchResult | null {
  const cleanAmt = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmt <= 0 || !params.accountId) return null;

  const nowMs = params.nowMs ?? Date.now();
  const windowMs = params.windowMs ?? 5 * 60 * 1000;

  for (const tx of params.transactions) {
    if (tx.accountId !== params.accountId) continue;
    if (tx.direction !== params.direction) continue;
    if (Math.abs((Number(tx.amount) || 0) - cleanAmt) > 0.01) continue;

    let txMs = Number.NaN;
    if (typeof tx.billDate === 'string' && tx.billDate.includes('T')) {
      txMs = Date.parse(tx.billDate);
    } else if (typeof tx.createdAt === 'string') {
      txMs = Date.parse(tx.createdAt);
    } else if (tx.createdAt && typeof tx.createdAt === 'object') {
      const ts = tx.createdAt as { seconds?: number; toDate?: () => Date };
      if (typeof ts.toDate === 'function') txMs = ts.toDate().getTime();
      else if (typeof ts.seconds === 'number') txMs = ts.seconds * 1000;
    }

    if (!Number.isFinite(txMs)) continue;
    const diffMs = Math.abs(nowMs - txMs);
    if (diffMs <= windowMs) {
      return {
        duplicate: tx,
        minutesAgo: Math.max(0, Math.round(diffMs / 60000)),
      };
    }
  }

  return null;
}
