/**
 * IndexedDB primary persistence layer for Ucred local vaults & compressed bill attachments.
 * Prevents localStorage 5MB QuotaExceeded crashes when storing thousands of khata entries
 * and scanned parchi/bill images on zero-budget devices.
 */

const DB_NAME = 'ucred_vault_db_v1';
const DB_VERSION = 1;
const VAULT_STORE = 'vault_kv';
const BILL_IMAGE_STORE = 'bill_images';
const LOCAL_LAST_BACKUP_KEY = 'ucred_last_backup_at';

export interface StorageWarningEvent {
  reason: 'quota' | 'idb-unavailable' | 'write-failed';
  message: string;
}

type StorageWarningListener = (evt: StorageWarningEvent) => void;
const listeners = new Set<StorageWarningListener>();

export function subscribeStorageWarnings(listener: StorageWarningListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStorageWarning(evt: StorageWarningEvent): void {
  for (const listener of listeners) {
    try {
      listener(evt);
    } catch {
      // Ignore listener errors
    }
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
      if (!db.objectStoreNames.contains(BILL_IMAGE_STORE)) {
        db.createObjectStore(BILL_IMAGE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function idbGetVaultString(key: string): Promise<string | null> {
  if (!isIndexedDbAvailable()) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDatabase();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db!.transaction(VAULT_STORE, 'readonly');
      const store = tx.objectStore(VAULT_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(typeof req.result === 'string' ? req.result : null);
      };
      req.onerror = () => reject(req.error || new Error('IDB read failed'));
    });
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore close
    }
  }
}

export async function idbSetVaultString(key: string, value: string): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDatabase();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db!.transaction(VAULT_STORE, 'readwrite');
      const store = tx.objectStore(VAULT_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'QuotaExceededError') {
      emitStorageWarning({
        reason: 'quota',
        message: 'Device storage is full. Export a JSON backup and clear old images.',
      });
    }
    return false;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore close
    }
  }
}

export async function idbDeleteVaultString(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDatabase();
    await new Promise<void>((resolve) => {
      const tx = db!.transaction(VAULT_STORE, 'readwrite');
      tx.objectStore(VAULT_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB clear failure
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}

export async function idbPutBillImage(imageId: string, dataUrl: string): Promise<boolean> {
  if (!isIndexedDbAvailable() || !imageId || !dataUrl) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDatabase();
    return await new Promise<boolean>((resolve) => {
      const tx = db!.transaction(BILL_IMAGE_STORE, 'readwrite');
      tx.objectStore(BILL_IMAGE_STORE).put(dataUrl, imageId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}

export async function idbGetBillImage(imageId: string): Promise<string | null> {
  if (!isIndexedDbAvailable() || !imageId) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDatabase();
    return await new Promise<string | null>((resolve) => {
      const tx = db!.transaction(BILL_IMAGE_STORE, 'readonly');
      const req = tx.objectStore(BILL_IMAGE_STORE).get(imageId);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Checks if user has >= threshold transactions/records and hasn't exported a backup in >= 7 days.
 */
export function isWeeklyBackupRecommended(
  recordCount: number,
  nowMs: number = Date.now(),
  maxAgeDays: number = 7
): { needed: boolean; daysSinceBackup: number | null } {
  if (recordCount < 5) {
    return { needed: false, daysSinceBackup: null };
  }
  if (typeof window === 'undefined') {
    return { needed: false, daysSinceBackup: null };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_LAST_BACKUP_KEY);
    if (!raw) {
      return { needed: true, daysSinceBackup: null };
    }
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) {
      return { needed: true, daysSinceBackup: null };
    }
    const diffDays = Math.floor(Math.max(0, nowMs - parsed) / 86_400_000);
    return {
      needed: diffDays >= maxAgeDays,
      daysSinceBackup: diffDays,
    };
  } catch {
    return { needed: false, daysSinceBackup: null };
  }
}
