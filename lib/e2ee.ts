/**
 * Zero-Knowledge Client-Side End-to-End Encryption (E2EE) Engine
 * Uses native Web Crypto API (AES-256-GCM + PBKDF2-SHA256) at zero external cost.
 */

export const E2EE_PREFIX = 'e2ee:v1:';
export const DEFAULT_PIN_ITERATIONS = 150_000;
export const AUTO_WRAP_ITERATIONS = 60_000;
const AUTO_WRAP_DOMAIN_CONTEXT = 'ucred:e2ee:v1:auto-wrap';

export interface VaultKeyEnvelope {
  version: 1;
  mode: 'auto' | 'pin';
  wrappedDek: string;
  iv: string;
  salt: string;
  iterations: number;
}

export class E2EEDecryptError extends Error {
  constructor(message = 'Unable to decrypt encrypted vault data.') {
    super(message);
    this.name = 'E2EEDecryptError';
  }
}

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return c;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode(...slice);
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function isEncryptedEnvelope(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(E2EE_PREFIX);
}

export async function generateDekBytes(): Promise<Uint8Array> {
  const crypto = getCrypto();
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return raw;
}

export async function importDekKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  if (rawBytes.byteLength !== 32) {
    throw new Error('Invalid E2EE key length: expected 256-bit key.');
  }
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(rawBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytesWithKey(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const crypto = getCrypto();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext)
  );
  return { iv, ciphertext: new Uint8Array(encrypted) };
}

export async function decryptBytesWithKey(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const crypto = getCrypto();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return new Uint8Array(plain);
  } catch {
    throw new E2EEDecryptError('Decryption failed: invalid key or modified ciphertext.');
  }
}

/** Encrypt a UTF-8 string into compact envelope `e2ee:v1:<ivB64>:<cipherB64>`. */
export async function encryptString(key: CryptoKey | null, plaintext: string): Promise<string> {
  if (!key || !plaintext) return plaintext;
  if (isEncryptedEnvelope(plaintext)) return plaintext;
  const bytes = new TextEncoder().encode(plaintext);
  const { iv, ciphertext } = await encryptBytesWithKey(key, bytes);
  return `${E2EE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}`;
}

/** Decrypt an `e2ee:v1:` envelope; passes through legacy plaintext strings cleanly. */
export async function decryptString(key: CryptoKey | null, value: string): Promise<string> {
  if (!value || !isEncryptedEnvelope(value)) return value;
  if (!key) {
    throw new E2EEDecryptError('Encryption key required to unlock protected ledger record.');
  }
  const rest = value.slice(E2EE_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep <= 0) {
    throw new E2EEDecryptError('Malformed encrypted payload.');
  }
  const iv = base64ToBytes(rest.slice(0, sep));
  const ciphertext = base64ToBytes(rest.slice(sep + 1));
  const plainBytes = await decryptBytesWithKey(key, iv, ciphertext);
  return new TextDecoder().decode(plainBytes);
}

/** Safe decrypt that falls back cleanly if a single corrupt record exists while flagging lock state. */
export async function tryDecryptString(
  key: CryptoKey | null,
  value: string,
  fallback = 'Locked record'
): Promise<string> {
  if (!value || !isEncryptedEnvelope(value)) return value;
  if (!key) return fallback;
  try {
    return await decryptString(key, value);
  } catch {
    return fallback;
  }
}

async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function wrapDekWithPin(
  dekBytes: Uint8Array,
  pin: string,
  iterations = DEFAULT_PIN_ITERATIONS
): Promise<VaultKeyEnvelope> {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    throw new Error('Vault PIN must be at least 4 characters or digits.');
  }
  const crypto = getCrypto();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const kek = await deriveWrappingKey(cleanPin, salt, iterations);
  const { iv, ciphertext } = await encryptBytesWithKey(kek, dekBytes);
  return {
    version: 1,
    mode: 'pin',
    wrappedDek: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    iterations,
  };
}

