import { z } from 'zod';

/**
 * Defense-in-depth security utilities for Ucred:
 * - CSV formula injection prevention
 * - Prototype pollution safe JSON backup validation
 * - Image MIME magic-byte signature validation
 * - Server-side API request origin & Bearer auth verification
 * - Persistent App PIN brute-force rate limiting
 */

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Neutralize spreadsheet formula triggers (`=`, `+`, `-`, `@`) and apply RFC-4180 CSV quoting. */
export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.replace(/^[\u0000-\u001F\s]+/, '');
  const neutralized = FORMULA_TRIGGER_RE.test(trimmedStart) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/** Recursively strip `__proto__`, `constructor`, and `prototype` keys from untrusted JSON objects. */
export function stripDangerousKeys<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripDangerousKeys(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const clean: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (DANGEROUS_OBJECT_KEYS.has(k)) continue;
      clean[k] = stripDangerousKeys(v);
    }
    return { ...clean } as T;
  }
  return input;
}

const safeStr = (max: number) => z.string().max(max).optional().default('');
const safeNum = (min = -100_000_000, max = 100_000_000) =>
  z.number().finite().min(min).max(max).optional().default(0);

const backupAccountSchema = z
  .object({
    id: safeStr(128),
    kind: z.enum(['customer', 'supplier']).optional().default('customer'),
    personaContext: z.enum(['personal', 'kirana', 'mandi', 'wholesale']).optional(),
    name: z.string().min(1).max(512),
    phone: safeStr(256),
    dueDate: safeStr(32),
    creditLimit: safeNum(0),
    promiseDate: safeStr(32).optional(),
    promiseNote: safeStr(512).optional(),
    balance: z.number().finite().min(-100_000_000).max(100_000_000).optional().default(0),
    lastNote: safeStr(512),
    lastActivityAt: safeStr(48),
  })
  .passthrough();

const backupTxSchema = z
  .object({
    id: safeStr(128),
    accountId: safeStr(128),
    personaContext: z.enum(['personal', 'kirana', 'mandi', 'wholesale']).optional(),
    direction: z.enum(['given', 'received']),
    amount: z.number().finite().positive().max(100_000_000),
    note: safeStr(1024),
    billDate: safeStr(48),
    voiceRaw: safeStr(1024),
    billImage: safeStr(350_000),
    createdByName: safeStr(256).optional(),
    createdByRole: z.enum(['owner', 'munim', 'cashier']).optional(),
    gallaSynced: z.boolean().optional(),
  })
  .passthrough();

const backupBillItemSchema = z.object({
  name: z.string().min(1).max(256),
  qty: z.number().finite().positive().max(100_000),
  rate: z.number().finite().min(0).max(100_000_000),
  gstRate: z.number().finite().min(0).max(28),
  stockItemId: safeStr(128).optional(),
});

const backupBillSchema = z
  .object({
    id: safeStr(128),
    docType: z.enum(['bill', 'quote']).optional().default('bill'),
    billNumber: z.string().min(1).max(64),
    customerName: z.string().min(1).max(512),
    customerPhone: safeStr(256),
    items: z.array(backupBillItemSchema).min(1).max(30),
    subtotal: safeNum(0),
    totalGst: safeNum(0),
    discountAmount: safeNum(0).optional(),
    totalAmount: safeNum(0),
    paymentStatus: z.enum(['paid', 'unpaid', 'partial']).optional(),
    templateId: z.enum(['classic', 'modern', 'gst-color', 'thermal-58']).optional().default('gst-color'),
    notes: safeStr(1024),
    billDate: safeStr(48),
  })
  .passthrough();

const backupStockSchema = z
  .object({
    id: safeStr(128),
    name: z.string().min(1).max(512),
    unit: safeStr(40),
    salePrice: safeNum(0),
    purchasePrice: safeNum(0).optional(),
    quantity: safeNum(0),
    lowStockThreshold: safeNum(0),
  })
  .passthrough();

