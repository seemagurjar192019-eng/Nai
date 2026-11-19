import type {
  AccountKind,
  ActivityActionType,
  ActivityLog,
  AppearanceMode,
  BillDocType,
  BillDocument,
  BillLineItem,
  BillPaymentStatus,
  BillTemplateId,
  Business,
  CashbookEntry,
  CashbookEntryType,
  CashbookMode,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  StaffMember,
  StaffRole,
  StockItem,
  TxDirection,
} from './types';
import { getLocalDateKey } from './i18n';

export const GUEST_VAULT_STORAGE_KEY = 'ucred_guest_vault_v1';
export const GUEST_OWNER_ID = 'guest';
export const DEFAULT_GUEST_BUSINESS_ID = 'guest_biz_1';

export interface GuestProfileState {
  mobileNumber: string;
  language: LanguageCode;
  appearance: AppearanceMode;
  activeBusinessId: string;
  appLockPin: string;
}

export interface GuestVaultState {
  version: 1;
  profile: GuestProfileState;
  businesses: Business[];
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  bills: BillDocument[];
  stockItems: StockItem[];
  cashbookEntries: CashbookEntry[];
  staffMembers: StaffMember[];
  activityLogs: ActivityLog[];
}

function makeGuestId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  return String(val || '').trim().slice(0, maxLen);
}

export function createStarterGuestBusiness(name = 'My Store'): Business {
  return {
    id: DEFAULT_GUEST_BUSINESS_ID,
    ownerId: GUEST_OWNER_ID,
    name: clampStr(name, 120) || 'My Store',
    phone: '',
    gstNumber: '',
    businessType: 'Retail / Kirana',
    category: 'General Store',
    address: '',
    email: '',
    about: '',
    upiId: '',
  };
}

export function createInitialGuestVault(
  prelogin?: Partial<Pick<GuestProfileState, 'language' | 'appearance' | 'mobileNumber'>>
): GuestVaultState {
  const starter = createStarterGuestBusiness('My Store');
  return {
    version: 1,
    profile: {
      mobileNumber: clampStr(prelogin?.mobileNumber, 20),
      language: prelogin?.language || 'en',
      appearance: prelogin?.appearance === 'dark' ? 'dark' : 'light',
      activeBusinessId: starter.id,
      appLockPin: '',
    },
    businesses: [starter],
    accounts: [],
    transactions: [],
    bills: [],
    stockItems: [],
    cashbookEntries: [],
    staffMembers: [],
    activityLogs: [],
  };
}

let inMemoryFallbackVault: GuestVaultState | null = null;

export function loadGuestVault(
  prelogin?: Partial<Pick<GuestProfileState, 'language' | 'appearance' | 'mobileNumber'>>
): GuestVaultState {
  if (typeof window === 'undefined') {
    if (!inMemoryFallbackVault) inMemoryFallbackVault = createInitialGuestVault(prelogin);
    return inMemoryFallbackVault;
  }
  try {
    const raw = window.localStorage.getItem(GUEST_VAULT_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialGuestVault(prelogin);
      window.localStorage.setItem(GUEST_VAULT_STORAGE_KEY, JSON.stringify(fresh));
      inMemoryFallbackVault = fresh;
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<GuestVaultState>;
    const businesses =
      Array.isArray(parsed.businesses) && parsed.businesses.length > 0
        ? parsed.businesses
        : [createStarterGuestBusiness('My Store')];
    const activeId =
      parsed.profile?.activeBusinessId &&
      businesses.some((b) => b.id === parsed.profile?.activeBusinessId)
        ? parsed.profile.activeBusinessId
        : businesses[0].id;
    const normalized: GuestVaultState = {
      version: 1,
      profile: {
        mobileNumber: clampStr(parsed.profile?.mobileNumber ?? prelogin?.mobileNumber, 20),
        language: parsed.profile?.language || prelogin?.language || 'en',
        appearance:
          parsed.profile?.appearance === 'dark'
            ? 'dark'
            : parsed.profile?.appearance === 'light'
              ? 'light'
              : prelogin?.appearance === 'dark'
                ? 'dark'
                : 'light',
        activeBusinessId: activeId,
        appLockPin: clampStr(parsed.profile?.appLockPin, 128),
      },
      businesses,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      stockItems: Array.isArray(parsed.stockItems) ? parsed.stockItems : [],
      cashbookEntries: Array.isArray(parsed.cashbookEntries) ? parsed.cashbookEntries : [],
      staffMembers: Array.isArray(parsed.staffMembers) ? parsed.staffMembers : [],
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
    };
    inMemoryFallbackVault = normalized;
    return normalized;
  } catch {
    if (!inMemoryFallbackVault) inMemoryFallbackVault = createInitialGuestVault(prelogin);
    return inMemoryFallbackVault;
  }
}

export function saveGuestVault(vault: GuestVaultState): GuestVaultState {
  inMemoryFallbackVault = vault;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GUEST_VAULT_STORAGE_KEY, JSON.stringify(vault));
    } catch {
      // Ignore quota errors cleanly and rely on in-memory vault
    }
  }
  return vault;
}

