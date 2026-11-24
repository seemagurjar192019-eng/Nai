/**
 * Sprint 5: Modular Domain Service Layer & Business Rule Manager
 * Encapsulates shopkeeper ledger operations, customer trust analytics, galla metrics,
 * and security policy verifications into clean, modular domain services.
 */

import { computeCustomerTrustScore, computeDailyGallaPulse, computeNetCashflowSummary } from './ucred-intelligence';
import type { LedgerAccount, LedgerTransaction, CashbookEntry, BillDocument, StockItem } from './types';

export interface BusinessDomainState {
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  cashbookEntries: CashbookEntry[];
  bills: BillDocument[];
  stockItems: StockItem[];
}

export class UcredDomainManager {
  private state: BusinessDomainState;

  constructor(initialState: BusinessDomainState) {
    this.state = initialState;
  }

  public updateState(newState: Partial<BusinessDomainState>) {
    this.state = { ...this.state, ...newState };
  }

  public getNetCashflow() {
    return computeNetCashflowSummary(this.state.accounts);
  }

  public getGallaPulse(todayStr?: string) {
    return computeDailyGallaPulse({
      todayStr,
      cashbookEntries: this.state.cashbookEntries,
      transactions: this.state.transactions,
      bills: this.state.bills,
      stockItems: this.state.stockItems,
    });
  }

  public getCustomerTrust(accountId: string, todayStr?: string) {
    const account = this.state.accounts.find((a) => a.id === accountId);
    if (!account) return null;
    const accountTxs = this.state.transactions.filter((tx) => tx.accountId === accountId);
    return computeCustomerTrustScore(account, accountTxs, todayStr);
  }

  public getFilteredAccounts(kind: 'customer' | 'supplier' | 'all', search: string = '') {
    const query = search.toLowerCase().trim();
    return this.state.accounts.filter((acc) => {
      if (kind !== 'all' && acc.kind !== kind) return false;
      if (!query) return true;
      return (
        acc.name.toLowerCase().includes(query) ||
        (acc.phone && acc.phone.includes(query)) ||
        (acc.lastNote && acc.lastNote.toLowerCase().includes(query))
      );
    });
  }
}