const backupCashbookSchema = z
  .object({
    id: safeStr(128),
    entryType: z.enum(['inflow', 'outflow']),
    mode: z.enum(['cash', 'upi', 'bank']).optional().default('cash'),
    category: safeStr(80),
    amount: z.number().finite().positive().max(100_000_000),
    note: safeStr(1024),
    entryDate: safeStr(48),
    actorName: safeStr(256).optional(),
  })
  .passthrough();

export const validatedBackupSchema = z.object({
  accounts: z.array(backupAccountSchema).max(2000).optional().default([]),
  transactions: z.array(backupTxSchema).max(5000).optional().default([]),
  bills: z.array(backupBillSchema).max(2000).optional().default([]),
  stockItems: z.array(backupStockSchema).max(2000).optional().default([]),
  cashbookEntries: z.array(backupCashbookSchema).max(3000).optional().default([]),
});

export type ValidatedBackupPayload = z.infer<typeof validatedBackupSchema>;

export function validateSafeBackupJson(rawTextOrObject: string | unknown): ValidatedBackupPayload {
  let rawObj: unknown = rawTextOrObject;
  if (typeof rawTextOrObject === 'string') {
    if (rawTextOrObject.length > 5_000_000) {
      throw new Error('Backup file exceeds 5 MB limit.');
    }
    rawObj = JSON.parse(rawTextOrObject);
  }
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw new Error('Invalid JSON backup structure.');
  }
  const sanitized = stripDangerousKeys(rawObj);
  const parsed = validatedBackupSchema.safeParse(sanitized);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Backup schema validation failed.');
  }
  const d = parsed.data;
  if (
    d.accounts.length === 0 &&
    d.transactions.length === 0 &&
    d.bills.length === 0 &&
    d.stockItems.length === 0 &&
    d.cashbookEntries.length === 0
  ) {
    throw new Error('Backup contains zero importable records.');
  }
  return d;
}

/** Verify image base64 magic bytes match JPEG, PNG, or WebP to block MIME spoofing. */
export function hasValidImageMagicBytes(
  base64Data: string,
  mimeType: string
): boolean {
  try {
    const clean = base64Data.slice(0, 32);
    const bytes =
      typeof Buffer !== 'undefined'
        ? new Uint8Array(Buffer.from(clean, 'base64'))
        : Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    if (bytes.length < 12) return false;
    const m = mimeType.toLowerCase();
    if (m === 'image/jpeg' || m === 'image/jpg') {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (m === 'image/png') {
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    }
    if (m === 'image/webp') {
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    }
    return false;
  } catch {
    return false;
  }
}

/** Server-side guard ensuring API calls originate from this app session or carry valid same-origin headers. */
export function verifyApiRequestBoundary(headers: Headers): { ok: boolean; reason?: string } {
  const contentType = headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: false, reason: 'Unsupported Content-Type.' };
  }
  const secFetchSite = (headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return { ok: false, reason: 'Cross-site API requests are blocked.' };
  }
  const origin = headers.get('origin');
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (originHost !== host.toLowerCase()) {
        return { ok: false, reason: 'Origin mismatch.' };
      }
    } catch {
      return { ok: false, reason: 'Invalid Origin header.' };
    }
  }
  return { ok: true };
}

// Persistent App PIN Brute-Force Lockout Manager
const PIN_LOCK_STORAGE_KEY = 'ucred_pin_guard_v1';

interface PinGuardState {
  failures: number;
  lockedUntilMs: number;
}

function readPinGuardState(): PinGuardState {
  if (typeof window === 'undefined') return { failures: 0, lockedUntilMs: 0 };
  try {
    const raw = window.localStorage.getItem(PIN_LOCK_STORAGE_KEY);
    if (!raw) return { failures: 0, lockedUntilMs: 0 };
    const p = JSON.parse(raw) as Partial<PinGuardState>;
    return {
      failures: Math.max(0, Number(p.failures) || 0),
      lockedUntilMs: Math.max(0, Number(p.lockedUntilMs) || 0),
    };
  } catch {
    return { failures: 0, lockedUntilMs: 0 };
  }
}

function writePinGuardState(state: PinGuardState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PIN_LOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors
  }
}

