import { getLocalDateKey } from './i18n';
import type {
  BillDocument,
  CashbookEntry,
  CustomerTrustScore,
  DailyGallaPulse,
  LedgerAccount,
  LedgerTransaction,
  StockItem,
  TrustBand,
} from './types';

function daysBetweenLocal(fromDateStr: string, toDateStr: string): number | null {
  if (!fromDateStr || !toDateStr) return null;
  const parseYmd = (s: string): number | null => {
    const clean = s.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        return Date.UTC(y, m - 1, d);
      }
    }
    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return null;
    return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };
  const a = parseYmd(fromDateStr);
  const b = parseYmd(toDateStr);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Deterministic Customer Trust Score (0-100) & Recovery Predictor computed offline in pure TypeScript.
 */
export function computeCustomerTrustScore(
  account: LedgerAccount,
  accountTxs: LedgerTransaction[],
  todayStr: string = getLocalDateKey()
): CustomerTrustScore {
  let totalCredit = 0;
  let totalReceived = 0;
  let latestReceivedIso = '';

  for (const tx of accountTxs) {
    if (tx.direction === 'given') {
      totalCredit += tx.amount;
    } else {
      totalReceived += tx.amount;
      if (!latestReceivedIso || tx.billDate > latestReceivedIso) {
        latestReceivedIso = tx.billDate;
      }
    }
  }

  const settledRatio =
    totalCredit > 0
      ? Math.min(1, Math.round((totalReceived / totalCredit) * 100) / 100)
      : account.balance <= 0
      ? 1
      : 0.25;

  const dueDiff = account.dueDate ? daysBetweenLocal(account.dueDate, todayStr) : null;
  const overdueDays = account.balance > 0 && dueDiff !== null && dueDiff > 0 ? dueDiff : 0;

  const promiseDiff = account.promiseDate
    ? daysBetweenLocal(account.promiseDate, todayStr)
    : null;

  const lastPaymentDaysAgo = latestReceivedIso
    ? Math.max(0, daysBetweenLocal(latestReceivedIso, todayStr) ?? 0)
    : null;

  // Base score starts at 80; adjusts deterministically by repayment ratio, overdue severity, limit usage, and promise adherence.
  let score = 78;

  if (account.balance <= 0) {
    score += 18;
  } else {
    // Reward good repayment ratio, penalize zero payments
    score += Math.round((settledRatio - 0.5) * 24);
  }

  if (overdueDays > 0) {
    score -= Math.min(38, overdueDays * 2 + (overdueDays > 15 ? 10 : 0));
  } else if (account.balance > 0 && dueDiff === 0) {
    score -= 4;
  }

  if (account.creditLimit && account.creditLimit > 0 && account.balance > 0) {
    const util = account.balance / account.creditLimit;
    if (util >= 1) score -= 18;
    else if (util >= 0.8) score -= 8;
  }

  if (account.balance > 0 && promiseDiff !== null) {
    if (promiseDiff > 0) {
      // Missed promised repayment date
      score -= Math.min(20, 8 + promiseDiff * 2);
    } else if (promiseDiff === 0) {
      score += 2;
    }
  }

  if (lastPaymentDaysAgo !== null && lastPaymentDaysAgo <= 7 && totalReceived > 0) {
    score += 6;
  } else if (lastPaymentDaysAgo !== null && lastPaymentDaysAgo > 30 && account.balance > 0) {
    score -= 8;
  }

  score = Math.max(5, Math.min(100, Math.round(score)));

  let band: TrustBand = 'reliable';
  if (score < 50) band = 'high-risk';
  else if (score < 70) band = 'watch';

  // Build concise, practical shopkeeper recovery hint
  let recoveryTimingHint = 'No balance due';
  let suggestedTone: 'gentle' | 'firm' | 'urgent' = 'gentle';

  if (account.balance <= 0) {
    recoveryTimingHint =
      account.balance < 0 ? 'Advance deposited · Trusted' : 'Settled on time';
  } else if (promiseDiff !== null && promiseDiff === 0) {
    recoveryTimingHint = 'Promised today · Send UPI link';
    suggestedTone = 'gentle';
  } else if (promiseDiff !== null && promiseDiff > 0) {
    recoveryTimingHint = `Missed promise by ${promiseDiff}d · Call now`;
    suggestedTone = 'urgent';
  } else if (overdueDays >= 10) {
    recoveryTimingHint = `Overdue ${overdueDays}d · Pause new credit`;
    suggestedTone = 'urgent';
  } else if (overdueDays > 0) {
    recoveryTimingHint = `Overdue ${overdueDays}d · Follow up today`;
    suggestedTone = 'firm';
  } else if (dueDiff === 0) {
    recoveryTimingHint = 'Due today · Gentle reminder';
    suggestedTone = 'gentle';
  } else if (account.creditLimit && account.balance >= account.creditLimit) {
    recoveryTimingHint = 'Credit limit crossed · Collect part payment';
    suggestedTone = 'firm';
  } else if (lastPaymentDaysAgo !== null && lastPaymentDaysAgo <= 7) {
    recoveryTimingHint = `Paid ${lastPaymentDaysAgo}d ago · Healthy cycle`;
    suggestedTone = 'gentle';
  } else {
    recoveryTimingHint = 'Active credit · Standard cycle';
    suggestedTone = 'gentle';
  }

  // Higher priorityScore => collect first
  const amountFactor = account.balance > 0 ? Math.min(40, Math.round(Math.log10(account.balance + 1) * 10)) : 0;
  const priorityScore =
    account.balance <= 0
      ? 0
      : Math.max(1, (100 - score) + overdueDays * 3 + amountFactor + (promiseDiff === 0 ? 15 : 0));

  return {
    score,
    band,
    overdueDays,
    settledRatio,
    lastPaymentDaysAgo,
    recoveryTimingHint,
    suggestedTone,
    priorityScore,
  };
}