export function clearGuestVault(): void {
  inMemoryFallbackVault = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(GUEST_VAULT_STORAGE_KEY);
    } catch {
      // Ignore removal error
    }
  }
}

export function hasGuestRecordsToSync(vault: GuestVaultState | null | undefined): boolean {
  if (!vault) return false;
  if (
    vault.accounts.length > 0 ||
    vault.transactions.length > 0 ||
    vault.bills.length > 0 ||
    vault.stockItems.length > 0 ||
    vault.cashbookEntries.length > 0 ||
    vault.staffMembers.length > 0
  ) {
    return true;
  }
  if (vault.businesses.length > 1) return true;
  const firstBiz = vault.businesses[0];
  if (
    firstBiz &&
    (firstBiz.name !== 'My Store' ||
      Boolean(firstBiz.upiId) ||
      Boolean(firstBiz.gstNumber) ||
      Boolean(firstBiz.address))
  ) {
    return true;
  }
  return false;
}

export function applyCreateBusiness(
  vault: GuestVaultState,
  input: { name: string; phone?: string; category?: string; upiId?: string }
): { vault: GuestVaultState; created: Business } {
  const id = makeGuestId('guest_biz');
  const created: Business = {
    id,
    ownerId: GUEST_OWNER_ID,
    name: clampStr(input.name || 'My Shop', 120) || 'My Shop',
    phone: clampStr(input.phone, 20),
    gstNumber: '',
    businessType: 'Retail / Kirana',
    category: clampStr(input.category, 60) || 'General Store',
    address: '',
    email: '',
    about: '',
    upiId: clampStr(input.upiId, 100),
  };
  return {
    created,
    vault: {
      ...vault,
      businesses: [...vault.businesses, created],
      profile: { ...vault.profile, activeBusinessId: id },
    },
  };
}

export function applyUpdateBusiness(
  vault: GuestVaultState,
  businessId: string,
  patch: Partial<
    Pick<
      Business,
      'name' | 'phone' | 'gstNumber' | 'businessType' | 'category' | 'address' | 'email' | 'about' | 'upiId'
    >
  >
): GuestVaultState {
  return {
    ...vault,
    businesses: vault.businesses.map((b) =>
      b.id !== businessId
        ? b
        : {
            ...b,
            ...(patch.name !== undefined ? { name: clampStr(patch.name, 120) || 'My Store' } : {}),
            ...(patch.phone !== undefined ? { phone: clampStr(patch.phone, 20) } : {}),
            ...(patch.gstNumber !== undefined ? { gstNumber: clampStr(patch.gstNumber, 24) } : {}),
            ...(patch.businessType !== undefined
              ? { businessType: clampStr(patch.businessType, 60) }
              : {}),
            ...(patch.category !== undefined ? { category: clampStr(patch.category, 60) } : {}),
            ...(patch.address !== undefined ? { address: clampStr(patch.address, 240) } : {}),
            ...(patch.email !== undefined ? { email: clampStr(patch.email, 120) } : {}),
            ...(patch.about !== undefined ? { about: clampStr(patch.about, 300) } : {}),
            ...(patch.upiId !== undefined ? { upiId: clampStr(patch.upiId, 100) } : {}),
          }
    ),
  };
}

export function applyClearBusinessData(vault: GuestVaultState, businessId: string): GuestVaultState {
  return {
    ...vault,
    accounts: vault.accounts.filter((a) => a.businessId !== businessId),
    transactions: vault.transactions.filter((t) => t.businessId !== businessId),
    bills: vault.bills.filter((b) => b.businessId !== businessId),
    stockItems: vault.stockItems.filter((s) => s.businessId !== businessId),
    cashbookEntries: vault.cashbookEntries.filter((c) => c.businessId !== businessId),
    staffMembers: vault.staffMembers.filter((s) => s.businessId !== businessId),
    activityLogs: vault.activityLogs.filter((l) => l.businessId !== businessId),
  };
}

export function applyDeleteBusinessCascade(
  vault: GuestVaultState,
  businessId: string
): GuestVaultState {
  const cleared = applyClearBusinessData(vault, businessId);
  const remainingBusinesses = cleared.businesses.filter((b) => b.id !== businessId);
  const finalBusinesses =
    remainingBusinesses.length > 0 ? remainingBusinesses : [createStarterGuestBusiness('My Store')];
  const nextActiveId =
    cleared.profile.activeBusinessId === businessId
      ? finalBusinesses[0].id
      : cleared.profile.activeBusinessId;
  return {
    ...cleared,
    businesses: finalBusinesses,
    profile: { ...cleared.profile, activeBusinessId: nextActiveId },
  };
}