export function getPinCooldownSeconds(nowMs = Date.now()): number {
  const st = readPinGuardState();
  if (st.lockedUntilMs <= nowMs) return 0;
  return Math.ceil((st.lockedUntilMs - nowMs) / 1000);
}

export function recordPinFailure(nowMs = Date.now()): {
  failures: number;
  cooldownSeconds: number;
  remainingBeforeLock: number;
} {
  const st = readPinGuardState();
  const failures = st.failures + 1;
  let cooldownSeconds = 0;
  if (failures >= 10) cooldownSeconds = 300;
  else if (failures >= 8) cooldownSeconds = 120;
  else if (failures >= 5) cooldownSeconds = 30;

  writePinGuardState({
    failures,
    lockedUntilMs: cooldownSeconds > 0 ? nowMs + cooldownSeconds * 1000 : 0,
  });

  return {
    failures,
    cooldownSeconds,
    remainingBeforeLock: failures < 5 ? 5 - failures : 0,
  };
}

export function resetPinGuard(): void {
  writePinGuardState({ failures: 0, lockedUntilMs: 0 });
}

// Idle Auto-Lock, Privacy Curtain & Local WebAuthn Biometric Passkey Helpers
export type AutoLockSeconds = 0 | 60 | 300 | 900;

const AUTO_LOCK_STORAGE_KEY = 'ucred_auto_lock_sec_v1';
const PRIVACY_CURTAIN_STORAGE_KEY = 'ucred_privacy_curtain_v1';
const PASSKEY_CRED_STORAGE_KEY = 'ucred_passkey_cred_v1';

export function normalizeAutoLockSeconds(raw: unknown): AutoLockSeconds {
  const n = Number(raw);
  if (n === 60 || n === 300 || n === 900) return n;
  return 0;
}

export function getAutoLockSeconds(): AutoLockSeconds {
  if (typeof window === 'undefined') return 0;
  try {
    return normalizeAutoLockSeconds(window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY));
  } catch {
    return 0;
  }
}

export function setAutoLockSeconds(seconds: AutoLockSeconds): AutoLockSeconds {
  const safe = normalizeAutoLockSeconds(seconds);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(safe));
    } catch {
      // Ignore storage write errors
    }
  }
  return safe;
}

export function getPrivacyCurtainEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PRIVACY_CURTAIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPrivacyCurtainEnabled(enabled: boolean): boolean {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRIVACY_CURTAIN_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // Ignore storage write errors
    }
  }
  return enabled;
}

export function getStoredPasskeyId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PASSKEY_CRED_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredPasskeyId(credIdB64: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (credIdB64) {
      window.localStorage.setItem(PASSKEY_CRED_STORAGE_KEY, credIdB64);
    } else {
      window.localStorage.removeItem(PASSKEY_CRED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write errors
  }
}

export function clearDeviceSecurityPrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PIN_LOCK_STORAGE_KEY);
    window.localStorage.removeItem(AUTO_LOCK_STORAGE_KEY);
    window.localStorage.removeItem(PRIVACY_CURTAIN_STORAGE_KEY);
    window.localStorage.removeItem(PASSKEY_CRED_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors
  }
}

export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64 + pad, 'base64'));
  }
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function registerDevicePasskey(label: string): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error('Biometric Passkey is not supported in this browser or context.');
  }
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Ucred Ledger',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: label || 'shop-owner',
        displayName: label || 'Ucred Shop Owner',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 45_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential?.rawId) {
    throw new Error('Passkey registration was cancelled.');
  }
  const idB64 = uint8ToBase64Url(new Uint8Array(credential.rawId));
  setStoredPasskeyId(idB64);
  return idB64;
}

export async function verifyDevicePasskey(): Promise<boolean> {
  const storedId = getStoredPasskeyId();
  if (!storedId || !isWebAuthnSupported()) {
    return false;
  }
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  const rawBytes = base64UrlToUint8(storedId);
  const rawBuffer = new Uint8Array(rawBytes.byteLength);
  rawBuffer.set(rawBytes);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: rawBuffer.buffer,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 45_000,
    },
  });
  return Boolean(assertion);
}

