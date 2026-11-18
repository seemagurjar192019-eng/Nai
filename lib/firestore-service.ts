'use client';

import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { getLocalDateKey } from './i18n';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  AccentTheme,
  AccountKind,
  ActivityActionType,
  ActivityLog,
  AppearanceMode,
  BillDocument,
  BillLineItem,
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
  UserProfile,
} from './types';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  return String(val || '').trim().slice(0, maxLen);
}

async function commitDeletesInChunks(refs: DocumentReference[], chunkSize = 400): Promise<void> {
  for (let i = 0; i < refs.length; i += chunkSize) {
    const slice = refs.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    const batch = writeBatch(db);
    for (const ref of slice) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

const userUpsertLocks = new Map<string, Promise<unknown>>();

function runSerializedForUser<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const previous = userUpsertLocks.get(uid) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const cleanup = next.catch(() => undefined);
  userUpsertLocks.set(uid, cleanup);
  return next;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function upsertUserProfile(
  uid: string,
  patch: {
    mobileNumber?: string;
    language?: LanguageCode;
    accentTheme?: AccentTheme;
    appearance?: AppearanceMode;
    activeBusinessId?: string;
    appLockPin?: string;
    onboardingDone?: boolean;
  }
): Promise<UserProfile> {
  return runSerializedForUser(uid, async () => {
    const path = `users/${uid}`;
    try {
      const ref = doc(db, 'users', uid);
      let snap = await getDoc(ref);
      if (!snap.exists()) {
        try {
          snap = await getDocFromServer(ref);
        } catch {
          // Offline fallback: proceed with local snapshot check
        }
      }

      if (!snap.exists()) {
        const created: UserProfile = {
          uid,
          mobileNumber: clampStr(patch.mobileNumber, 20),
          language: patch.language || 'en',
          accentTheme: patch.accentTheme || 'obsidian',
          appearance: patch.appearance || 'light',
          activeBusinessId: clampStr(patch.activeBusinessId, 128),
          appLockPin: clampStr(patch.appLockPin, 128),
          onboardingDone: Boolean(patch.onboardingDone),
        };
        await setDoc(ref, {
          ...created,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return created;
      }

      const existing = snap.data() as UserProfile;
      const updatePayload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (patch.mobileNumber !== undefined) updatePayload.mobileNumber = clampStr(patch.mobileNumber, 20);
      if (patch.language !== undefined) updatePayload.language = patch.language;
      if (patch.accentTheme !== undefined) updatePayload.accentTheme = patch.accentTheme;
      if (patch.appearance !== undefined) updatePayload.appearance = patch.appearance;
      if (patch.activeBusinessId !== undefined) updatePayload.activeBusinessId = clampStr(patch.activeBusinessId, 128);
      if (patch.appLockPin !== undefined) updatePayload.appLockPin = clampStr(patch.appLockPin, 128);
      if (patch.onboardingDone !== undefined) updatePayload.onboardingDone = patch.onboardingDone;

      await updateDoc(ref, updatePayload);
      return {
        ...existing,
        ...patch,
        uid,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  });
}

export async function createBusiness(
  ownerId: string,
  input: { name: string; phone?: string; upiId?: string }
): Promise<Business> {
  const id = makeSafeId('biz');
  const path = `businesses/${id}`;
  try {
    const payload: Omit<Business, 'id'> = {
      ownerId,
      name: clampStr(input.name || 'My Shop', 120) || 'My Shop',
      phone: clampStr(input.phone, 20),
      gstNumber: '',
      businessType: 'Retail / Kirana',
      category: 'General Store',
      address: '',
      email: '',
      about: '',
      upiId: clampStr(input.upiId, 100),
    };
    await setDoc(doc(db, 'businesses', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...payload };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateBusiness(
  businessId: string,
  patch: Partial<
    Pick<
      Business,
      'name' | 'phone' | 'gstNumber' | 'businessType' | 'category' | 'address' | 'email' | 'about' | 'upiId'
    >
  >
): Promise<void> {
  const path = `businesses/${businessId}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) payload.name = clampStr(patch.name, 120) || 'My Shop';
    if (patch.phone !== undefined) payload.phone = clampStr(patch.phone, 20);
    if (patch.gstNumber !== undefined) payload.gstNumber = clampStr(patch.gstNumber, 24);
    if (patch.businessType !== undefined) payload.businessType = clampStr(patch.businessType, 60);
    if (patch.category !== undefined) payload.category = clampStr(patch.category, 60);
    if (patch.address !== undefined) payload.address = clampStr(patch.address, 240);
    if (patch.email !== undefined) payload.email = clampStr(patch.email, 120);
    if (patch.about !== undefined) payload.about = clampStr(patch.about, 300);
    if (patch.upiId !== undefined) payload.upiId = clampStr(patch.upiId, 100);
    await updateDoc(doc(db, 'businesses', businessId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeBusinesses(
  ownerId: string,
  onData: (rows: Business[]) => void
): Unsubscribe {
  const q = query(collection(db, 'businesses'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Business, 'id'>) }));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'businesses')
  );
}

export function subscribeAccounts(
  ownerId: string,
  businessId: string,
  onData: (rows: LedgerAccount[]) => void
): Unsubscribe {
  const q = query(collection(db, 'accounts'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerAccount, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
  );
}

export function subscribeTransactions(
  ownerId: string,
  businessId: string,
  onData: (rows: LedgerTransaction[]) => void
): Unsubscribe {
  const q = query(collection(db, 'transactions'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerTransaction, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
  );
}

export function subscribeBills(
  ownerId: string,
  businessId: string,
  onData: (rows: BillDocument[]) => void
): Unsubscribe {
  const q = query(collection(db, 'bills'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<BillDocument, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'bills')
  );
}

export function subscribeStockItems(
  ownerId: string,
  businessId: string,
  onData: (rows: StockItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'stockItems'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StockItem, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'stockItems')
  );
}

export function subscribeCashbookEntries(
  ownerId: string,
  businessId: string,
  onData: (rows: CashbookEntry[]) => void
): Unsubscribe {
  const q = query(collection(db, 'cashbookEntries'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CashbookEntry, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'cashbookEntries')
  );
}

export function subscribeStaffMembers(
  ownerId: string,
  businessId: string,
  onData: (rows: StaffMember[]) => void
): Unsubscribe {
  const q = query(collection(db, 'staffMembers'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'staffMembers')
  );
}

export function subscribeActivityLogs(
  ownerId: string,
  businessId: string,
  onData: (rows: ActivityLog[]) => void
): Unsubscribe {
  const q = query(collection(db, 'activityLogs'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'activityLogs')
  );
}

export async function createAccount(params: {
  ownerId: string;
  businessId: string;
  kind: AccountKind;
  name: string;
  phone?: string;
  dueDate?: string;
  creditLimit?: number;
}): Promise<LedgerAccount> {
  const id = makeSafeId('acc');
  const nowIso = new Date().toISOString();
  const limitVal =
    params.creditLimit !== undefined && Number(params.creditLimit) > 0
      ? Math.min(100000000, Math.round(Number(params.creditLimit)))
      : 0;
  const payload: Omit<LedgerAccount, 'id'> = {
    ownerId: params.ownerId,
    businessId: params.businessId,
    kind: params.kind,
    name: clampStr(params.name, 100) || 'Customer',
    phone: clampStr(params.phone, 20),
    dueDate: clampStr(params.dueDate, 24),
    ...(limitVal > 0 ? { creditLimit: limitVal } : {}),
    balance: 0,
    lastNote: 'Added Today',
    lastActivityAt: nowIso,
  };
  try {
    await setDoc(doc(db, 'accounts', id), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...payload };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `accounts/${id}`);
  }
}

export async function updateAccountMeta(
  accountId: string,
  patch: Partial<
    Pick<LedgerAccount, 'name' | 'phone' | 'dueDate' | 'kind' | 'creditLimit' | 'promiseDate' | 'promiseNote'>
  >
): Promise<void> {
  const path = `accounts/${accountId}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) payload.name = clampStr(patch.name, 100) || 'Customer';
    if (patch.phone !== undefined) payload.phone = clampStr(patch.phone, 20);
    if (patch.dueDate !== undefined) payload.dueDate = clampStr(patch.dueDate, 24);
    if (patch.kind !== undefined) payload.kind = patch.kind;
    if (patch.promiseDate !== undefined) payload.promiseDate = clampStr(patch.promiseDate, 24);
    if (patch.promiseNote !== undefined) payload.promiseNote = clampStr(patch.promiseNote, 160);
    if (patch.creditLimit !== undefined) {
      payload.creditLimit = Math.min(100000000, Math.max(0, Math.round(Number(patch.creditLimit) || 0)));
    }
    await updateDoc(doc(db, 'accounts', accountId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function addTransactionAtomic(params: {
  ownerId: string;
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
}): Promise<{
  accountId: string;
  txId: string;
  newBalance: number;
  tx: LedgerTransaction;
  accountCreated: boolean;
}> {
  const cleanAmount = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero');

  const nowIso = params.billDate || new Date().toISOString();
  const delta = params.direction === 'given' ? cleanAmount : -cleanAmount;
  const txId = makeSafeId('tx');
  const noteSummary =
    clampStr(params.note, 160) ||
    `${params.direction === 'given' ? 'Credit' : 'Payment'} ₹${cleanAmount.toLocaleString('en-IN')}`;

  const shouldSyncGalla = Boolean(params.syncToGalla);

  try {
    const batch = writeBatch(db);
    let accountId: string;
    let newBalance: number;
    let accountCreated = false;

    if (params.existingAccount) {
      accountId = params.existingAccount.id;
      newBalance = Math.round((params.existingAccount.balance + delta) * 100) / 100;
      batch.update(doc(db, 'accounts', accountId), {
        balance: newBalance,
        lastNote: noteSummary,
        lastActivityAt: nowIso,
        updatedAt: serverTimestamp(),
      });
    } else {
      accountId = makeSafeId('acc');
      accountCreated = true;
      newBalance = delta;
      batch.set(doc(db, 'accounts', accountId), {
        ownerId: params.ownerId,
        businessId: params.businessId,
        kind: params.kind || 'customer',
        name: clampStr(params.customerName, 100) || 'Customer',
        phone: '',
        dueDate: '',
        balance: delta,
        lastNote: noteSummary,
        lastActivityAt: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const txData: Omit<LedgerTransaction, 'id'> = {
      ownerId: params.ownerId,
      businessId: params.businessId,
      accountId,
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

    batch.set(doc(db, 'transactions', txId), {
      ...txData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.syncToGalla) {
      const cbId = makeSafeId('cb');
      const entryType: CashbookEntryType =
        params.direction === 'received' ? 'inflow' : 'outflow';
      const partyKind = params.existingAccount?.kind || params.kind || 'customer';
      const category =
        params.direction === 'received'
          ? partyKind === 'customer'
            ? 'Vasooli'
            : 'Supplier Refund'
          : partyKind === 'supplier'
          ? 'Supplier Pay'
          : 'Cash Credit';

      batch.set(doc(db, 'cashbookEntries', cbId), {
        ownerId: params.ownerId,
        businessId: params.businessId,
        entryType,
        mode: params.syncToGalla.mode,
        category,
        amount: cleanAmount,
        note: clampStr(`${params.customerName}: ${noteSummary}`, 200),
        entryDate: clampStr(nowIso, 40),
        linkedRefId: txId,
        ...(params.createdByName ? { actorName: clampStr(params.createdByName, 80) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return {
      accountId,
      txId,
      newBalance,
      tx: { id: txId, ...txData },
      accountCreated,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${txId}`);
  }
}

export async function updateTransactionAtomic(params: {
  tx: LedgerTransaction;
  account: LedgerAccount;
  allForAccount: LedgerTransaction[];
  patch: {
    direction: TxDirection;
    amount: number;
    note: string;
    billDate: string;
    billImage?: string;
  };
}): Promise<void> {
  const cleanAmount = Math.round((Number(params.patch.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero');

  try {
    const batch = writeBatch(db);
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

    batch.update(doc(db, 'transactions', params.tx.id), {
      direction: updatedTx.direction,
      amount: updatedTx.amount,
      note: updatedTx.note,
      billDate: updatedTx.billDate,
      billImage: updatedTx.billImage,
      updatedAt: serverTimestamp(),
    });

    const merged = params.allForAccount.map((item) =>
      item.id === params.tx.id ? updatedTx : item
    );
    const sorted = [...merged].sort((a, b) => b.billDate.localeCompare(a.billDate));
    let nextBalance = 0;
    for (const item of sorted) {
      nextBalance += item.direction === 'given' ? item.amount : -item.amount;
    }
    nextBalance = Math.round(nextBalance * 100) / 100;
    const latestIso = sorted[0]?.billDate || params.account.lastActivityAt;
    const lastNote = sorted[0]
      ? clampStr(sorted[0].note, 160) ||
        `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`
      : 'No recent transactions';

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote,
      lastActivityAt: latestIso,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `transactions/${params.tx.id}`);
  }
}

export async function restoreTransactionAtomic(params: {
  tx: LedgerTransaction;
  account: LedgerAccount;
  existingForAccount: LedgerTransaction[];
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const restoredId = makeSafeId('tx');
    const restored: LedgerTransaction = {
      ...params.tx,
      id: restoredId,
    };

    batch.set(doc(db, 'transactions', restoredId), {
      ownerId: restored.ownerId,
      businessId: restored.businessId,
      accountId: restored.accountId,
      direction: restored.direction,
      amount: restored.amount,
      note: clampStr(restored.note, 240),
      billDate: clampStr(restored.billDate, 40),
      voiceRaw: clampStr(restored.voiceRaw, 300),
      billImage: clampStr(restored.billImage, 150000),
      ...(restored.createdByName ? { createdByName: clampStr(restored.createdByName, 80) } : {}),
      ...(restored.createdByRole ? { createdByRole: restored.createdByRole } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const combined = [...params.existingForAccount.filter((i) => i.id !== params.tx.id), restored];
    const sorted = [...combined].sort((a, b) => b.billDate.localeCompare(a.billDate));
    let nextBalance = 0;
    for (const item of sorted) {
      nextBalance += item.direction === 'given' ? item.amount : -item.amount;
    }
    nextBalance = Math.round(nextBalance * 100) / 100;
    const latestIso = sorted[0]?.billDate || restored.billDate;
    const lastNote =
      clampStr(sorted[0]?.note, 160) ||
      `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`;

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote,
      lastActivityAt: latestIso,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${params.tx.id}`);
  }
}

export async function deleteTransactionAtomic(params: {
  tx: LedgerTransaction;
  account: LedgerAccount;
  remainingForAccount: LedgerTransaction[];
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'transactions', params.tx.id));

    let nextBalance = 0;
    let latestIso = params.account.lastActivityAt;
    let lastNote = 'No recent transactions';

    if (params.remainingForAccount.length > 0) {
      const sorted = [...params.remainingForAccount].sort((a, b) =>
        b.billDate.localeCompare(a.billDate)
      );
      for (const item of sorted) {
        nextBalance += item.direction === 'given' ? item.amount : -item.amount;
      }
      nextBalance = Math.round(nextBalance * 100) / 100;
      latestIso = sorted[0].billDate;
      lastNote =
        clampStr(sorted[0].note, 160) ||
        `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`;
    }

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote,
      lastActivityAt: latestIso,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `transactions/${params.tx.id}`);
  }
}

export async function deleteAccountWithTransactions(
  accountId: string,
  accountTxs: LedgerTransaction[]
): Promise<void> {
  try {
    const refs: DocumentReference[] = [
      ...accountTxs.map((tx) => doc(db, 'transactions', tx.id)),
      doc(db, 'accounts', accountId),
    ];
    await commitDeletesInChunks(refs, 400);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `accounts/${accountId}`);
  }
}

export async function saveBillDocument(params: {
  ownerId: string;
  businessId: string;
  docType: 'bill' | 'quote';
  billNumber: string;
  customerName: string;
  customerPhone: string;
  items: BillLineItem[];
  stockItems?: StockItem[];
  discountAmount?: number;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  linkedTxId?: string;
  createdByName?: string;
  syncToGalla?: { mode: CashbookMode } | null;
  templateId: BillTemplateId;
  notes: string;
  billDate: string;
}): Promise<{ billId: string; deductedCount: number }> {
  const id = makeSafeId('bill');
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
  const totalAmount = Math.max(0, Math.round((subtotal + totalGst - discountAmount) * 100) / 100);
  const paymentStatus = params.paymentStatus || 'paid';

  let estimatedCost = 0;
  if (params.stockItems && params.stockItems.length > 0) {
    for (const line of rawFiltered) {
      const matched = line.stockItemId
        ? params.stockItems.find((s) => s.id === line.stockItemId)
        : params.stockItems.find(
            (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
          );
      if (matched && matched.purchasePrice && matched.purchasePrice > 0) {
        estimatedCost += matched.purchasePrice * Math.max(0, Number(line.qty) || 0);
      }
    }
    estimatedCost = Math.round(estimatedCost * 100) / 100;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'bills', id), {
      ownerId: params.ownerId,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.docType === 'bill' && paymentStatus === 'paid' && params.syncToGalla && totalAmount > 0) {
      const cbId = makeSafeId('cb');
      batch.set(doc(db, 'cashbookEntries', cbId), {
        ownerId: params.ownerId,
        businessId: params.businessId,
        entryType: 'inflow',
        mode: params.syncToGalla.mode,
        category: 'Bill Sale',
        amount: totalAmount,
        note: clampStr(`${params.billNumber} · ${params.customerName}`, 200),
        entryDate: clampStr(params.billDate, 40),
        linkedRefId: id,
        ...(params.createdByName ? { actorName: clampStr(params.createdByName, 80) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    let deductedCount = 0;
    if (params.docType === 'bill' && params.stockItems && params.stockItems.length > 0) {
      const deductMap = new Map<string, number>();
      for (const line of rawFiltered) {
        const matched = line.stockItemId
          ? params.stockItems.find((s) => s.id === line.stockItemId)
          : params.stockItems.find(
              (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
            );
        if (matched) {
          deductMap.set(
            matched.id,
            (deductMap.get(matched.id) || 0) + Math.max(0, Number(line.qty) || 0)
          );
        }
      }
      for (const [stockId, soldQty] of deductMap.entries()) {
        const currentStock = params.stockItems.find((s) => s.id === stockId);
        if (currentStock && soldQty > 0) {
          const nextQty = Math.max(0, Math.round((currentStock.quantity - soldQty) * 100) / 100);
          batch.update(doc(db, 'stockItems', stockId), {
            quantity: nextQty,
            updatedAt: serverTimestamp(),
          });
          deductedCount++;
        }
      }
    }

    await batch.commit();
    return { billId: id, deductedCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `bills/${id}`);
  }
}

export async function convertQuoteToBill(params: {
  quote: BillDocument;
  newBillNumber: string;
  stockItems?: StockItem[];
}): Promise<number> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'bills', params.quote.id), {
      docType: 'bill',
      billNumber: clampStr(params.newBillNumber, 40) || params.quote.billNumber,
      billDate: getLocalDateKey(),
      updatedAt: serverTimestamp(),
    });

    let deductedCount = 0;
    if (params.stockItems && params.stockItems.length > 0) {
      const deductMap = new Map<string, number>();
      for (const line of params.quote.items) {
        const matched = params.stockItems.find(
          (s) => s.name.trim().toLowerCase() === line.name.trim().toLowerCase()
        );
        if (matched) {
          deductMap.set(
            matched.id,
            (deductMap.get(matched.id) || 0) + Math.max(0, Number(line.qty) || 0)
          );
        }
      }
      for (const [stockId, soldQty] of deductMap.entries()) {
        const currentStock = params.stockItems.find((s) => s.id === stockId);
        if (currentStock && soldQty > 0) {
          const nextQty = Math.max(0, Math.round((currentStock.quantity - soldQty) * 100) / 100);
          batch.update(doc(db, 'stockItems', stockId), {
            quantity: nextQty,
            updatedAt: serverTimestamp(),
          });
          deductedCount++;
        }
      }
    }

    await batch.commit();
    return deductedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `bills/${params.quote.id}`);
  }
}

export async function deleteBillDocument(billId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'bills', billId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `bills/${billId}`);
  }
}

export async function saveStockItem(params: {
  ownerId: string;
  businessId: string;
  existingId?: string;
  name: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  quantity: number;
  lowStockThreshold: number;
}): Promise<string> {
  const id = params.existingId || makeSafeId('stk');
  const cleanPurchase = Math.max(0, Number(params.purchasePrice) || 0);
  try {
    if (params.existingId) {
      await updateDoc(doc(db, 'stockItems', id), {
        name: clampStr(params.name, 100) || 'Item',
        unit: clampStr(params.unit, 24) || 'pcs',
        salePrice: Math.max(0, Number(params.salePrice) || 0),
        purchasePrice: cleanPurchase,
        quantity: Math.max(0, Number(params.quantity) || 0),
        lowStockThreshold: Math.max(0, Number(params.lowStockThreshold) || 0),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'stockItems', id), {
        ownerId: params.ownerId,
        businessId: params.businessId,
        name: clampStr(params.name, 100) || 'Item',
        unit: clampStr(params.unit, 24) || 'pcs',
        salePrice: Math.max(0, Number(params.salePrice) || 0),
        purchasePrice: cleanPurchase,
        quantity: Math.max(0, Number(params.quantity) || 0),
        lowStockThreshold: Math.max(0, Number(params.lowStockThreshold) || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stockItems/${id}`);
  }
}

export async function deleteStockItem(itemId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'stockItems', itemId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `stockItems/${itemId}`);
  }
}

export async function addCashbookEntry(params: {
  ownerId: string;
  businessId: string;
  entryType: CashbookEntryType;
  mode: CashbookMode;
  category: string;
  amount: number;
  note?: string;
  entryDate?: string;
  linkedRefId?: string;
  actorName?: string;
}): Promise<string> {
  const cleanAmount = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) throw new Error('Amount must be greater than zero.');
  const id = makeSafeId('cb');
  try {
    await setDoc(doc(db, 'cashbookEntries', id), {
      ownerId: params.ownerId,
      businessId: params.businessId,
      entryType: params.entryType,
      mode: params.mode,
      category: clampStr(params.category, 40) || 'General',
      amount: cleanAmount,
      note: clampStr(params.note, 200),
      entryDate: clampStr(params.entryDate || new Date().toISOString(), 40),
      ...(params.linkedRefId ? { linkedRefId: clampStr(params.linkedRefId, 128) } : {}),
      ...(params.actorName ? { actorName: clampStr(params.actorName, 80) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `cashbookEntries/${id}`);
  }
}

export async function deleteCashbookEntry(entryId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'cashbookEntries', entryId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `cashbookEntries/${entryId}`);
  }
}

export async function saveStaffMember(params: {
  ownerId: string;
  businessId: string;
  existingId?: string;
  name: string;
  role: StaffRole;
  phone?: string;
  pinHash?: string;
  active: boolean;
}): Promise<string> {
  const id = params.existingId || makeSafeId('stf');
  try {
    if (params.existingId) {
      const updatePayload: Record<string, unknown> = {
        name: clampStr(params.name, 80) || 'Staff',
        role: params.role,
        phone: clampStr(params.phone, 20),
        active: params.active,
        updatedAt: serverTimestamp(),
      };
      if (params.pinHash !== undefined) {
        updatePayload.pinHash = clampStr(params.pinHash, 128);
      }
      await updateDoc(doc(db, 'staffMembers', id), updatePayload);
    } else {
      await setDoc(doc(db, 'staffMembers', id), {
        ownerId: params.ownerId,
        businessId: params.businessId,
        name: clampStr(params.name, 80) || 'Staff',
        role: params.role,
        phone: clampStr(params.phone, 20),
        ...(params.pinHash ? { pinHash: clampStr(params.pinHash, 128) } : {}),
        active: params.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `staffMembers/${id}`);
  }
}

export async function deleteStaffMember(staffId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'staffMembers', staffId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `staffMembers/${staffId}`);
  }
}

export async function recordActivityLog(params: {
  ownerId: string;
  businessId: string;
  actorName: string;
  actorRole: StaffRole;
  actionType: ActivityActionType;
  summary: string;
  targetName?: string;
  amount?: number;
}): Promise<void> {
  const id = makeSafeId('log');
  try {
    await setDoc(doc(db, 'activityLogs', id), {
      ownerId: params.ownerId,
      businessId: params.businessId,
      actorName: clampStr(params.actorName, 80) || 'Owner',
      actorRole: params.actorRole,
      actionType: params.actionType,
      summary: clampStr(params.summary, 240) || 'Action recorded',
      targetName: clampStr(params.targetName, 100),
      ...(params.amount !== undefined && params.amount >= 0
        ? { amount: Math.min(100000000, Math.round(Number(params.amount) * 100) / 100) }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `activityLogs/${id}`);
  }
}

export async function seedDemoBusinessData(ownerId: string, businessId: string): Promise<void> {
  const now = Date.now();
  const todayStr = getLocalDateKey(new Date(now));
  const yesterdayDate = getLocalDateKey(new Date(now - 86400000));

  const demoAccounts: Array<{
    id: string;
    kind: AccountKind;
    name: string;
    phone: string;
    dueDate: string;
    txs: Array<{ direction: TxDirection; amount: number; note: string; voiceRaw: string; minsAgo: number }>;
  }> = [
    {
      id: makeSafeId('acc'),
      kind: 'customer',
      name: 'Ramesh Kirana',
      phone: '9876543210',
      dueDate: todayStr,
      txs: [
        { direction: 'given', amount: 2500, note: 'Atta, Rice & Oil 25kg', voiceRaw: 'Ramesh dhai hazaar udhaar', minsAgo: 45 },
        { direction: 'received', amount: 500, note: 'UPI Cash Part Payment', voiceRaw: 'Ramesh se paanch sau mila', minsAgo: 12 },
      ],
    },
    {
      id: makeSafeId('acc'),
      kind: 'customer',
      name: 'Suresh',
      phone: '9822011223',
      dueDate: todayStr,
      txs: [
        { direction: 'given', amount: 1200, note: 'Monthly Ration', voiceRaw: 'Suresh ek hazaar do sau diya', minsAgo: 110 },
      ],
    },
    {
      id: makeSafeId('acc'),
      kind: 'customer',
      name: 'Mohan',
      phone: '9811122233',
      dueDate: '',
      txs: [
        { direction: 'received', amount: 650, note: 'Advance Deposit', voiceRaw: 'Mohan se chhe sau pachaas jama', minsAgo: 180 },
      ],
    },
    {
      id: makeSafeId('acc'),
      kind: 'customer',
      name: 'Anita',
      phone: '9765432109',
      dueDate: yesterdayDate,
      txs: [
        { direction: 'given', amount: 3400, note: 'Festival Grocery Box', voiceRaw: 'Anita teen hazaar char sau bakaya', minsAgo: 320 },
      ],
    },
    {
      id: makeSafeId('acc'),
      kind: 'supplier',
      name: 'Mahavir Wholesale',
      phone: '9988776655',
      dueDate: todayStr,
      txs: [
        { direction: 'received', amount: 8500, note: 'Stock Delivery #402', voiceRaw: '', minsAgo: 500 },
        { direction: 'given', amount: 4000, note: 'Bank Transfer Paid', voiceRaw: '', minsAgo: 200 },
      ],
    },
  ];

  try {
    const batch = writeBatch(db);
    for (const acc of demoAccounts) {
      let bal = 0;
      let latestIso = new Date(now).toISOString();
      let lastNote = '';
      for (const tx of acc.txs) {
        bal += tx.direction === 'given' ? tx.amount : -tx.amount;
        const dt = new Date(now - tx.minsAgo * 60000).toISOString();
        latestIso = dt;
        lastNote = tx.note;
        const txId = makeSafeId('tx');
        batch.set(doc(db, 'transactions', txId), {
          ownerId,
          businessId,
          accountId: acc.id,
          direction: tx.direction,
          amount: tx.amount,
          note: tx.note,
          billDate: dt,
          voiceRaw: tx.voiceRaw,
          billImage: '',
          createdByName: 'Shop Owner',
          createdByRole: 'owner',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'accounts', acc.id), {
        ownerId,
        businessId,
        kind: acc.kind,
        name: acc.name,
        phone: acc.phone,
        dueDate: acc.dueDate,
        balance: Math.round(bal * 100) / 100,
        lastNote,
        lastActivityAt: latestIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const demoStock = [
      { name: 'Toor Dal - 1 kg', unit: 'kg', salePrice: 165, purchasePrice: 145, quantity: 42, lowStockThreshold: 10 },
      { name: 'Mustard Oil - 1 L', unit: 'bottle', salePrice: 175, purchasePrice: 158, quantity: 8, lowStockThreshold: 12 },
      { name: 'Aashirvaad Atta - 5 kg', unit: 'bag', salePrice: 245, purchasePrice: 222, quantity: 24, lowStockThreshold: 5 },
    ];
    for (const item of demoStock) {
      batch.set(doc(db, 'stockItems', makeSafeId('stk')), {
        ownerId,
        businessId,
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Seed today's initial Galla Cashbook & sample Munim staff member
    batch.set(doc(db, 'cashbookEntries', makeSafeId('cb')), {
      ownerId,
      businessId,
      entryType: 'inflow',
      mode: 'cash',
      category: 'Opening',
      amount: 2500,
      note: 'Morning Galla Opening Cash',
      entryDate: new Date(now).toISOString(),
      actorName: 'Shop Owner',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'cashbookEntries', makeSafeId('cb')), {
      ownerId,
      businessId,
      entryType: 'inflow',
      mode: 'upi',
      category: 'Vasooli',
      amount: 500,
      note: 'Ramesh Kirana UPI Part Payment',
      entryDate: new Date(now).toISOString(),
      actorName: 'Shop Owner',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'cashbookEntries', makeSafeId('cb')), {
      ownerId,
      businessId,
      entryType: 'outflow',
      mode: 'cash',
      category: 'Expense',
      amount: 180,
      note: 'Shop Chai & Tempo Unloading',
      entryDate: new Date(now).toISOString(),
      actorName: 'Shop Owner',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'staffMembers', makeSafeId('stf')), {
      ownerId,
      businessId,
      name: 'Ramu Munim',
      role: 'munim',
      phone: '9820011122',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'accounts');
  }
}

export async function clearBusinessData(ownerId: string, businessId: string): Promise<void> {
  try {
    const colNames = [
      'transactions',
      'accounts',
      'bills',
      'stockItems',
      'cashbookEntries',
      'staffMembers',
      'activityLogs',
    ] as const;
    const refs: DocumentReference[] = [];
    for (const colName of colNames) {
      const snap = await getDocs(
        query(collection(db, colName), where('ownerId', '==', ownerId))
      );
      for (const d of snap.docs) {
        if ((d.data() as { businessId?: string }).businessId === businessId) {
          refs.push(d.ref);
        }
      }
    }
    await commitDeletesInChunks(refs, 400);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'businesses');
  }
}

export async function deleteBusinessCascade(ownerId: string, businessId: string): Promise<void> {
  await clearBusinessData(ownerId, businessId);
  try {
    await commitDeletesInChunks([doc(db, 'businesses', businessId)], 400);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `businesses/${businessId}`);
  }
}

export async function deleteUserAccountCascade(ownerId: string): Promise<void> {
  try {
    const colNames = [
      'transactions',
      'accounts',
      'bills',
      'stockItems',
      'cashbookEntries',
      'staffMembers',
      'activityLogs',
      'businesses',
    ] as const;
    const refs: DocumentReference[] = [];
    for (const colName of colNames) {
      const snap = await getDocs(
        query(collection(db, colName), where('ownerId', '==', ownerId))
      );
      for (const d of snap.docs) {
        refs.push(d.ref);
      }
    }
    refs.push(doc(db, 'users', ownerId));
    await commitDeletesInChunks(refs, 400);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${ownerId}`);
  }
}

export async function restoreBusinessBackup(
  ownerId: string,
  businessId: string,
  rawParsed: unknown
): Promise<{ accounts: number; transactions: number; bills: number; stockItems: number }> {
  if (!rawParsed || typeof rawParsed !== 'object') {
    throw new Error('Invalid JSON backup structure.');
  }
  const parsed = rawParsed as {
    accounts?: unknown[];
    transactions?: unknown[];
    bills?: unknown[];
    stockItems?: unknown[];
    cashbookEntries?: unknown[];
    staffMembers?: unknown[];
  };

  if (
    !Array.isArray(parsed.accounts) &&
    !Array.isArray(parsed.transactions) &&
    !Array.isArray(parsed.bills) &&
    !Array.isArray(parsed.stockItems) &&
    !Array.isArray(parsed.cashbookEntries)
  ) {
    throw new Error('Backup JSON must contain accounts, transactions, bills, stockItems, or cashbookEntries.');
  }

  const accIdMap = new Map<string, string>();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  let accCount = 0;
  let txCount = 0;
  let billCount = 0;
  let stockCount = 0;

  if (Array.isArray(parsed.accounts)) {
    for (const rawAcc of parsed.accounts) {
      if (!rawAcc || typeof rawAcc !== 'object') continue;
      const a = rawAcc as Record<string, unknown>;
      const name = clampStr(String(a.name || ''), 100);
      if (!name) continue;
      const oldId = String(a.id || makeSafeId('old'));
      const newAccId = makeSafeId('acc');
      accIdMap.set(oldId, newAccId);
      const kind: AccountKind = a.kind === 'supplier' ? 'supplier' : 'customer';
      const creditLimit = Math.min(100000000, Math.max(0, Math.round(Number(a.creditLimit) || 0)));
      const balance = Math.round((Number(a.balance) || 0) * 100) / 100;
      const docData = {
        ownerId,
        businessId,
        kind,
        name,
        phone: clampStr(String(a.phone || ''), 20),
        dueDate: clampStr(String(a.dueDate || ''), 24),
        ...(creditLimit > 0 ? { creditLimit } : {}),
        ...(a.promiseDate ? { promiseDate: clampStr(String(a.promiseDate), 24) } : {}),
        ...(a.promiseNote ? { promiseNote: clampStr(String(a.promiseNote), 160) } : {}),
        balance,
        lastNote: clampStr(String(a.lastNote || 'Restored'), 160),
        lastActivityAt: clampStr(String(a.lastActivityAt || new Date().toISOString()), 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      ops.push((b) => b.set(doc(db, 'accounts', newAccId), docData));
      accCount++;
    }
  }

  if (Array.isArray(parsed.transactions)) {
    for (const rawTx of parsed.transactions) {
      if (!rawTx || typeof rawTx !== 'object') continue;
      const t = rawTx as Record<string, unknown>;
      const mappedAcc = accIdMap.get(String(t.accountId || ''));
      const amount = Math.round((Number(t.amount) || 0) * 100) / 100;
      if (!mappedAcc || amount <= 0 || amount > 100000000) continue;
      const newTxId = makeSafeId('tx');
      const txData = {
        ownerId,
        businessId,
        accountId: mappedAcc,
        direction: t.direction === 'received' ? 'received' : 'given',
        amount,
        note: clampStr(String(t.note || ''), 240),
        billDate: clampStr(String(t.billDate || new Date().toISOString()), 40),
        voiceRaw: clampStr(String(t.voiceRaw || ''), 300),
        billImage: clampStr(String(t.billImage || ''), 150000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      ops.push((b) => b.set(doc(db, 'transactions', newTxId), txData));
      txCount++;
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
      const newBillId = makeSafeId('bill');
      const tpl =
        b.templateId === 'modern' || b.templateId === 'gst-color' || b.templateId === 'thermal-58'
          ? b.templateId
          : 'classic';
      const billData = {
        ownerId,
        businessId,
        docType: b.docType === 'quote' ? 'quote' : 'bill',
        billNumber: clampStr(String(b.billNumber || 'INV-001'), 40) || 'INV-001',
        customerName: clampStr(String(b.customerName || 'Walk-in Customer'), 100) || 'Walk-in Customer',
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      ops.push((batch) => batch.set(doc(db, 'bills', newBillId), billData));
      billCount++;
    }
  }

  if (Array.isArray(parsed.stockItems)) {
    for (const rawStock of parsed.stockItems) {
      if (!rawStock || typeof rawStock !== 'object') continue;
      const s = rawStock as Record<string, unknown>;
      const name = clampStr(String(s.name || ''), 100);
      if (!name) continue;
      const newStockId = makeSafeId('stk');
      const stockData = {
        ownerId,
        businessId,
        name,
        unit: clampStr(String(s.unit || 'pcs'), 24) || 'pcs',
        salePrice: Math.max(0, Number(s.salePrice) || 0),
        purchasePrice: Math.max(0, Number(s.purchasePrice) || 0),
        quantity: Math.max(0, Number(s.quantity) || 0),
        lowStockThreshold: Math.max(0, Number(s.lowStockThreshold) || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      ops.push((batch) => batch.set(doc(db, 'stockItems', newStockId), stockData));
      stockCount++;
    }
  }

  if (Array.isArray(parsed.cashbookEntries)) {
    for (const rawCb of parsed.cashbookEntries) {
      if (!rawCb || typeof rawCb !== 'object') continue;
      const c = rawCb as Record<string, unknown>;
      const amount = Math.round((Number(c.amount) || 0) * 100) / 100;
      if (amount <= 0 || amount > 100000000) continue;
      const newCbId = makeSafeId('cb');
      const cbData = {
        ownerId,
        businessId,
        entryType: c.entryType === 'outflow' ? 'outflow' : 'inflow',
        mode: c.mode === 'upi' || c.mode === 'bank' ? c.mode : 'cash',
        category: clampStr(String(c.category || 'General'), 40) || 'General',
        amount,
        note: clampStr(String(c.note || ''), 200),
        entryDate: clampStr(String(c.entryDate || new Date().toISOString()), 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      ops.push((batch) => batch.set(doc(db, 'cashbookEntries', newCbId), cbData));
    }
  }

  try {
    const accOps = ops.slice(0, accCount);
    for (let i = 0; i < accOps.length; i += 350) {
      const batch = writeBatch(db);
      for (const fn of accOps.slice(i, i + 350)) fn(batch);
      await batch.commit();
    }
    const restOps = ops.slice(accCount);
    for (let i = 0; i < restOps.length; i += 350) {
      const batch = writeBatch(db);
      for (const fn of restOps.slice(i, i + 350)) fn(batch);
      await batch.commit();
    }
    return { accounts: accCount, transactions: txCount, bills: billCount, stockItems: stockCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'restoreBackup');
  }
}
