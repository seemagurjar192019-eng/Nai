# Security Summary

Ucred implements defense-in-depth client-side Zero-Knowledge End-to-End Encryption (E2EE), strict database access boundaries, idle auto-lock, tab privacy masking, optional local biometric passkey unlocking, brute-force lockouts, and hardened API request validation at zero additional infrastructure cost.

## Architecture & Protections

1. **Zero-Knowledge Client-Side E2EE (`AES-256-GCM` + `PBKDF2-SHA256`)**
   - Every sensitive business ledger field (party names, phone numbers, transaction notes, voice transcripts, receipt images, stock item names, bill customer fields, cashbook descriptions, and staff profiles) is encrypted client-side before persistence using a 256-bit Data Encryption Key (DEK) with unique 96-bit IVs per field (`e2ee:v1:<iv>:<ciphertext>`).
   - **Auto-Sync Mode**: Wraps the DEK cleanly for the authenticated Firebase UID and persists the device key in IndexedDB (`ucred_e2ee_keystore_v1`), ensuring Firestore stores ciphertext envelopes while keeping seamless login active.
   - **Strict PIN Mode & Recovery Key**: Wraps the DEK with a user-chosen Secret Recovery Key via 150,000-iteration PBKDF2-SHA256. The unwrapped DEK stays strictly in active-tab `sessionStorage` and is wiped on sign-out or account deletion—so neither the cloud database nor server logs can decrypt records without the user's secret key. Users can also reveal and copy their 256-bit local vault recovery key from Settings -> Privacy & Security.
   - **Guest Offline Vault**: Encrypts local browser ledger storage (`ucred_guest_vault_enc_v1`) with an IndexedDB device key and transparently migrates legacy plaintext entries (`ucred_guest_vault_v1`), removing the plaintext key immediately.

2. **Strict Multi-Tenant Firestore Security Rules**
   - Unauthenticated access is denied globally by default (`allow read, write: if false`).
   - All collections enforce `request.auth != null` and strict `ownerId == request.auth.uid` ownership checks on reads, updates, deletes, and creates.
   - Field-type and byte/character-length limits (`isString`, `isNonNegNumber`, `hasOnly`) prevent oversized document flooding, cross-tenant `ownerId` tampering, and schema injection.
   - Staff role values, transaction directions, and numeric ranges are enforced directly in rules.

3. **App Lock PIN, Idle Auto-Lock, Privacy Curtain & Biometric Passkey**
   - App PINs are hashed with random 12-byte salts and 100,000-iteration PBKDF2-SHA256 (`pbkdf2:100000:<salt>:<digest>`) scoped to the user UID.
   - Repeated failed attempts trigger persistent cooldown windows stored across page reloads (30s at 5 failures, 120s at 8 failures, 300s at 10+ failures).
   - **Idle Auto-Lock**: Configurable inactivity watchdog (`Off`, `1m`, `5m`, `15m`) automatically locks the screen with `PinLockOverlay` when a PIN is enabled (`useVaultSecurity`).
   - **Tab Privacy Curtain**: Optional instant matte privacy shield (`visibilitychange` & `window.blur`) hides ledger figures when switching apps or browser tabs.
   - **Local Biometric Passkey (WebAuthn)**: Supported browsers can register a platform authenticator (`navigator.credentials.create` / `.get` with `userVerification: 'required'`) to unlock the local App Lock screen without typing digits.

4. **API Route, File Upload, Transport Headers & Import/Export Hardening**
   - Voice parsing and receipt scanning API routes verify `application/json` content types, block cross-site requests (`sec-fetch-site: cross-site`), validate Origin/Host parity, enforce Firebase Bearer tokens on authenticated sessions, validate JPEG/PNG/WebP binary magic bytes, and apply sliding-window per-client rate limiting.
   - CSV exports neutralize formula-injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) before RFC-4180 quoting (`useLedgerBackup`).
   - JSON backup imports enforce a 5 MB file limit, recursively strip `__proto__`, `constructor`, and `prototype` keys, and validate strict Zod payload schemas before committing any record.
   - Production builds strip browser source maps (`productionBrowserSourceMaps: false`) and `X-Powered-By` headers while emitting strict CSP, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` headers.

---

## PoC Verification

The security controls above were verified through automated unit tests (`npx --yes tsx --test lib/*.test.ts`) and live headless Chromium inspection (`http://localhost:3000`):

- **E2EE Round-Trip & Tamper Rejection**: Verified `encryptString` produces `e2ee:v1:` envelopes hiding plaintext, `decryptString` recovers exact UTF-8 payloads, wrong keys and 1-byte tampered ciphertexts throw `E2EEDecryptError`, and both `wrapDekWithPin`/`unwrapDekWithPin` and `wrapDekAutoForUid`/`unwrapDekAutoForUid` enforce exact key/UID binding.
- **Guest Storage Migration & Empty-Vault Inline Entry**: Verified `saveEncryptedGuestVault` writes ciphertext under `ucred_guest_vault_enc_v1` without storing plaintext party names or amounts, `loadEncryptedGuestVault` automatically converts legacy plaintext vaults into encrypted envelopes and deletes `ucred_guest_vault_v1`, and `applyAddTransactionAtomic` creates parties and updates running balances cleanly starting from an empty initial vault.
- **PIN Brute-Force Lockout & Device Security Prefs**: Verified PBKDF2 PIN digests produce unique salted hashes across identical PIN inputs and fail cross-UID verification; confirmed 5/8/10 consecutive failures enforce 30s/120s/300s cooldowns via `getPinCooldownSeconds` until `resetPinGuard()` clears state; verified `normalizeAutoLockSeconds`, `setAutoLockSeconds`, `setPrivacyCurtainEnabled`, `setStoredPasskeyId`, and `clearDeviceSecurityPrefs` isolate and wipe device preferences cleanly.
- **Formula, Backup & Binary Header Checks**: Verified `sanitizeCsvCell` prefixes `=CMD(...)`, `+1+1`, `-2*3`, `@SUM(...)`, and `\t=...` with `'`; verified `validateSafeBackupJson` drops `__proto__`/`constructor` keys and rejects invalid payloads; verified `hasValidImageMagicBytes` validates genuine PNG/JPEG/WebP binary signatures and rejects disguised SVG/HTML payloads; verified `verifyApiRequestBoundary` rejects `cross-site` requests and non-JSON payloads.
