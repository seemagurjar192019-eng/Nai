import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  E2EE_PREFIX,
  E2EEDecryptError,
  decryptString,
  encryptString,
  generateDekBytes,
  importDekKey,
  isEncryptedEnvelope,
  tryDecryptString,
  unwrapDekAutoForUid,
  unwrapDekWithPin,
  wrapDekAutoForUid,
  wrapDekWithPin,
} from './e2ee';
import {
  applyAddTransactionAtomic,
  GUEST_ENCRYPTED_VAULT_KEY,
  GUEST_VAULT_STORAGE_KEY,
  clearGuestVault,
  createInitialGuestVault,
  loadEncryptedGuestVault,
  saveEncryptedGuestVault,
} from './guest-store';
import { formatLastBackupLabel, hashPinForUid, maskContactIdentifier, verifyStoredPin } from './i18n';
import {
  clearDeviceSecurityPrefs,
  getAutoLockSeconds,
  getLastBackupAt,
  getPinCooldownSeconds,
  getPrivacyCurtainEnabled,
  getScramblePinPadEnabled,
  getStoredPasskeyId,
  hasValidImageMagicBytes,
  normalizeAutoLockSeconds,
  recordLastBackupAt,
  recordPinFailure,
  resetPinGuard,
  sanitizeCsvCell,
  setAutoLockSeconds,
  setPrivacyCurtainEnabled,
  setScramblePinPadEnabled,
  setStoredPasskeyId,
  stripDangerousKeys,
  validateSafeBackupJson,
  verifyApiRequestBoundary,
} from './security';