export async function unwrapDekWithPin(
  envelope: VaultKeyEnvelope,
  pin: string
): Promise<Uint8Array> {
  const cleanPin = pin.trim();
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.wrappedDek);
  const kek = await deriveWrappingKey(cleanPin, salt, envelope.iterations || DEFAULT_PIN_ITERATIONS);
  return decryptBytesWithKey(kek, iv, ciphertext);
}

export async function wrapDekAutoForUid(dekBytes: Uint8Array, uid: string): Promise<VaultKeyEnvelope> {
  const crypto = getCrypto();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const kek = await deriveWrappingKey(
    `${AUTO_WRAP_DOMAIN_CONTEXT}:${uid}`,
    salt,
    AUTO_WRAP_ITERATIONS
  );
  const { iv, ciphertext } = await encryptBytesWithKey(kek, dekBytes);
  return {
    version: 1,
    mode: 'auto',
    wrappedDek: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    iterations: AUTO_WRAP_ITERATIONS,
  };
}

export async function unwrapDekAutoForUid(
  envelope: VaultKeyEnvelope,
  uid: string
): Promise<Uint8Array> {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.wrappedDek);
  const kek = await deriveWrappingKey(
    `${AUTO_WRAP_DOMAIN_CONTEXT}:${uid}`,
    salt,
    envelope.iterations || AUTO_WRAP_ITERATIONS
  );
  return decryptBytesWithKey(kek, iv, ciphertext);
}

// IndexedDB + Local Fallback Device Keystore (Browser-only)
const IDB_NAME = 'ucred_e2ee_keystore_v1';
const IDB_STORE = 'keys';
const LOCAL_DEK_FALLBACK_KEY = 'ucred_device_dek_v1';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open keystore'));
  });
}

async function idbGet(slot: string): Promise<Uint8Array | null> {
  try {
    const db = await openKeyDb();
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(slot);
      req.onsuccess = () => {
        const val = req.result;
        resolve(val instanceof Uint8Array ? val : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(slot: string, value: Uint8Array): Promise<boolean> {
  try {
    const db = await openKeyDb();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(value, slot);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function idbDelete(slot: string): Promise<void> {
  try {
    const db = await openKeyDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB delete error
  }
}

export async function getOrCreateDeviceDekBytes(scope = 'guest'): Promise<Uint8Array> {
  const slot = `dek:${scope}`;
  const fromIdb = await idbGet(slot);
  if (fromIdb && fromIdb.byteLength === 32) {
    return fromIdb;
  }

  if (typeof window !== 'undefined') {
    try {
      const b64 = window.localStorage.getItem(`${LOCAL_DEK_FALLBACK_KEY}:${scope}`);
      if (b64) {
        const bytes = base64ToBytes(b64);
        if (bytes.byteLength === 32) {
          await idbSet(slot, bytes);
          return bytes;
        }
      }
    } catch {
      // Ignore storage read failure
    }
  }

  const fresh = await generateDekBytes();
  const storedIdb = await idbSet(slot, fresh);
  if (typeof window !== 'undefined' && !storedIdb) {
    try {
      window.localStorage.setItem(`${LOCAL_DEK_FALLBACK_KEY}:${scope}`, bytesToBase64(fresh));
    } catch {
      // Ignore fallback write failure
    }
  }
  return fresh;
}

export async function persistDeviceDekBytes(scope: string, dekBytes: Uint8Array): Promise<void> {
  const slot = `dek:${scope}`;
  const storedIdb = await idbSet(slot, dekBytes);
  if (typeof window !== 'undefined') {
    try {
      if (storedIdb) {
        window.localStorage.removeItem(`${LOCAL_DEK_FALLBACK_KEY}:${scope}`);
      } else {
        window.localStorage.setItem(`${LOCAL_DEK_FALLBACK_KEY}:${scope}`, bytesToBase64(dekBytes));
      }
    } catch {
      // Ignore storage error
    }
  }
}

export async function clearDeviceDekBytes(scope: string): Promise<void> {
  await idbDelete(`dek:${scope}`);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(`${LOCAL_DEK_FALLBACK_KEY}:${scope}`);
    } catch {
      // Ignore storage error
    }
  }
}
