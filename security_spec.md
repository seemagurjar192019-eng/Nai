# Ucred Firestore Security Specification

## Data Invariants
1. **Strict Ownership**: Every document in `businesses`, `accounts`, `transactions`, `bills`, `stockItems`, `cashbookEntries`, `staffMembers`, and `activityLogs` must have `ownerId == request.auth.uid`, and `users/{uid}` is readable/writable only when `request.auth.uid == uid`.
2. **Verified Email Identity**: Write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Referential Integrity on Create**:
   - `accounts/{accountId}`, `bills/{billId}`, `stockItems/{itemId}`, `cashbookEntries/{entryId}`, `staffMembers/{staffId}`, and `activityLogs/{logId}` cannot be created unless `businesses/{businessId}` exists and belongs to `request.auth.uid`.
   - `transactions/{txId}` cannot be created unless `accounts/{accountId}` exists, belongs to `request.auth.uid`, and matches `incoming().businessId`.
4. **Immutable Lineage & Timestamps**: `ownerId`, `businessId`, `accountId`, and `createdAt` cannot change after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
5. **Bounded Types & Strict Keys**: Every collection enforces `keys().hasAll(...)` + `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, numeric bounds (`amount > 0`), optional enum validation (`personaContext in ['personal', 'kirana', 'mandi', 'wholesale']`), and explicit string length caps.
6. **Zero Query Delegation**: Every `allow list` rule explicitly requires `resource.data.ownerId == request.auth.uid` (no `get()`/`exists()` inside `allow list`).

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /accounts/acc1` with `auth == null`.
2. **Cross-Tenant Account Read**: User B (`uid_b`) reads `/accounts/acc_of_user_a`.
3. **Cross-Tenant List Scraping**: User B runs `list /cashbookEntries` without `where('ownerId', '==', 'uid_b')`.
4. **UID Spoofing on Create**: User B creates `/businesses/biz1` with `{ ownerId: 'uid_a', ... }`.
5. **Orphan Account Creation**: User A creates `/cashbookEntries/cb1` referencing non-existent `businessId: 'missing_biz'`.
6. **Cross-Tenant Account Hijack**: User B creates `/transactions/tx1` referencing User A's `accountId`.
7. **Shadow Field Injection**: User A creates `/staffMembers/s1` with extra field `isAdmin: true`.
8. **Backdated Timestamp Spoofing**: User A creates `/activityLogs/log1` with `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()`.
9. **Negative / Zero Amount**: User A creates `/cashbookEntries/cb1` with `amount: -500`.
10. **Immutable Owner Mutation**: User A updates `/staffMembers/s1` attempting to change `ownerId` or `createdAt`.
11. **Oversized String DoS**: User A updates `/businesses/biz1` setting `name` to a 10,000-character string.
12. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/users/{uid}`.
