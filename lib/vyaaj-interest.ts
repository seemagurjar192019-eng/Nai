import type { LedgerAccount, LedgerTransaction } from './types';

export interface VyaajInterestResult {
  principal: number;
  monthlyRatePct: number;
  daysElapsed: number;
  monthsElapsed: number;
  interestAmount: number;
  totalPayable: number;
}

export interface OverdueAgingBuckets {
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90Plus: number;
  totalReceivable: number;
}

function parseIsoDayMs(value: string): number | null {
  const clean = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const [y, m, d] = clean.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Computes Indian Vyapari simple monthly interest (Vyaaj):
 * interest = principal * (monthlyRatePct / 100) * (daysElapsed / 30)
 */
export function calculateMonthlySimpleInterest(params: {
  principal: number;
  monthlyRatePct: number;
  daysElapsed: number;
}): VyaajInterestResult {
  const principal = Math.max(0, Number(params.principal) || 0);
  const monthlyRatePct = Math.max(0, Math.min(25, Number(params.monthlyRatePct) || 0));
  const daysElapsed = Math.max(0, Math.min(3650, Math.round(Number(params.daysElapsed) || 0)));
  const monthsElapsed = Math.round((daysElapsed / 30) * 100) / 100;
  const interestAmount =
    Math.round(principal * (monthlyRatePct / 100) * (daysElapsed / 30) * 100) / 100;
  const totalPayable = Math.round((principal + interestAmount) * 100) / 100;

  return {
    principal,
    monthlyRatePct,
    daysElapsed,
    monthsElapsed,
    interestAmount,
    totalPayable,
  };
}

/**
 * Estimates elapsed days since oldest unsettled debit/credit or account due/activity date.
 */
export function estimateInterestDaysForParty(
  account: LedgerAccount,
  transactions: LedgerTransaction[],
  todayStr: string
): number {
  const todayMs = parseIsoDayMs(todayStr);
  if (todayMs === null) return 30;

  const dueMs = parseIsoDayMs(account.dueDate);
  if (dueMs !== null && todayMs > dueMs) {
    return Math.max(1, Math.round((todayMs - dueMs) / 86_400_000));
  }

  const givenTxs = transactions
    .filter((t) => t.accountId === account.id && t.direction === 'given')
    .map((t) => parseIsoDayMs(t.billDate))
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  if (givenTxs.length > 0 && todayMs >= givenTxs[0]) {
    return Math.max(1, Math.round((todayMs - givenTxs[0]) / 86_400_000));
  }

  return 30;
}

/**
 * Computes receivable aging buckets (0-30, 31-60, 61-90, 90+ days) across positive customer balances.
 */
export function computeOverdueAgingBuckets(
  accounts: LedgerAccount[],
  todayStr: string
): OverdueAgingBuckets {
  const todayMs = parseIsoDayMs(todayStr);
  let bucket0to30 = 0;
  let bucket31to60 = 0;
  let bucket61to90 = 0;
  let bucket90Plus = 0;

  for (const acc of accounts) {
    if (acc.balance <= 0) continue;
    const refStr = acc.dueDate || acc.lastActivityAt;
    const refMs = parseIsoDayMs(refStr);
    const ageDays =
      todayMs !== null && refMs !== null && todayMs > refMs
        ? Math.round((todayMs - refMs) / 86_400_000)
        : 0;

    if (ageDays <= 30) {
      bucket0to30 += acc.balance;
    } else if (ageDays <= 60) {
      bucket31to60 += acc.balance;
    } else if (ageDays <= 90) {
      bucket61to90 += acc.balance;
    } else {
      bucket90Plus += acc.balance;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    bucket0to30: round2(bucket0to30),
    bucket31to60: round2(bucket31to60),
    bucket61to90: round2(bucket61to90),
    bucket90Plus: round2(bucket90Plus),
    totalReceivable: round2(bucket0to30 + bucket31to60 + bucket61to90 + bucket90Plus),
  };
}
