'use client';

import {
  collection,
  deleteField,
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
import { accountInputSchema } from './design-system';
import { encryptString, tryDecryptString, type VaultKeyEnvelope } from './e2ee';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getLocalDateKey } from './i18n';
import { validateSafeBackupJson } from './security';
import type {
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
  PersonaContext,
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

async function enc(
  dek: CryptoKey | null | undefined,
  val: string | undefined | null,
  maxPlain: number
): Promise<string> {
  const clean = clampStr(val, maxPlain);
  if (!clean || !dek) return clean;
  return encryptString(dek, clean);
}

async function encRequired(
  dek: CryptoKey | null | undefined,
  val: string | undefined | null,
  maxPlain: number,
  fallback: string
): Promise<string> {
  const clean = clampStr(val, maxPlain) || fallback;
  return dek ? encryptString(dek, clean) : clean;
}

async function dec(dek: CryptoKey | null | undefined, val: unknown): Promise<string> {
  if (typeof val !== 'string') return String(val || '');
  return tryDecryptString(dek ?? null, val);
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

export async function getVaultKeyEnvelope(uid: string): Promise<VaultKeyEnvelope | null> {
  const path = `users/${uid}/security/vault`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'security', 'vault'));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      version: 1,
      mode: raw.mode === 'pin' ? 'pin' : 'auto',
      wrappedDek: String(raw.wrappedDek || ''),
      iv: String(raw.iv || ''),
      salt: String(raw.salt || ''),
      iterations: Number(raw.iterations || 150000),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveVaultKeyEnvelope(
  uid: string,
  envelope: Omit<VaultKeyEnvelope, 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `users/${uid}/security/vault`;
  try {
    const ref = doc(db, 'users', uid, 'security', 'vault');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        version: envelope.version,
        mode: envelope.mode,
        wrappedDek: clampStr(envelope.wrappedDek, 512),
        iv: clampStr(envelope.iv, 128),
        salt: clampStr(envelope.salt, 128),
        iterations: Math.min(600000, Math.max(10000, Math.round(envelope.iterations))),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        version: envelope.version,
        mode: envelope.mode,
        wrappedDek: clampStr(envelope.wrappedDek, 512),
        iv: clampStr(envelope.iv, 128),
        salt: clampStr(envelope.salt, 128),
        iterations: Math.min(600000, Math.max(10000, Math.round(envelope.iterations))),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      uid: String(raw.uid || uid),
      mobileNumber: String(raw.mobileNumber || ''),
      language: (raw.language as LanguageCode) || 'en',
      appearance: raw.appearance === 'dark' ? 'dark' : 'light',
      activeBusinessId: String(raw.activeBusinessId || ''),
      appLockPin: String(raw.appLockPin || ''),
      onboardingDone: Boolean(raw.onboardingDone),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function upsertUserProfile(
  uid: string,
  patch: {
    mobileNumber?: string;
    language?: LanguageCode;
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
          appearance: patch.appearance === 'dark' ? 'dark' : 'light',
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

      const rawExisting = snap.data() as Record<string, unknown>;
      const validLangs = new Set<string>([
        'en',
        'hi',
        'hinglish',
        'mr',
        'gu',
        'ta',
        'te',
        'pa',
        'ml',
        'kn',
        'bn',
      ]);
      const normalizedExistingLang = validLangs.has(String(rawExisting.language || ''))
        ? (rawExisting.language as LanguageCode)
        : 'en';
      const existingAppearance: AppearanceMode =
        rawExisting.appearance === 'dark' ? 'dark' : 'light';
      const nextAppearance: AppearanceMode =
        patch.appearance !== undefined
          ? patch.appearance === 'dark'
            ? 'dark'
            : 'light'
          : existingAppearance;
      const nextLanguage: LanguageCode =
        patch.language !== undefined ? patch.language : normalizedExistingLang;
      const nextMobile =
        patch.mobileNumber !== undefined
          ? clampStr(patch.mobileNumber, 20)
          : clampStr(String(rawExisting.mobileNumber || ''), 20);
      const nextBizId =
        patch.activeBusinessId !== undefined
          ? clampStr(patch.activeBusinessId, 128)
          : clampStr(String(rawExisting.activeBusinessId || ''), 128);
      const nextOnboardingDone =
        patch.onboardingDone !== undefined
          ? patch.onboardingDone
          : Boolean(rawExisting.onboardingDone);

      const updatePayload: Record<string, unknown> = {
        uid,
        mobileNumber: nextMobile,
        language: nextLanguage,
        appearance: nextAppearance,
        activeBusinessId: nextBizId,
        onboardingDone: nextOnboardingDone,
        updatedAt: serverTimestamp(),
      };
      if (!rawExisting.createdAt) {
        updatePayload.createdAt = serverTimestamp();
      }
      for (const legacyKey of ['accentTheme', 'email', 'displayName', 'photoURL', 'name']) {
        if (legacyKey in rawExisting) {
          updatePayload[legacyKey] = deleteField();
        }
      }
      if (patch.appLockPin !== undefined) {
        updatePayload.appLockPin = clampStr(patch.appLockPin, 128);
      } else if (typeof rawExisting.appLockPin === 'string' && rawExisting.appLockPin.length > 128) {
        updatePayload.appLockPin = clampStr(rawExisting.appLockPin, 128);
      }

      await updateDoc(ref, updatePayload);
      return {
        uid,
        mobileNumber: nextMobile,
        language: nextLanguage,
        appearance: nextAppearance,
        activeBusinessId: nextBizId,
        appLockPin:
          patch.appLockPin !== undefined
            ? clampStr(patch.appLockPin, 128)
            : clampStr(String(rawExisting.appLockPin || ''), 128),
        onboardingDone: nextOnboardingDone,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  });
}

export async function createBusiness(
  ownerId: string,
  input: { name: string; phone?: string; upiId?: string },
  dek?: CryptoKey | null
): Promise<Business> {
  const id = makeSafeId('biz');
  const path = `businesses/${id}`;
  try {
    const plain: Omit<Business, 'id'> = {
      ownerId,
      name: clampStr(input.name || 'My Shop', 120) || 'My Shop',
      phone: clampStr(input.phone, 20),
      gstNumber: '',
      businessType: 'Retail Store',
      category: 'General Store',
      address: '',
      email: '',
      about: '',
      upiId: clampStr(input.upiId, 100),
    };
    const stored: Omit<Business, 'id'> = {
      ownerId,
      name: await encRequired(dek, plain.name, 120, 'My Shop'),
      phone: await enc(dek, plain.phone, 20),
      gstNumber: await enc(dek, plain.gstNumber, 24),
      businessType: await enc(dek, plain.businessType, 60),
      category: await enc(dek, plain.category, 60),
      address: await enc(dek, plain.address, 240),
      email: await enc(dek, plain.email, 120),
      about: await enc(dek, plain.about, 300),
      upiId: await enc(dek, plain.upiId, 100),
    };
    await setDoc(doc(db, 'businesses', id), {
      ...stored,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...plain };
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
  >,
  dek?: CryptoKey | null
): Promise<void> {
  const path = `businesses/${businessId}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) payload.name = await encRequired(dek, patch.name, 120, 'My Shop');
    if (patch.phone !== undefined) payload.phone = await enc(dek, patch.phone, 20);
    if (patch.gstNumber !== undefined) payload.gstNumber = await enc(dek, patch.gstNumber, 24);
    if (patch.businessType !== undefined)
      payload.businessType = await enc(dek, patch.businessType, 60);
    if (patch.category !== undefined) payload.category = await enc(dek, patch.category, 60);
    if (patch.address !== undefined) payload.address = await enc(dek, patch.address, 240);
    if (patch.email !== undefined) payload.email = await enc(dek, patch.email, 120);
    if (patch.about !== undefined) payload.about = await enc(dek, patch.about, 300);
    if (patch.upiId !== undefined) payload.upiId = await enc(dek, patch.upiId, 100);
    await updateDoc(doc(db, 'businesses', businessId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeBusinesses(
  ownerId: string,
  onData: (rows: Business[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'businesses'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Business, 'id'>) }));
      void Promise.all(
        rawList.map(async (b) => ({
          ...b,
          name: (await dec(dek, b.name)) || 'My Shop',
          phone: await dec(dek, b.phone),
          gstNumber: await dec(dek, b.gstNumber),
          businessType: await dec(dek, b.businessType),
          category: await dec(dek, b.category),
          address: await dec(dek, b.address),
          email: await dec(dek, b.email),
          about: await dec(dek, b.about),
          upiId: await dec(dek, b.upiId),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'businesses')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeAccounts(
  ownerId: string,
  businessId: string,
  onData: (rows: LedgerAccount[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'accounts'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerAccount, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (a) => ({
          ...a,
          name: (await dec(dek, a.name)) || 'Customer',
          phone: await dec(dek, a.phone),
          lastNote: await dec(dek, a.lastNote),
          ...(a.promiseNote !== undefined ? { promiseNote: await dec(dek, a.promiseNote) } : {}),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeTransactions(
  ownerId: string,
  businessId: string,
  onData: (rows: LedgerTransaction[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'transactions'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerTransaction, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (t) => ({
          ...t,
          note: await dec(dek, t.note),
          voiceRaw: await dec(dek, t.voiceRaw),
          billImage: await dec(dek, t.billImage),
          ...(t.createdByName !== undefined
            ? { createdByName: await dec(dek, t.createdByName) }
            : {}),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeBills(
  ownerId: string,
  businessId: string,
  onData: (rows: BillDocument[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'bills'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<BillDocument, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (b) => ({
          ...b,
          customerName: (await dec(dek, b.customerName)) || 'Walk-in Customer',
          customerPhone: await dec(dek, b.customerPhone),
          notes: await dec(dek, b.notes),
          ...(b.createdByName !== undefined
            ? { createdByName: await dec(dek, b.createdByName) }
            : {}),
          items: Array.isArray(b.items)
            ? await Promise.all(
                b.items.map(async (item) => ({
                  ...item,
                  name: (await dec(dek, item.name)) || 'Item',
                }))
              )
            : [],
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'bills')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeStockItems(
  ownerId: string,
  businessId: string,
  onData: (rows: StockItem[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'stockItems'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StockItem, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (s) => ({
          ...s,
          name: (await dec(dek, s.name)) || 'Item',
          unit: (await dec(dek, s.unit)) || 'pcs',
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'stockItems')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeCashbookEntries(
  ownerId: string,
  businessId: string,
  onData: (rows: CashbookEntry[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'cashbookEntries'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CashbookEntry, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (c) => ({
          ...c,
          category: (await dec(dek, c.category)) || 'General',
          note: await dec(dek, c.note),
          ...(c.actorName !== undefined ? { actorName: await dec(dek, c.actorName) } : {}),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'cashbookEntries')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeStaffMembers(
  ownerId: string,
  businessId: string,
  onData: (rows: StaffMember[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'staffMembers'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (st) => ({
          ...st,
          name: (await dec(dek, st.name)) || 'Staff',
          phone: await dec(dek, st.phone),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'staffMembers')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export function subscribeActivityLogs(
  ownerId: string,
  businessId: string,
  onData: (rows: ActivityLog[]) => void,
  dek?: CryptoKey | null
): Unsubscribe {
  const q = query(collection(db, 'activityLogs'), where('ownerId', '==', ownerId));
  let seq = 0;
  let active = true;
  const unsub = onSnapshot(
    q,
    (snap) => {
      const currentSeq = ++seq;
      const rawList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
        .filter((item) => item.businessId === businessId);
      void Promise.all(
        rawList.map(async (l) => ({
          ...l,
          actorName: (await dec(dek, l.actorName)) || 'Owner',
          summary: (await dec(dek, l.summary)) || 'Action recorded',
          targetName: await dec(dek, l.targetName),
        }))
      ).then((decrypted) => {
        if (active && currentSeq === seq) {
          onData(decrypted);
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'activityLogs')
  );
  return () => {
    active = false;
    seq++;
    unsub();
  };
}

export async function createAccount(params: {
  ownerId: string;
  businessId: string;
  kind: AccountKind;
  personaContext?: PersonaContext;
  name: string;
  phone?: string;
  dueDate?: string;
  creditLimit?: number;
  dek?: CryptoKey | null;
}): Promise<LedgerAccount> {
  const parsed = accountInputSchema.safeParse({
    kind: params.kind,
    name: params.name,
    phone: params.phone || '',
    dueDate: params.dueDate || '',
    creditLimit: Number(params.creditLimit) || 0,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Invalid party details.');
  }
  const id = makeSafeId('acc');
  const nowIso = new Date().toISOString();
  const limitVal =
    parsed.data.creditLimit > 0
      ? Math.min(100000000, Math.round(parsed.data.creditLimit))
      : 0;
  const plain: Omit<LedgerAccount, 'id'> = {
    ownerId: params.ownerId,
    businessId: params.businessId,
    kind: parsed.data.kind,
    ...(params.personaContext ? { personaContext: params.personaContext } : {}),
    name: parsed.data.name,
    phone: parsed.data.phone,
    dueDate: parsed.data.dueDate,
    ...(limitVal > 0 ? { creditLimit: limitVal } : {}),
    balance: 0,
    lastNote: 'Added Today',
    lastActivityAt: nowIso,
  };
  try {
    const stored: Omit<LedgerAccount, 'id'> = {
      ...plain,
      name: await encRequired(params.dek, plain.name, 100, 'Customer'),
      phone: await enc(params.dek, plain.phone, 20),
      lastNote: await encRequired(params.dek, plain.lastNote, 160, 'Added Today'),
    };
    await setDoc(doc(db, 'accounts', id), {
      ...stored,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...plain };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `accounts/${id}`);
  }
}

export async function updateAccountMeta(
  accountId: string,
  patch: Partial<
    Pick<LedgerAccount, 'name' | 'phone' | 'dueDate' | 'kind' | 'creditLimit' | 'promiseDate' | 'promiseNote'>
  >,
  dek?: CryptoKey | null
): Promise<void> {
  const path = `accounts/${accountId}`;
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) payload.name = await encRequired(dek, patch.name, 100, 'Customer');
    if (patch.phone !== undefined) payload.phone = await enc(dek, patch.phone, 20);
    if (patch.dueDate !== undefined) payload.dueDate = clampStr(patch.dueDate, 24);
    if (patch.kind !== undefined) payload.kind = patch.kind;
    if (patch.promiseDate !== undefined) payload.promiseDate = clampStr(patch.promiseDate, 24);
    if (patch.promiseNote !== undefined)
      payload.promiseNote = await enc(dek, patch.promiseNote, 160);
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
  personaContext?: PersonaContext;
  direction: TxDirection;
  amount: number;
  note?: string;
  billDate?: string;
  voiceRaw?: string;
  billImage?: string;
  createdByName?: string;
  createdByRole?: StaffRole;
  syncToGalla?: { mode: CashbookMode } | null;
  dek?: CryptoKey | null;
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
  const resolvedContext = params.personaContext || params.existingAccount?.personaContext;

  try {
    const batch = writeBatch(db);
    let accountId: string;
    let newBalance: number;
    let accountCreated = false;
    const encryptedLastNote = await encRequired(params.dek, noteSummary, 160, 'Updated');

    if (params.existingAccount) {
      accountId = params.existingAccount.id;
      newBalance = Math.round((params.existingAccount.balance + delta) * 100) / 100;
      batch.update(doc(db, 'accounts', accountId), {
        balance: newBalance,
        lastNote: encryptedLastNote,
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
        ...(resolvedContext ? { personaContext: resolvedContext } : {}),
        name: await encRequired(params.dek, params.customerName, 100, 'Customer'),
        phone: '',
        dueDate: '',
        balance: delta,
        lastNote: encryptedLastNote,
        lastActivityAt: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const plainTxData: Omit<LedgerTransaction, 'id'> = {
      ownerId: params.ownerId,
      businessId: params.businessId,
      accountId,
      ...(resolvedContext ? { personaContext: resolvedContext } : {}),
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

    const storedTxData: Omit<LedgerTransaction, 'id'> = {
      ...plainTxData,
      note: await enc(params.dek, plainTxData.note, 240),
      voiceRaw: await enc(params.dek, plainTxData.voiceRaw, 300),
      billImage: await enc(params.dek, plainTxData.billImage, 150000),
      ...(plainTxData.createdByName
        ? { createdByName: await enc(params.dek, plainTxData.createdByName, 80) }
        : {}),
    };

    batch.set(doc(db, 'transactions', txId), {
      ...storedTxData,
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
        category: await encRequired(params.dek, category, 40, 'General'),
        amount: cleanAmount,
        note: await enc(params.dek, `${params.customerName}: ${noteSummary}`, 200),
        entryDate: clampStr(nowIso, 40),
        linkedRefId: txId,
        ...(params.createdByName
          ? { actorName: await enc(params.dek, params.createdByName, 80) }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return {
      accountId,
      txId,
      newBalance,
      tx: { id: txId, ...plainTxData },
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
  dek?: CryptoKey | null;
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
      note: await enc(params.dek, updatedTx.note, 240),
      billDate: updatedTx.billDate,
      billImage: await enc(params.dek, updatedTx.billImage, 150000),
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
    const lastNotePlain = sorted[0]
      ? clampStr(sorted[0].note, 160) ||
        `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`
      : 'No recent transactions';

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote: await encRequired(params.dek, lastNotePlain, 160, 'No recent transactions'),
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
  dek?: CryptoKey | null;
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
      ...(restored.personaContext ? { personaContext: restored.personaContext } : {}),
      direction: restored.direction,
      amount: restored.amount,
      note: await enc(params.dek, restored.note, 240),
      billDate: clampStr(restored.billDate, 40),
      voiceRaw: await enc(params.dek, restored.voiceRaw, 300),
      billImage: await enc(params.dek, restored.billImage, 150000),
      ...(restored.createdByName
        ? { createdByName: await enc(params.dek, restored.createdByName, 80) }
        : {}),
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
    const lastNotePlain =
      clampStr(sorted[0]?.note, 160) ||
      `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`;

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote: await encRequired(params.dek, lastNotePlain, 160, 'Restored'),
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
  dek?: CryptoKey | null;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'transactions', params.tx.id));

    let nextBalance = 0;
    let latestIso = params.account.lastActivityAt;
    let lastNotePlain = 'No recent transactions';

    if (params.remainingForAccount.length > 0) {
      const sorted = [...params.remainingForAccount].sort((a, b) =>
        b.billDate.localeCompare(a.billDate)
      );
      for (const item of sorted) {
        nextBalance += item.direction === 'given' ? item.amount : -item.amount;
      }
      nextBalance = Math.round(nextBalance * 100) / 100;
      latestIso = sorted[0].billDate;
      lastNotePlain =
        clampStr(sorted[0].note, 160) ||
        `${sorted[0].direction === 'given' ? 'Credit' : 'Payment'} ₹${sorted[0].amount.toLocaleString('en-IN')}`;
    }

    batch.update(doc(db, 'accounts', params.account.id), {
      balance: nextBalance,
      lastNote: await encRequired(params.dek, lastNotePlain, 160, 'No recent transactions'),
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
  dek?: CryptoKey | null;
}): Promise<{ billId: string; deductedCount: number }> {
  const id = makeSafeId('bill');
  const rawFiltered = params.items.filter((i) => i.name.trim()).slice(0, 20);
  const plainItems = rawFiltered.map((i) => ({
    name: clampStr(i.name, 80),
    qty: Math.max(0.01, Number(i.qty) || 1),
    rate: Math.max(0, Number(i.rate) || 0),
    gstRate: Math.max(0, Number(i.gstRate) || 0),
    ...(i.stockItemId ? { stockItemId: clampStr(i.stockItemId, 128) } : {}),
  }));

  if (plainItems.length === 0) throw new Error('Add at least one item to the bill.');

  const subtotal =
    Math.round(plainItems.reduce((sum, i) => sum + i.qty * i.rate, 0) * 100) / 100;
  const totalGst =
    Math.round(
      plainItems.reduce((sum, i) => sum + (i.qty * i.rate * i.gstRate) / 100, 0) * 100
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
    const encryptedItems = await Promise.all(
      plainItems.map(async (item) => ({
        ...item,
        name: await encRequired(params.dek, item.name, 80, 'Item'),
      }))
    );

    const batch = writeBatch(db);
    batch.set(doc(db, 'bills', id), {
      ownerId: params.ownerId,
      businessId: params.businessId,
      docType: params.docType,
      billNumber: clampStr(params.billNumber, 40) || 'INV-001',
      customerName: await encRequired(params.dek, params.customerName, 100, 'Walk-in Customer'),
      customerPhone: await enc(params.dek, params.customerPhone, 20),
      items: encryptedItems,
      subtotal,
      totalGst,
      discountAmount,
      totalAmount,
      paymentStatus,
      ...(params.linkedTxId ? { linkedTxId: clampStr(params.linkedTxId, 128) } : {}),
      ...(params.createdByName
        ? { createdByName: await enc(params.dek, params.createdByName, 80) }
        : {}),
      ...(estimatedCost > 0 ? { estimatedCost } : {}),
      templateId: params.templateId,
      notes: await enc(params.dek, params.notes, 240),
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
        category: await encRequired(params.dek, 'Bill Sale', 40, 'Bill Sale'),
        amount: totalAmount,
        note: await enc(params.dek, `${params.billNumber} · ${params.customerName}`, 200),
        entryDate: clampStr(params.billDate, 40),
        linkedRefId: id,
        ...(params.createdByName
          ? { actorName: await enc(params.dek, params.createdByName, 80) }
          : {}),
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
  dek?: CryptoKey | null;
}): Promise<string> {
  const id = params.existingId || makeSafeId('stk');
  const cleanPurchase = Math.max(0, Number(params.purchasePrice) || 0);
  try {
    const encName = await encRequired(params.dek, params.name, 100, 'Item');
    const encUnit = await encRequired(params.dek, params.unit, 24, 'pcs');
    if (params.existingId) {
      await updateDoc(doc(db, 'stockItems', id), {
        name: encName,
        unit: encUnit,
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
        name: encName,
        unit: encUnit,
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
  dek?: CryptoKey | null;
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
      category: await encRequired(params.dek, params.category, 40, 'General'),
      amount: cleanAmount,
      note: await enc(params.dek, params.note, 200),
      entryDate: clampStr(params.entryDate || new Date().toISOString(), 40),
      ...(params.linkedRefId ? { linkedRefId: clampStr(params.linkedRefId, 128) } : {}),
      ...(params.actorName ? { actorName: await enc(params.dek, params.actorName, 80) } : {}),
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
  dek?: CryptoKey | null;
}): Promise<string> {
  const id = params.existingId || makeSafeId('stf');
  try {
    const encName = await encRequired(params.dek, params.name, 80, 'Staff');
    const encPhone = await enc(params.dek, params.phone, 20);
    if (params.existingId) {
      const updatePayload: Record<string, unknown> = {
        name: encName,
        role: params.role,
        phone: encPhone,
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
        name: encName,
        role: params.role,
        phone: encPhone,
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
  dek?: CryptoKey | null;
}): Promise<void> {
  const id = makeSafeId('log');
  try {
    await setDoc(doc(db, 'activityLogs', id), {
      ownerId: params.ownerId,
      businessId: params.businessId,
      actorName: await encRequired(params.dek, params.actorName, 80, 'Owner'),
      actorRole: params.actorRole,
      actionType: params.actionType,
      summary: await encRequired(params.dek, params.summary, 240, 'Action recorded'),
      targetName: await enc(params.dek, params.targetName, 100),
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
    refs.push(doc(db, 'users', ownerId, 'security', 'vault'));
    refs.push(doc(db, 'users', ownerId));
    await commitDeletesInChunks(refs, 400);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${ownerId}`);
  }
}

export async function restoreBusinessBackup(
  ownerId: string,
  businessId: string,
  rawParsed: unknown,
  dek?: CryptoKey | null,
  options?: { mode?: 'merge' | 'replace' }
): Promise<{ accounts: number; transactions: number; bills: number; stockItems: number }> {
  if (options?.mode === 'replace') {
    await clearBusinessData(ownerId, businessId);
  }
  const parsed = validateSafeBackupJson(rawParsed);

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
      const namePlain = clampStr(String(a.name || ''), 100);
      if (!namePlain) continue;
      const oldId = String(a.id || makeSafeId('old'));
      const newAccId = makeSafeId('acc');
      accIdMap.set(oldId, newAccId);
      const kind: AccountKind = a.kind === 'supplier' ? 'supplier' : 'customer';
      const creditLimit = Math.min(100000000, Math.max(0, Math.round(Number(a.creditLimit) || 0)));
      const balance = Math.round((Number(a.balance) || 0) * 100) / 100;
      const validAccCtx =
        a.personaContext === 'personal' ||
        a.personaContext === 'kirana' ||
        a.personaContext === 'mandi' ||
        a.personaContext === 'wholesale'
          ? a.personaContext
          : undefined;
      const docData = {
        ownerId,
        businessId,
        kind,
        ...(validAccCtx ? { personaContext: validAccCtx } : {}),
        name: await encRequired(dek, namePlain, 100, 'Customer'),
        phone: await enc(dek, String(a.phone || ''), 20),
        dueDate: clampStr(String(a.dueDate || ''), 24),
        ...(creditLimit > 0 ? { creditLimit } : {}),
        ...(a.promiseDate ? { promiseDate: clampStr(String(a.promiseDate), 24) } : {}),
        ...(a.promiseNote ? { promiseNote: await enc(dek, String(a.promiseNote), 160) } : {}),
        balance,
        lastNote: await encRequired(dek, String(a.lastNote || 'Restored'), 160, 'Restored'),
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
      const validTxCtx =
        t.personaContext === 'personal' ||
        t.personaContext === 'kirana' ||
        t.personaContext === 'mandi' ||
        t.personaContext === 'wholesale'
          ? t.personaContext
          : undefined;
      const txData = {
        ownerId,
        businessId,
        accountId: mappedAcc,
        ...(validTxCtx ? { personaContext: validTxCtx } : {}),
        direction: t.direction === 'received' ? 'received' : 'given',
        amount,
        note: await enc(dek, String(t.note || ''), 240),
        billDate: clampStr(String(t.billDate || new Date().toISOString()), 40),
        voiceRaw: await enc(dek, String(t.voiceRaw || ''), 300),
        billImage: await enc(dek, String(t.billImage || ''), 150000),
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
      const rawItems = Array.isArray(b.items)
        ? b.items
            .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
            .slice(0, 20)
        : [];
      if (rawItems.length === 0) continue;
      const items = await Promise.all(
        rawItems.map(async (item) => ({
          name: await encRequired(dek, String(item.name || 'Item'), 80, 'Item'),
          qty: Math.max(0.01, Number(item.qty) || 1),
          rate: Math.max(0, Number(item.rate) || 0),
          gstRate: Math.max(0, Number(item.gstRate) || 0),
        }))
      );
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
        customerName: await encRequired(
          dek,
          String(b.customerName || 'Walk-in Customer'),
          100,
          'Walk-in Customer'
        ),
        customerPhone: await enc(dek, String(b.customerPhone || ''), 20),
        items,
        subtotal: Math.max(0, Number(b.subtotal) || 0),
        totalGst: Math.max(0, Number(b.totalGst) || 0),
        discountAmount: Math.max(0, Number(b.discountAmount) || 0),
        totalAmount: Math.max(0, Number(b.totalAmount) || 0),
        paymentStatus:
          b.paymentStatus === 'unpaid' || b.paymentStatus === 'partial' ? b.paymentStatus : 'paid',
        templateId: tpl,
        notes: await enc(dek, String(b.notes || ''), 240),
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
      const namePlain = clampStr(String(s.name || ''), 100);
      if (!namePlain) continue;
      const newStockId = makeSafeId('stk');
      const stockData = {
        ownerId,
        businessId,
        name: await encRequired(dek, namePlain, 100, 'Item'),
        unit: await encRequired(dek, String(s.unit || 'pcs'), 24, 'pcs'),
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
        category: await encRequired(dek, String(c.category || 'General'), 40, 'General'),
        amount,
        note: await enc(dek, String(c.note || ''), 200),
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