/**
 * Deterministic Galla (Cash Drawer) & Daily Profit Pulse computed from Cashbook entries,
 * today's receipts/bills, and stock purchase margins.
 */
export function computeDailyGallaPulse(params: {
  todayStr?: string;
  cashbookEntries: CashbookEntry[];
  transactions: LedgerTransaction[];
  bills: BillDocument[];
  stockItems: StockItem[];
}): DailyGallaPulse {
  const todayStr = params.todayStr || getLocalDateKey();

  let cashDrawerBalance = 0;
  let upiBankBalance = 0;
  let todayInflow = 0;
  let todayOutflow = 0;
  let todayExpenses = 0;

  for (const entry of params.cashbookEntries) {
    const signed = entry.entryType === 'inflow' ? entry.amount : -entry.amount;
    if (entry.mode === 'cash') {
      cashDrawerBalance += signed;
    } else {
      upiBankBalance += signed;
    }

    if (entry.entryDate.slice(0, 10) === todayStr) {
      if (entry.entryType === 'inflow') {
        todayInflow += entry.amount;
      } else {
        todayOutflow += entry.amount;
        if (entry.category.toLowerCase() !== 'opening' && entry.category.toLowerCase() !== 'withdrawal') {
          todayExpenses += entry.amount;
        }
      }
    }
  }

  // Compute today's paid bill revenue & stock margin if purchasePrice exists
  let todayPaidBills = 0;
  let todayBillMargin = 0;
  let hasCostData = false;

  const stockMap = new Map<string, StockItem>();
  for (const s of params.stockItems) {
    stockMap.set(s.name.trim().toLowerCase(), s);
  }

  for (const b of params.bills) {
    if (b.docType !== 'bill') continue;
    if (b.billDate.slice(0, 10) !== todayStr) continue;
    if (b.paymentStatus === 'paid' || !b.paymentStatus) {
      todayPaidBills += b.totalAmount;
    }

    if (typeof b.estimatedCost === 'number' && b.estimatedCost > 0) {
      hasCostData = true;
      todayBillMargin += Math.max(0, b.subtotal - b.estimatedCost);
    } else {
      let costForBill = 0;
      let matchedAny = false;
      for (const item of b.items) {
        const matched = item.stockItemId
          ? params.stockItems.find((s) => s.id === item.stockItemId)
          : stockMap.get(item.name.trim().toLowerCase());
        if (matched && matched.purchasePrice && matched.purchasePrice > 0) {
          costForBill += matched.purchasePrice * item.qty;
          matchedAny = true;
        }
      }
      if (matchedAny) {
        hasCostData = true;
        todayBillMargin += Math.max(0, b.subtotal - costForBill);
      }
    }
  }

  // Ledger receipts received today (non-synced ones count toward today's collections view)
  let todayLedgerReceipts = 0;
  for (const tx of params.transactions) {
    if (tx.billDate.slice(0, 10) === todayStr && tx.direction === 'received') {
      todayLedgerReceipts += tx.amount;
    }
  }

  const todayCashSalesAndVasooli = Math.max(todayInflow, todayLedgerReceipts + todayPaidBills);

  // If itemized stock cost exists, profit = gross margin - todayExpenses; otherwise net today cashflow surplus (inflow - outflow)
  const estimatedDailyProfit = hasCostData
    ? Math.round((todayBillMargin - todayExpenses) * 100) / 100
    : Math.round((todayInflow - todayOutflow) * 100) / 100;

  const profitBasisNote = hasCostData
    ? 'Based on stock cost margins minus today expenses'
    : 'Based on today Galla net inflow minus expenses';

  return {
    todayStr,
    cashDrawerBalance: Math.round(cashDrawerBalance * 100) / 100,
    upiBankBalance: Math.round(upiBankBalance * 100) / 100,
    totalLiquidBalance: Math.round((cashDrawerBalance + upiBankBalance) * 100) / 100,
    todayInflow: Math.round(todayInflow * 100) / 100,
    todayOutflow: Math.round(todayOutflow * 100) / 100,
    todayCashSalesAndVasooli: Math.round(todayCashSalesAndVasooli * 100) / 100,
    todayExpenses: Math.round(todayExpenses * 100) / 100,
    estimatedDailyProfit,
    profitBasisNote,
  };
}