export function applyCreateAccount(
  vault: GuestVaultState,
  params: {
    businessId: string;
    kind: AccountKind;
    name: string;
    phone?: string;
    dueDate?: string;
    creditLimit?: number;
  }
): { vault: GuestVaultState; created: LedgerAccount } {
  const cleanName = clampStr(params.name, 100);
  if (!cleanName) throw new Error('Party name is required.');
  const limitVal =
    params.creditLimit && params.creditLimit > 0
      ? Math.min(100000000, Math.round(params.creditLimit))
      : 0;
  const created: LedgerAccount = {
    id: makeGuestId('acc'),
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    kind: params.kind,
    name: cleanName,
    phone: clampStr(params.phone, 20),
    dueDate: clampStr(params.dueDate, 24),
    ...(limitVal > 0 ? { creditLimit: limitVal } : {}),
    balance: 0,
    lastNote: 'Added Today',
    lastActivityAt: new Date().toISOString(),
  };
  return {
    created,
    vault: {
      ...vault,
      accounts: [created, ...vault.accounts],
    },
  };
}

export function applyUpdateAccountMeta(
  vault: GuestVaultState,
  accountId: string,
  patch: Partial<
    Pick<
      LedgerAccount,
      'name' | 'phone' | 'dueDate' | 'kind' | 'creditLimit' | 'promiseDate' | 'promiseNote'
    >
  >
): GuestVaultState {
  return {
    ...vault,
    accounts: vault.accounts.map((acc) => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        ...(patch.name !== undefined ? { name: clampStr(patch.name, 100) || 'Customer' } : {}),
        ...(patch.phone !== undefined ? { phone: clampStr(patch.phone, 20) } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: clampStr(patch.dueDate, 24) } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.promiseDate !== undefined
          ? { promiseDate: clampStr(patch.promiseDate, 24) }
          : {}),
        ...(patch.promiseNote !== undefined
          ? { promiseNote: clampStr(patch.promiseNote, 160) }
          : {}),
        ...(patch.creditLimit !== undefined
          ? {
              creditLimit: Math.min(100000000, Math.max(0, Math.round(Number(patch.creditLimit) || 0))),
            }
          : {}),
      };
    }),
  };
}

export function applyAddTransactionAtomic(
  vault: GuestVaultState,
  params: {
    businessId: string;
    existingAccount?: LedgerAccount | null;
    customerName: string;
    kind?: AccountKind;
    direction: TxDirection;
    amount: number;
    note?: string;
    billDate?: string;
    voiceRaw?: string;
    billImage?: string;
    createdByName?: string;
    createdByRole?: StaffRole;
    syncToGalla?: { mode: CashbookMode } | null;
  }
): {
  vault: GuestVaultState;
  accountId: string;
  txId: string;
  newBalance: number;
  tx: LedgerTransaction;
  account: LedgerAccount;
  accountCreated: boolean;
} {
  const cleanAmount = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero');

  const nowIso = params.billDate || new Date().toISOString();
  const delta = params.direction === 'given' ? cleanAmount : -cleanAmount;
  const txId = makeGuestId('tx');
  const noteSummary =
    clampStr(params.note, 160) ||
    `${params.direction === 'given' ? 'Credit' : 'Payment'} ₹${cleanAmount.toLocaleString('en-IN')}`;
  const shouldSyncGalla = Boolean(params.syncToGalla);

  let nextAccounts: LedgerAccount[];
  let resolvedAccount: LedgerAccount;
  let accountCreated = false;

  const liveMatch = params.existingAccount
    ? vault.accounts.find((a) => a.id === params.existingAccount?.id) || params.existingAccount
    : null;

  if (liveMatch) {
    const nextBalance = Math.round((liveMatch.balance + delta) * 100) / 100;
    resolvedAccount = {
      ...liveMatch,
      balance: nextBalance,
      lastNote: noteSummary,
      lastActivityAt: nowIso,
    };
    const existsInVault = vault.accounts.some((a) => a.id === liveMatch.id);
    nextAccounts = existsInVault
      ? vault.accounts.map((a) => (a.id === liveMatch.id ? resolvedAccount : a))
      : [resolvedAccount, ...vault.accounts];
  } else {
    accountCreated = true;
    const accId = makeGuestId('acc');
    resolvedAccount = {
      id: accId,
      ownerId: GUEST_OWNER_ID,
      businessId: params.businessId,
      kind: params.kind || 'customer',
      name: clampStr(params.customerName, 100) || 'Customer',
      phone: '',
      dueDate: '',
      balance: delta,
      lastNote: noteSummary,
      lastActivityAt: nowIso,
    };
    nextAccounts = [resolvedAccount, ...vault.accounts];
  }

  const tx: LedgerTransaction = {
    id: txId,
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    accountId: resolvedAccount.id,
    direction: params.direction,
    amount: cleanAmount,
    note: clampStr(params.note, 240),
    billDate: clampStr(nowIso, 40),
    voiceRaw: clampStr(params.voiceRaw, 300),
    billImage: clampStr(params.billImage, 150000),
    ...(params.createdByName ? { createdByName: clampStr(params.createdByName, 80) } : {}),
    ...(params.createdByRole ? { createdByRole: params.createdByRole } : {}),
    ...(shouldSyncGalla ? { gallaSynced: true } : {}),
  };

  let nextCashbook = vault.cashbookEntries;
  if (params.syncToGalla) {
    const cbId = makeGuestId('cb');
    const entryType: CashbookEntryType =
      params.direction === 'received' ? 'inflow' : 'outflow';
    const partyKind = resolvedAccount.kind;
    const category =
      params.direction === 'received'
        ? partyKind === 'customer'
          ? 'Vasooli'
          : 'Supplier Refund'
        : partyKind === 'supplier'
          ? 'Supplier Pay'
          : 'Cash Credit';

    nextCashbook = [
      {
        id: cbId,
        ownerId: GUEST_OWNER_ID,
        businessId: params.businessId,
        entryType,
        mode: params.syncToGalla.mode,
        category,
        amount: cleanAmount,
        note: clampStr(`${resolvedAccount.name}: ${noteSummary}`, 200),
        entryDate: clampStr(nowIso, 40),
        linkedRefId: txId,
        ...(params.createdByName ? { actorName: clampStr(params.createdByName, 80) } : {}),
      },
      ...vault.cashbookEntries,
    ];
  }

  return {
    accountId: resolvedAccount.id,
    txId,
    newBalance: resolvedAccount.balance,
    tx,
    account: resolvedAccount,
    accountCreated,
    vault: {
      ...vault,
      accounts: nextAccounts,
      transactions: [tx, ...vault.transactions],
      cashbookEntries: nextCashbook,
    },
  };
}