function installMockWindowStorage() {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  (globalThis as unknown as { window?: { localStorage: typeof mockLocalStorage } }).window = {
    localStorage: mockLocalStorage,
  };
  return store;
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('Zero-Knowledge E2EE Crypto Engine', () => {
  it('encrypts and decrypts UTF-8 strings with AES-256-GCM and preserves legacy plaintext', async () => {
    const raw = await generateDekBytes();
    assert.equal(raw.byteLength, 32);
    const key = await importDekKey(raw);

    const secret = 'Ramesh Kirana · ₹4,850 Udhaar';
    const cipher = await encryptString(key, secret);
    assert.equal(isEncryptedEnvelope(cipher), true);
    assert.equal(cipher.startsWith(E2EE_PREFIX), true);
    assert.equal(cipher.includes('Ramesh'), false);

    // Double-encrypting an existing envelope must be idempotent
    const doubleCipher = await encryptString(key, cipher);
    assert.equal(doubleCipher, cipher);

    const decrypted = await decryptString(key, cipher);
    assert.equal(decrypted, secret);

    // Legacy plaintext passes through transparently
    assert.equal(await decryptString(key, 'Legacy Plaintext'), 'Legacy Plaintext');
  });

  it('rejects tampered ciphertext/IV and wrong keys', async () => {
    const keyA = await importDekKey(await generateDekBytes());
    const keyB = await importDekKey(await generateDekBytes());
    const cipher = await encryptString(keyA, 'Sensitive party note');

    await assert.rejects(() => decryptString(keyB, cipher), E2EEDecryptError);
    await assert.rejects(() => decryptString(null, cipher), E2EEDecryptError);

    // Tamper the ciphertext payload character
    const tampered = cipher.slice(0, -2) + (cipher.endsWith('AA') ? 'BB' : 'AA');
    await assert.rejects(() => decryptString(keyA, tampered), E2EEDecryptError);

    assert.equal(await tryDecryptString(keyB, cipher), 'Locked record');
  });

  it('wraps and unwraps DEK using PBKDF2-SHA256 PIN envelope and UID auto-wrap', async () => {
    const dekBytes = await generateDekBytes();
    const pinEnvelope = await wrapDekWithPin(dekBytes, '4829', 10_000);
    assert.equal(pinEnvelope.mode, 'pin');
    assert.equal(pinEnvelope.version, 1);

    const unwrappedPinDek = await unwrapDekWithPin(pinEnvelope, '4829');
    assert.deepEqual(unwrappedPinDek, dekBytes);

    await assert.rejects(() => unwrapDekWithPin(pinEnvelope, '0000'), E2EEDecryptError);

    const autoEnvelope = await wrapDekAutoForUid(dekBytes, 'uid_owner_1');
    assert.equal(autoEnvelope.mode, 'auto');
    const unwrappedAuto = await unwrapDekAutoForUid(autoEnvelope, 'uid_owner_1');
    assert.deepEqual(unwrappedAuto, dekBytes);

    await assert.rejects(() => unwrapDekAutoForUid(autoEnvelope, 'uid_attacker_2'), E2EEDecryptError);
  });
});

describe('Encrypted Guest Vault Migration & Persistence', () => {
  it('encrypts saved guest vault under encrypted key and transparently migrates legacy plaintext', async () => {
    const store = installMockWindowStorage();
    const dek = await importDekKey(await generateDekBytes());

    const vault = createInitialGuestVault({ language: 'en', appearance: 'light' });
    vault.businesses[0].name = 'Kesar Traders';

    await saveEncryptedGuestVault(dek, vault);
    const storedEnc = store.get(GUEST_ENCRYPTED_VAULT_KEY);
    assert.ok(storedEnc);
    assert.equal(storedEnc.startsWith(E2EE_PREFIX), true);
    assert.equal(storedEnc.includes('Kesar Traders'), false);
    assert.equal(store.has(GUEST_VAULT_STORAGE_KEY), false);

    const loaded = await loadEncryptedGuestVault(dek);
    assert.equal(loaded.businesses[0].name, 'Kesar Traders');

    // Legacy plaintext migration path
    clearGuestVault();
    store.set(GUEST_VAULT_STORAGE_KEY, JSON.stringify(vault));
    const migrated = await loadEncryptedGuestVault(dek);
    assert.equal(migrated.businesses[0].name, 'Kesar Traders');
    assert.equal(store.has(GUEST_VAULT_STORAGE_KEY), false);
    assert.equal(store.get(GUEST_ENCRYPTED_VAULT_KEY)?.startsWith(E2EE_PREFIX), true);
  });
});

describe('Salted PBKDF2 PIN Hashing & Persistent Brute-Force Lockout', () => {
  it('hashes PIN with random PBKDF2 salt scoped to UID and verifies accurately', async () => {
    const h1 = await hashPinForUid('7391', 'user_abc');
    const h2 = await hashPinForUid('7391', 'user_abc');
    assert.equal(h1.startsWith('pbkdf2:100000:'), true);
    assert.notEqual(h1, h2);
    assert.equal(h1.includes('7391'), false);

    assert.equal(await verifyStoredPin('7391', h1, 'user_abc'), true);
    assert.equal(await verifyStoredPin('9999', h1, 'user_abc'), false);
    assert.equal(await verifyStoredPin('7391', h1, 'other_user'), false);
  });

  it('enforces progressive cooldown at 5, 8, and 10 failures and clears on reset', () => {
    installMockWindowStorage();
    resetPinGuard();
    assert.equal(getPinCooldownSeconds(1_000_000), 0);

    for (let i = 1; i <= 4; i++) {
      const res = recordPinFailure(1_000_000);
      assert.equal(res.cooldownSeconds, 0);
      assert.equal(res.remainingBeforeLock, 5 - i);
    }

    const lock5 = recordPinFailure(1_000_000);
    assert.equal(lock5.cooldownSeconds, 30);
    assert.equal(getPinCooldownSeconds(1_010_000), 20);

    recordPinFailure(1_040_000); // 6
    recordPinFailure(1_040_000); // 7
    const lock8 = recordPinFailure(1_040_000); // 8
    assert.equal(lock8.cooldownSeconds, 120);

    recordPinFailure(1_200_000); // 9
    const lock10 = recordPinFailure(1_200_000); // 10
    assert.equal(lock10.cooldownSeconds, 300);

    resetPinGuard();
    assert.equal(getPinCooldownSeconds(1_200_000), 0);
  });
});

describe('Security Hardening Helpers (CSV, JSON Backup, Image Magic Bytes, API Boundary)', () => {
  it('neutralizes CSV spreadsheet formula injection vectors', () => {
    assert.equal(sanitizeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
    assert.equal(sanitizeCsvCell('+1+1'), `"'+1+1"`);
    assert.equal(sanitizeCsvCell('-2*3'), `"'-2*3"`);
    assert.equal(sanitizeCsvCell('@SUM(A1:A2)'), `"'@SUM(A1:A2)"`);
    assert.equal(sanitizeCsvCell('\t=HYPERLINK("https://x")'), `"'\t=HYPERLINK(""https://x"")"`);
    assert.equal(sanitizeCsvCell('Ramesh "Shop"'), `"Ramesh ""Shop"""`);
  });

  it('strips prototype-pollution keys and validates backup JSON schema', () => {
    const evilPayload = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"bad":1},"accounts":[{"id":"a1","name":"Anil","balance":400,"prototype":{"x":1}}]}'
    );
    const stripped = stripDangerousKeys(evilPayload) as Record<string, unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(stripped, '__proto__'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'constructor'), false);

    const validated = validateSafeBackupJson(evilPayload);
    assert.equal(validated.accounts.length, 1);
    assert.equal(validated.accounts[0].name, 'Anil');

    assert.throws(() => validateSafeBackupJson('{"accounts":[]}'), /zero importable records/);
    assert.throws(() => validateSafeBackupJson('not-json'), /JSON/);
    assert.throws(() => validateSafeBackupJson('[]'), /Invalid JSON backup structure/);
  });

  it('validates JPEG, PNG, and WebP magic bytes and blocks spoofed SVG/HTML payloads', () => {
    const validPngB64 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]).toString('base64');
    const validJpegB64 = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]).toString('base64');
    const validWebpB64 = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]).toString('base64');
    const fakeSvgB64 = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');

    assert.equal(hasValidImageMagicBytes(validPngB64, 'image/png'), true);
    assert.equal(hasValidImageMagicBytes(validJpegB64, 'image/jpeg'), true);
    assert.equal(hasValidImageMagicBytes(validWebpB64, 'image/webp'), true);
    assert.equal(hasValidImageMagicBytes(fakeSvgB64, 'image/png'), false);
    assert.equal(hasValidImageMagicBytes(validPngB64, 'image/jpeg'), false);
  });

  it('enforces same-origin and JSON Content-Type boundaries on API requests', () => {
    const validHeaders = new Headers({
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      origin: 'https://ucred.app',
      host: 'ucred.app',
    });
    assert.equal(verifyApiRequestBoundary(validHeaders).ok, true);

    const crossSiteHeaders = new Headers({
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
      origin: 'https://evil.example',
      host: 'ucred.app',
    });
    assert.equal(verifyApiRequestBoundary(crossSiteHeaders).ok, false);

    const wrongContentType = new Headers({
      'content-type': 'text/plain',
      'sec-fetch-site': 'same-origin',
    });
    assert.equal(verifyApiRequestBoundary(wrongContentType).ok, false);
  });

  it('normalizes and persists idle auto-lock, privacy curtain, and passkey preferences safely', () => {
    const store = installMockWindowStorage();

    assert.equal(normalizeAutoLockSeconds(undefined), 0);
    assert.equal(normalizeAutoLockSeconds(42), 0);
    assert.equal(normalizeAutoLockSeconds(60), 60);
    assert.equal(normalizeAutoLockSeconds('300'), 300);
    assert.equal(normalizeAutoLockSeconds(900), 900);

    assert.equal(getAutoLockSeconds(), 0);
    setAutoLockSeconds(300);
    assert.equal(getAutoLockSeconds(), 300);

    assert.equal(getPrivacyCurtainEnabled(), false);
    setPrivacyCurtainEnabled(true);
    assert.equal(getPrivacyCurtainEnabled(), true);

    assert.equal(getStoredPasskeyId(), '');
    setStoredPasskeyId('cred_test_b64url');
    assert.equal(getStoredPasskeyId(), 'cred_test_b64url');

    clearDeviceSecurityPrefs();
    assert.equal(getAutoLockSeconds(), 0);
    assert.equal(getPrivacyCurtainEnabled(), false);
    assert.equal(getStoredPasskeyId(), '');
    assert.equal(store.size, 0);
  });

  it('masks personal email/mobile identifiers cleanly, formats backup timestamps, and persists scramble keypad', () => {
    installMockWindowStorage();

    assert.equal(maskContactIdentifier('owner.shop@gmail.com'), 'ow••••@gmail.com');
    assert.equal(maskContactIdentifier('+91 9876543210'), '••••••3210');
    assert.equal(maskContactIdentifier(''), '');

    const nowMs = new Date(2026, 4, 15, 17, 0, 0).getTime();
    const todayIso = new Date(2026, 4, 15, 16, 10, 0).toISOString();
    const yestIso = new Date(2026, 4, 14, 11, 30, 0).toISOString();
    assert.equal(formatLastBackupLabel(null, nowMs), 'Last backup: Not backed up yet');
    assert.match(formatLastBackupLabel(todayIso, nowMs), /^Last backup: Today 4:10\s*PM$/);
    assert.match(formatLastBackupLabel(yestIso, nowMs), /^Last backup: Yesterday 11:30\s*AM$/);

    assert.equal(getLastBackupAt(), null);
    recordLastBackupAt(todayIso);
    assert.equal(getLastBackupAt(), todayIso);

    assert.equal(getScramblePinPadEnabled(), false);
    setScramblePinPadEnabled(true);
    assert.equal(getScramblePinPadEnabled(), true);

    clearDeviceSecurityPrefs();
    assert.equal(getLastBackupAt(), null);
    assert.equal(getScramblePinPadEnabled(), false);
  });

  it('creates party and entry atomically from empty guest vault via inline quick-add path', () => {
    const vault = createInitialGuestVault({ language: 'en', appearance: 'light' });
    assert.equal(vault.accounts.length, 0);
    const bizId = vault.businesses[0].id;

    const givenStep = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      customerName: 'Sharma Ji',
      direction: 'given',
      amount: 500,
      note: 'Quick entry',
    });
    assert.equal(givenStep.vault.accounts.length, 1);
    assert.equal(givenStep.account.name, 'Sharma Ji');
    assert.equal(givenStep.newBalance, 500);
    assert.equal(givenStep.vault.transactions.length, 1);

    const receivedStep = applyAddTransactionAtomic(givenStep.vault, {
      businessId: bizId,
      existingAccount: givenStep.account,
      customerName: 'Sharma Ji',
      direction: 'received',
      amount: 200,
      note: 'Cash part payment',
    });
    assert.equal(receivedStep.vault.accounts.length, 1);
    assert.equal(receivedStep.newBalance, 300);
    assert.equal(receivedStep.vault.transactions.length, 2);
  });
});