export interface NetCashflowSummary {
  totalReceivable: number;
  totalPayable: number;
  netCashflow: number;
  receivableSharePct: number;
  payableSharePct: number;
}

export function computeNetCashflowSummary(accounts: LedgerAccount[]): NetCashflowSummary {
  let receivable = 0;
  let payable = 0;
  for (const acc of accounts) {
    if (acc.balance > 0) receivable += acc.balance;
    else if (acc.balance < 0) payable += Math.abs(acc.balance);
  }
  const totalReceivable = Math.round(receivable * 100) / 100;
  const totalPayable = Math.round(payable * 100) / 100;
  const netCashflow = Math.round((totalReceivable - totalPayable) * 100) / 100;
  const gross = totalReceivable + totalPayable;
  const receivableSharePct = gross > 0 ? Math.round((totalReceivable / gross) * 100) : 50;
  const payableSharePct = gross > 0 ? 100 - receivableSharePct : 50;

  return {
    totalReceivable,
    totalPayable,
    netCashflow,
    receivableSharePct,
    payableSharePct,
  };
}

export interface DuePartySpotlight {
  account: LedgerAccount;
  trustScore: number;
  urgencyLabel: string;
  isDueTodayOrOverdue: boolean;
}

/**
 * Selects top N due parties for the expandable Net Receivable Hero drawer,
 * ranking due-today and overdue parties ahead of general pending balances.
 */
export function getTopDuePartiesToday(
  accounts: LedgerAccount[],
  trustScoresByAccount: Record<string, CustomerTrustScore>,
  todayStr: string = getLocalDateKey(),
  limit: number = 3
): DuePartySpotlight[] {
  const candidates = accounts
    .filter((a) => a.balance > 0)
    .map((account) => {
      const trust = trustScoresByAccount[account.id];
      const trustScore = trust?.score ?? 100;
      const due = account.dueDate ? account.dueDate.slice(0, 10) : '';
      const diff = due ? daysBetweenLocal(due, todayStr) : null;
      const isOverdue = diff !== null && diff > 0;
      const isDueToday = diff === 0;
      const promiseToday = account.promiseDate?.slice(0, 10) === todayStr;

      let urgencyLabel = 'Pending due';
      let rankWeight = 0;

      if (promiseToday) {
        urgencyLabel = 'Promised today';
        rankWeight = 4000;
      } else if (isDueToday) {
        urgencyLabel = 'Due today';
        rankWeight = 3500;
      } else if (isOverdue && diff !== null) {
        urgencyLabel = `Overdue ${diff}d`;
        rankWeight = 3000 + Math.min(500, diff * 10);
      } else if (due) {
        urgencyLabel = `Due ${due}`;
        rankWeight = 1000;
      }

      const priority = trust?.priorityScore ?? 0;
      const sortMetric = rankWeight + priority * 5 + Math.min(999, Math.round(account.balance / 10));

      return {
        account,
        trustScore,
        urgencyLabel,
        isDueTodayOrOverdue: isOverdue || isDueToday || promiseToday,
        sortMetric,
      };
    });

  candidates.sort((a, b) => b.sortMetric - a.sortMetric || b.account.balance - a.account.balance);

  return candidates.slice(0, Math.max(0, limit)).map((item) => ({
    account: item.account,
    trustScore: item.trustScore,
    urgencyLabel: item.urgencyLabel,
    isDueTodayOrOverdue: item.isDueTodayOrOverdue,
  }));
}

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'backspace'
  | 'clear'
  | '+100'
  | '+500'
  | '+2000';

/**
 * Pure tactile numeric keypad state transition for Quick Entry without popping OS soft keyboard.
 */
export function applyKeypadKey(current: string, key: KeypadKey, maxIntegerDigits: number = 7): string {
  if (key === 'clear') return '';

  if (key === 'backspace') {
    return current.length > 0 ? current.slice(0, -1) : '';
  }

  if (key === '+100' || key === '+500' || key === '+2000') {
    const add = Number(key.slice(1));
    const base = Number(current);
    const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
    const next = Math.round((safeBase + add) * 100) / 100;
    const cap = Math.pow(10, maxIntegerDigits) - 0.01;
    const clamped = Math.min(cap, next);
    return Number.isInteger(clamped) ? String(clamped) : String(clamped);
  }

  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }

  // Digit '0'..'9'
  const dotIdx = current.indexOf('.');
  if (dotIdx !== -1) {
    // Allow at most 2 decimal places
    const decimals = current.slice(dotIdx + 1);
    if (decimals.length >= 2) return current;
    return `${current}${key}`;
  }

  if (current === '0') {
    return key === '0' ? '0' : key;
  }

  if (current.length >= maxIntegerDigits) {
    return current;
  }

  return `${current}${key}`;
}