function recalculateAccountSummary(
  account: LedgerAccount,
  accountTxs: LedgerTransaction[]
): LedgerAccount {
  if (accountTxs.length === 0) {
    return {
      ...account,
      balance: 0,
      lastNote: 'No recent transactions',
    };
  }
  const sorted = [...accountTxs].sort((a, b) => b.billDate.localeCompare(a.billDate));
  let nextBalance = 0;
  for (const item of sorted) {
    nextBalance += item.direction === 'given' ? item.amount : -item.amount;
  }
  nextBalance = Math.round(nextBalance * 100) / 100;
  const latest = sorted[0];
  const lastNote =
    clampStr(latest.note, 160) ||
    `${latest.direction === 'given' ? 'Credit' : 'Payment'} ₹${latest.amount.toLocaleString('en-IN')}`;
  return {
    ...account,
    balance: nextBalance,
    lastNote,
    lastActivityAt: latest.billDate || account.lastActivityAt,
  };
}

export function applyUpdateTransactionAtomic(
  vault: GuestVaultState,
  params: {
    tx: LedgerTransaction;
    account: LedgerAccount;
    patch: {
      direction: TxDirection;
      amount: number;
      note: string;
      billDate: string;
      billImage?: string;
    };
  }
): GuestVaultState {
  const cleanAmount = Math.round((Number(params.patch.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero');

  const updatedTx: LedgerTransaction = {
    ...params.tx,
    direction: params.patch.direction,
    amount: cleanAmount,
    note: clampStr(params.patch.note, 240),
    billDate: clampStr(params.patch.billDate || params.tx.billDate, 40),
    billImage:
      params.patch.billImage !== undefined
        ? clampStr(params.patch.billImage, 150000)
        : params.tx.billImage,
  };

  const nextTransactions = vault.transactions.map((t) =>
    t.id === params.tx.id ? updatedTx : t
  );
  const forAccount = nextTransactions.filter((t) => t.accountId === params.account.id);
  const nextAccounts = vault.accounts.map((a) =>
    a.id === params.account.id ? recalculateAccountSummary(a, forAccount) : a
  );
  return {
    ...vault,
    transactions: nextTransactions,
    accounts: nextAccounts,
  };
}

export function applyRestoreTransactionAtomic(
  vault: GuestVaultState,
  params: { tx: LedgerTransaction; account: LedgerAccount }
): GuestVaultState {
  const restored: LedgerTransaction = {
    ...params.tx,
    id: makeGuestId('tx'),
  };
  const nextTransactions = [
    restored,
    ...vault.transactions.filter((t) => t.id !== params.tx.id),
  ];
  const forAccount = nextTransactions.filter((t) => t.accountId === params.account.id);
  const nextAccounts = vault.accounts.map((a) =>
    a.id === params.account.id ? recalculateAccountSummary(a, forAccount) : a
  );
  return {
    ...vault,
    transactions: nextTransactions,
    accounts: nextAccounts,
  };
}

export function applyDeleteTransactionAtomic(
  vault: GuestVaultState,
  params: { tx: LedgerTransaction; account: LedgerAccount }
): GuestVaultState {
  const nextTransactions = vault.transactions.filter((t) => t.id !== params.tx.id);
  const forAccount = nextTransactions.filter((t) => t.accountId === params.account.id);
  const nextAccounts = vault.accounts.map((a) =>
    a.id === params.account.id ? recalculateAccountSummary(a, forAccount) : a
  );
  return {
    ...vault,
    transactions: nextTransactions,
    accounts: nextAccounts,
  };
}

export function applyDeleteAccountWithTransactions(
  vault: GuestVaultState,
  accountId: string
): GuestVaultState {
  return {
    ...vault,
    accounts: vault.accounts.filter((a) => a.id !== accountId),
    transactions: vault.transactions.filter((t) => t.accountId !== accountId),
  };
}

export function applySaveBillDocument(
  vault: GuestVaultState,
  params: {
    businessId: string;
    docType: BillDocType;
    billNumber: string;
    customerName: string;
    customerPhone: string;
    items: BillLineItem[];
    discountAmount?: number;
    paymentStatus?: BillPaymentStatus;
    linkedTxId?: string;
    createdByName?: string;
    syncToGalla?: { mode: CashbookMode } | null;
    templateId: BillTemplateId;
    notes: string;
    billDate: string;
  }
): { vault: GuestVaultState; billId: string; deductedCount: number } {
  const billId = makeGuestId('bill');
  const rawFiltered = params.items.filter((i) => i.name.trim()).slice(0, 20);
  const cleanItems = rawFiltered.map((i) => ({
    name: clampStr(i.name, 80),
    qty: Math.max(0.01, Number(i.qty) || 1),
    rate: Math.max(0, Number(i.rate) || 0),
    gstRate: Math.max(0, Number(i.gstRate) || 0),
    ...(i.stockItemId ? { stockItemId: clampStr(i.stockItemId, 128) } : {}),
  }));
  if (cleanItems.length === 0) throw new Error('Add at least one item to the bill.');

  const subtotal =
    Math.round(cleanItems.reduce((sum, i) => sum + i.qty * i.rate, 0) * 100) / 100;
  const totalGst =
    Math.round(
      cleanItems.reduce((sum, i) => sum + (i.qty * i.rate * i.gstRate) / 100, 0) * 100
    ) / 100;
  const discountAmount = Math.max(
    0,
    Math.min(subtotal + totalGst, Math.round((Number(params.discountAmount) || 0) * 100) / 100)
  );
  const totalAmount = Math.max(
    0,
    Math.round((subtotal + totalGst - discountAmount) * 100) / 100
  );
  const paymentStatus: BillPaymentStatus = params.paymentStatus || 'paid';

  const bizStock = vault.stockItems.filter((s) => s.businessId === params.businessId);
  let estimatedCost = 0;
  for (const line of rawFiltered) {
    const matched = line.stockItemId
      ? bizStock.find((s) => s.id === line.stockItemId)
      : bizStock.find(
          (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
        );
    if (matched && matched.purchasePrice && matched.purchasePrice > 0) {
      estimatedCost += matched.purchasePrice * Math.max(0, Number(line.qty) || 0);
    }
  }
  estimatedCost = Math.round(estimatedCost * 100) / 100;

  const billDoc: BillDocument = {
    id: billId,
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    docType: params.docType,
    billNumber: clampStr(params.billNumber, 40) || 'INV-001',
    customerName: clampStr(params.customerName, 100) || 'Walk-in Customer',
    customerPhone: clampStr(params.customerPhone, 20),
    items: cleanItems,
    subtotal,
    totalGst,
    discountAmount,
    totalAmount,
    paymentStatus,
    ...(params.linkedTxId ? { linkedTxId: clampStr(params.linkedTxId, 128) } : {}),
    ...(params.createdByName ? { createdByName: clampStr(params.createdByName, 80) } : {}),
    ...(estimatedCost > 0 ? { estimatedCost } : {}),
    templateId: params.templateId,
    notes: clampStr(params.notes, 240),
    billDate: clampStr(params.billDate, 40),
  };

  let nextCashbook = vault.cashbookEntries;
  if (
    params.docType === 'bill' &&
    paymentStatus === 'paid' &&
    params.syncToGalla &&
    totalAmount > 0
  ) {
    nextCashbook = [
      {
        id: makeGuestId('cb'),
        ownerId: GUEST_OWNER_ID,
        businessId: params.businessId,
        entryType: 'inflow',
        mode: params.syncToGalla.mode,
        category: 'Bill Sale',
        amount: totalAmount,
        note: clampStr(`${billDoc.billNumber} · ${billDoc.customerName}`, 200),
        entryDate: clampStr(params.billDate, 40),
        linkedRefId: billId,
        ...(params.createdByName ? { actorName: clampStr(params.createdByName, 80) } : {}),
      },
      ...vault.cashbookEntries,
    ];
  }

  let deductedCount = 0;
  let nextStock = vault.stockItems;
  if (params.docType === 'bill' && bizStock.length > 0) {
    const deductMap = new Map<string, number>();
    for (const line of rawFiltered) {
      const matched = line.stockItemId
        ? bizStock.find((s) => s.id === line.stockItemId)
        : bizStock.find(
            (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
          );
      if (matched) {
        deductMap.set(
          matched.id,
          (deductMap.get(matched.id) || 0) + Math.max(0, Number(line.qty) || 0)
        );
      }
    }
    if (deductMap.size > 0) {
      nextStock = vault.stockItems.map((item) => {
        const soldQty = deductMap.get(item.id) || 0;
        if (soldQty <= 0) return item;
        deductedCount++;
        return {
          ...item,
          quantity: Math.max(0, Math.round((item.quantity - soldQty) * 100) / 100),
        };
      });
    }
  }

  return {
    billId,
    deductedCount,
    vault: {
      ...vault,
      bills: [billDoc, ...vault.bills],
      cashbookEntries: nextCashbook,
      stockItems: nextStock,
    },
  };
}

export function applyConvertQuoteToBill(
  vault: GuestVaultState,
  params: { quote: BillDocument; newBillNumber: string }
): { vault: GuestVaultState; deductedCount: number } {
  const bizStock = vault.stockItems.filter((s) => s.businessId === params.quote.businessId);
  const deductMap = new Map<string, number>();
  for (const line of params.quote.items) {
    const matched = bizStock.find(
      (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
    );
    if (matched) {
      deductMap.set(
        matched.id,
        (deductMap.get(matched.id) || 0) + Math.max(0, Number(line.qty) || 0)
      );
    }
  }

  let deductedCount = 0;
  const nextStock = vault.stockItems.map((item) => {
    const soldQty = deductMap.get(item.id) || 0;
    if (soldQty <= 0) return item;
    deductedCount++;
    return {
      ...item,
      quantity: Math.max(0, Math.round((item.quantity - soldQty) * 100) / 100),
    };
  });

  const nextBills = vault.bills.map((b) =>
    b.id === params.quote.id
      ? {
          ...b,
          docType: 'bill' as const,
          billNumber: clampStr(params.newBillNumber, 40) || params.quote.billNumber,
          billDate: getLocalDateKey(),
        }
      : b
  );

  return {
    deductedCount,
    vault: {
      ...vault,
      bills: nextBills,
      stockItems: nextStock,
    },
  };
}

export function applyDeleteBillDocument(vault: GuestVaultState, billId: string): GuestVaultState {
  return {
    ...vault,
    bills: vault.bills.filter((b) => b.id !== billId),
  };
}

export function applySaveStockItem(
  vault: GuestVaultState,
  params: {
    businessId: string;
    existingId?: string;
    name: string;
    unit: string;
    salePrice: number;
    purchasePrice?: number;
    quantity: number;
    lowStockThreshold: number;
  }
): { vault: GuestVaultState; itemId: string } {
  const cleanPurchase = Math.max(0, Number(params.purchasePrice) || 0);
  if (params.existingId) {
    return {
      itemId: params.existingId,
      vault: {
        ...vault,
        stockItems: vault.stockItems.map((item) =>
          item.id === params.existingId
            ? {
                ...item,
                name: clampStr(params.name, 100) || 'Item',
                unit: clampStr(params.unit, 24) || 'pcs',
                salePrice: Math.max(0, Number(params.salePrice) || 0),
                purchasePrice: cleanPurchase,
                quantity: Math.max(0, Number(params.quantity) || 0),
                lowStockThreshold: Math.max(0, Number(params.lowStockThreshold) || 0),
              }
            : item
        ),
      },
    };
  }
  const id = makeGuestId('stk');
  const created: StockItem = {
    id,
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    name: clampStr(params.name, 100) || 'Item',
    unit: clampStr(params.unit, 24) || 'pcs',
    salePrice: Math.max(0, Number(params.salePrice) || 0),
    purchasePrice: cleanPurchase,
    quantity: Math.max(0, Number(params.quantity) || 0),
    lowStockThreshold: Math.max(0, Number(params.lowStockThreshold) || 0),
  };
  return {
    itemId: id,
    vault: {
      ...vault,
      stockItems: [created, ...vault.stockItems],
    },
  };
}

export function applyDeleteStockItem(vault: GuestVaultState, itemId: string): GuestVaultState {
  return {
    ...vault,
    stockItems: vault.stockItems.filter((s) => s.id !== itemId),
  };
}

export function applyAddCashbookEntry(
  vault: GuestVaultState,
  params: {
    businessId: string;
    entryType: CashbookEntryType;
    mode: CashbookMode;
    category: string;
    amount: number;
    note?: string;
    entryDate?: string;
    linkedRefId?: string;
    actorName?: string;
  }
): { vault: GuestVaultState; entryId: string } {
  const cleanAmount = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero.');
  const id = makeGuestId('cb');
  const created: CashbookEntry = {
    id,
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    entryType: params.entryType,
    mode: params.mode,
    category: clampStr(params.category, 40) || 'General',
    amount: cleanAmount,
    note: clampStr(params.note, 200),
    entryDate: clampStr(params.entryDate || new Date().toISOString(), 40),
    ...(params.linkedRefId ? { linkedRefId: clampStr(params.linkedRefId, 128) } : {}),
    ...(params.actorName ? { actorName: clampStr(params.actorName, 80) } : {}),
  };
  return {
    entryId: id,
    vault: {
      ...vault,
      cashbookEntries: [created, ...vault.cashbookEntries],
    },
  };
}

export function applyDeleteCashbookEntry(
  vault: GuestVaultState,
  entryId: string
): GuestVaultState {
  return {
    ...vault,
    cashbookEntries: vault.cashbookEntries.filter((c) => c.id !== entryId),
  };
}

export function applySaveStaffMember(
  vault: GuestVaultState,
  params: {
    businessId: string;
    existingId?: string;
    name: string;
    role: StaffRole;
    phone?: string;
    pinHash?: string;
    active: boolean;
  }
): { vault: GuestVaultState; staffId: string } {
  if (params.existingId) {
    return {
      staffId: params.existingId,
      vault: {
        ...vault,
        staffMembers: vault.staffMembers.map((st) =>
          st.id === params.existingId
            ? {
                ...st,
                name: clampStr(params.name, 80) || 'Staff',
                role: params.role,
                phone: clampStr(params.phone, 20),
                active: params.active,
                ...(params.pinHash !== undefined
                  ? { pinHash: clampStr(params.pinHash, 128) }
                  : {}),
              }
            : st
        ),
      },
    };
  }
  const id = makeGuestId('stf');
  const created: StaffMember = {
    id,
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    name: clampStr(params.name, 80) || 'Staff',
    role: params.role,
    phone: clampStr(params.phone, 20),
    ...(params.pinHash ? { pinHash: clampStr(params.pinHash, 128) } : {}),
    active: params.active,
  };
  return {
    staffId: id,
    vault: {
      ...vault,
      staffMembers: [created, ...vault.staffMembers],
    },
  };
}

export function applyDeleteStaffMember(
  vault: GuestVaultState,
  staffId: string
): GuestVaultState {
  return {
    ...vault,
    staffMembers: vault.staffMembers.filter((s) => s.id !== staffId),
  };
}

export function applyRecordActivityLog(
  vault: GuestVaultState,
  params: {
    businessId: string;
    actorName: string;
    actorRole: StaffRole;
    actionType: ActivityActionType;
    summary: string;
    targetName?: string;
    amount?: number;
  }
): GuestVaultState {
  const log: ActivityLog = {
    id: makeGuestId('log'),
    ownerId: GUEST_OWNER_ID,
    businessId: params.businessId,
    actorName: clampStr(params.actorName, 80) || 'Shop Owner',
    actorRole: params.actorRole,
    actionType: params.actionType,
    summary: clampStr(params.summary, 240) || 'Action recorded',
    targetName: clampStr(params.targetName, 100),
    ...(params.amount !== undefined && params.amount >= 0
      ? { amount: Math.min(100000000, Math.round(Number(params.amount) * 100) / 100) }
      : {}),
    createdAt: new Date().toISOString(),
  };
  return {
    ...vault,
    activityLogs: [log, ...vault.activityLogs].slice(0, 200),
  };
}

export function applyRestoreBusinessBackup(
  vault: GuestVaultState,
  businessId: string,
  rawParsed: unknown
): {
  vault: GuestVaultState;
  counts: { accounts: number; transactions: number; bills: number; stockItems: number };
} {
  if (!rawParsed || typeof rawParsed !== 'object') {
    throw new Error('Invalid JSON backup structure.');
  }
  const parsed = rawParsed as {
    accounts?: unknown[];
    transactions?: unknown[];
    bills?: unknown[];
    stockItems?: unknown[];
    cashbookEntries?: unknown[];
  };
  if (
    !Array.isArray(parsed.accounts) &&
    !Array.isArray(parsed.transactions) &&
    !Array.isArray(parsed.bills) &&
    !Array.isArray(parsed.stockItems) &&
    !Array.isArray(parsed.cashbookEntries)
  ) {
    throw new Error(
      'Backup JSON must contain accounts, transactions, bills, stockItems, or cashbookEntries.'
    );
  }

  const accIdMap = new Map<string, string>();
  const addedAccs: LedgerAccount[] = [];
  const addedTxs: LedgerTransaction[] = [];
  const addedBills: BillDocument[] = [];
  const addedStock: StockItem[] = [];
  const addedCashbook: CashbookEntry[] = [];

  if (Array.isArray(parsed.accounts)) {
    for (const rawAcc of parsed.accounts) {
      if (!rawAcc || typeof rawAcc !== 'object') continue;
      const a = rawAcc as Record<string, unknown>;
      const name = clampStr(String(a.name || ''), 100);
      if (!name) continue;
      const oldId = String(a.id || makeGuestId('old'));
      const newId = makeGuestId('acc');
      accIdMap.set(oldId, newId);
      const kind: AccountKind = a.kind === 'supplier' ? 'supplier' : 'customer';
      const creditLimit = Math.min(
        100000000,
        Math.max(0, Math.round(Number(a.creditLimit) || 0))
      );
      addedAccs.push({
        id: newId,
        ownerId: GUEST_OWNER_ID,
        businessId,
        kind,
        name,
        phone: clampStr(String(a.phone || ''), 20),
        dueDate: clampStr(String(a.dueDate || ''), 24),
        ...(creditLimit > 0 ? { creditLimit } : {}),
        ...(a.promiseDate ? { promiseDate: clampStr(String(a.promiseDate), 24) } : {}),
        ...(a.promiseNote ? { promiseNote: clampStr(String(a.promiseNote), 160) } : {}),
        balance: Math.round((Number(a.balance) || 0) * 100) / 100,
        lastNote: clampStr(String(a.lastNote || 'Restored'), 160),
        lastActivityAt: clampStr(String(a.lastActivityAt || new Date().toISOString()), 40),
      });
    }
  }

  if (Array.isArray(parsed.transactions)) {
    for (const rawTx of parsed.transactions) {
      if (!rawTx || typeof rawTx !== 'object') continue;
      const t = rawTx as Record<string, unknown>;
      const mappedAcc = accIdMap.get(String(t.accountId || ''));
      const amount = Math.round((Number(t.amount) || 0) * 100) / 100;
      if (!mappedAcc || amount <= 0 || amount > 100000000) continue;
      addedTxs.push({
        id: makeGuestId('tx'),
        ownerId: GUEST_OWNER_ID,
        businessId,
        accountId: mappedAcc,
        direction: t.direction === 'received' ? 'received' : 'given',
        amount,
        note: clampStr(String(t.note || ''), 240),
        billDate: clampStr(String(t.billDate || new Date().toISOString()), 40),
        voiceRaw: clampStr(String(t.voiceRaw || ''), 300),
        billImage: clampStr(String(t.billImage || ''), 150000),
      });
    }
  }

  if (Array.isArray(parsed.bills)) {
    for (const rawBill of parsed.bills) {
      if (!rawBill || typeof rawBill !== 'object') continue;
      const b = rawBill as Record<string, unknown>;
      const items = Array.isArray(b.items)
        ? b.items
            .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
            .slice(0, 20)
            .map((item) => ({
              name: clampStr(String(item.name || 'Item'), 80) || 'Item',
              qty: Math.max(0.01, Number(item.qty) || 1),
              rate: Math.max(0, Number(item.rate) || 0),
              gstRate: Math.max(0, Number(item.gstRate) || 0),
            }))
        : [];
      if (items.length === 0) continue;
      const tpl: BillTemplateId =
        b.templateId === 'modern' ||
        b.templateId === 'gst-color' ||
        b.templateId === 'thermal-58'
          ? b.templateId
          : 'classic';
      addedBills.push({
        id: makeGuestId('bill'),
        ownerId: GUEST_OWNER_ID,
        businessId,
        docType: b.docType === 'quote' ? 'quote' : 'bill',
        billNumber: clampStr(String(b.billNumber || 'INV-001'), 40) || 'INV-001',
        customerName:
          clampStr(String(b.customerName || 'Walk-in Customer'), 100) || 'Walk-in Customer',
        customerPhone: clampStr(String(b.customerPhone || ''), 20),
        items,
        subtotal: Math.max(0, Number(b.subtotal) || 0),
        totalGst: Math.max(0, Number(b.totalGst) || 0),
        discountAmount: Math.max(0, Number(b.discountAmount) || 0),
        totalAmount: Math.max(0, Number(b.totalAmount) || 0),
        paymentStatus:
          b.paymentStatus === 'unpaid' || b.paymentStatus === 'partial' ? b.paymentStatus : 'paid',
        templateId: tpl,
        notes: clampStr(String(b.notes || ''), 240),
        billDate: clampStr(String(b.billDate || getLocalDateKey()), 40),
      });
    }
  }

  if (Array.isArray(parsed.stockItems)) {
    for (const rawStock of parsed.stockItems) {
      if (!rawStock || typeof rawStock !== 'object') continue;
      const s = rawStock as Record<string, unknown>;
      const name = clampStr(String(s.name || ''), 100);
      if (!name) continue;
      addedStock.push({
        id: makeGuestId('stk'),
        ownerId: GUEST_OWNER_ID,
        businessId,
        name,
        unit: clampStr(String(s.unit || 'pcs'), 24) || 'pcs',
        salePrice: Math.max(0, Number(s.salePrice) || 0),
        purchasePrice: Math.max(0, Number(s.purchasePrice) || 0),
        quantity: Math.max(0, Number(s.quantity) || 0),
        lowStockThreshold: Math.max(0, Number(s.lowStockThreshold) || 0),
      });
    }
  }

  if (Array.isArray(parsed.cashbookEntries)) {
    for (const rawCb of parsed.cashbookEntries) {
      if (!rawCb || typeof rawCb !== 'object') continue;
      const c = rawCb as Record<string, unknown>;
      const amount = Math.round((Number(c.amount) || 0) * 100) / 100;
      if (amount <= 0 || amount > 100000000) continue;
      addedCashbook.push({
        id: makeGuestId('cb'),
        ownerId: GUEST_OWNER_ID,
        businessId,
        entryType: c.entryType === 'outflow' ? 'outflow' : 'inflow',
        mode: c.mode === 'upi' || c.mode === 'bank' ? c.mode : 'cash',
        category: clampStr(String(c.category || 'General'), 40) || 'General',
        amount,
        note: clampStr(String(c.note || ''), 200),
        entryDate: clampStr(String(c.entryDate || new Date().toISOString()), 40),
      });
    }
  }

  return {
    counts: {
      accounts: addedAccs.length,
      transactions: addedTxs.length,
      bills: addedBills.length,
      stockItems: addedStock.length,
    },
    vault: {
      ...vault,
      accounts: [...addedAccs, ...vault.accounts],
      transactions: [...addedTxs, ...vault.transactions],
      bills: [...addedBills, ...vault.bills],
      stockItems: [...addedStock, ...vault.stockItems],
      cashbookEntries: [...addedCashbook, ...vault.cashbookEntries],
    },
  };
}
