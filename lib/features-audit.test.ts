import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonthlySimpleInterest,
  computeOverdueAgingBuckets,
  estimateInterestDaysForParty,
} from './vyaaj-interest';
import { findRecentDuplicateTransaction } from './duplicate-guard';
import {
  applyAddTransactionAtomic,
  applyCreateAccount,
  applyMergeAccounts,
  applyUpdateAccountMeta,
  createInitialGuestVault,
} from './guest-store';
import { applyKeypadKey } from './ucred-intelligence';
import {
  computeGstinCheckDigit,
  isValidGstNumber,
  splitCgstSgst,
  verifyGstinChecksum,
} from './i18n';
import { parseHinglishEntry, parseVoiceCommand } from './bolbahi-parser';
import { appendOfflineQueuedOp } from '@/hooks/useOfflineSyncQueue';
import { isWeeklyBackupRecommended } from './idb-vault';
import type { LedgerAccount, LedgerTransaction } from './types';

describe('Ucred Audit Pure Logic Suites', () => {
  it('calculates monthly simple interest (Vyaaj) and aging buckets accurately', () => {
    const res = calculateMonthlySimpleInterest({
      principal: 10000,
      monthlyRatePct: 2,
      daysElapsed: 45,
    });
    assert.equal(res.monthsElapsed, 1.5);
    assert.equal(res.interestAmount, 300);
    assert.equal(res.totalPayable, 10300);

    const accounts: LedgerAccount[] = [
      {
        id: 'a1',
        ownerId: 'u1',
        businessId: 'b1',
        kind: 'customer',
        name: 'A',
        phone: '',
        balance: 1000,
        lastNote: '',
        dueDate: '2026-11-15',
        lastActivityAt: '2026-11-01',
      },
      {
        id: 'a2',
        ownerId: 'u1',
        businessId: 'b1',
        kind: 'customer',
        name: 'B',
        phone: '',
        balance: 2000,
        lastNote: '',
        dueDate: '2026-10-10',
        lastActivityAt: '2026-10-01',
      },
      {
        id: 'a3',
        ownerId: 'u1',
        businessId: 'b1',
        kind: 'customer',
        name: 'C',
        phone: '',
        balance: 3000,
        lastNote: '',
        dueDate: '2026-09-05',
        lastActivityAt: '2026-09-01',
      },
      {
        id: 'a4',
        ownerId: 'u1',
        businessId: 'b1',
        kind: 'customer',
        name: 'D',
        phone: '',
        balance: 4000,
        lastNote: '',
        dueDate: '2026-07-01',
        lastActivityAt: '2026-07-01',
      },
    ];

    const buckets = computeOverdueAgingBuckets(accounts, '2026-11-28');
    assert.equal(buckets.bucket0to30, 1000);
    assert.equal(buckets.bucket31to60, 2000);
    assert.equal(buckets.bucket61to90, 3000);
    assert.equal(buckets.bucket90Plus, 4000);
    assert.equal(buckets.totalReceivable, 10000);

    const days = estimateInterestDaysForParty(accounts[0], [], '2026-11-28');
    assert.equal(days, 13);
  });

  it('detects accidental duplicate transactions within a 5-minute window', () => {
    const now = Date.parse('2026-11-28T10:10:00.000Z');
    const txs: LedgerTransaction[] = [
      {
        id: 't1',
        ownerId: 'u1',
        businessId: 'b1',
        accountId: 'acc1',
        direction: 'given',
        amount: 550,
        note: 'Atta',
        billDate: '2026-11-28T10:07:30.000Z',
        billImage: '',
        voiceRaw: '',
      },
    ];

    const match = findRecentDuplicateTransaction({
      transactions: txs,
      accountId: 'acc1',
      direction: 'given',
      amount: 550,
      nowMs: now,
    });
    assert.ok(match);
    assert.equal(match.duplicate.id, 't1');
    assert.equal(match.minutesAgo, 3);

    const diffDir = findRecentDuplicateTransaction({
      transactions: txs,
      accountId: 'acc1',
      direction: 'received',
      amount: 550,
      nowMs: now,
    });
    assert.equal(diffDir, null);
  });

  it('merges duplicate party accounts and recalculates net balance and tags', () => {
    let vault = createInitialGuestVault();
    const bizId = vault.businesses[0].id;

    const r1 = applyCreateAccount(vault, {
      businessId: bizId,
      kind: 'customer',
      name: 'Ramesh',
      phone: '',
    });
    vault = r1.vault;
    const r2 = applyCreateAccount(vault, {
      businessId: bizId,
      kind: 'customer',
      name: 'Ramesh Sharma',
      phone: '9876543210',
    });
    vault = r2.vault;

    vault = applyUpdateAccountMeta(vault, r2.created.id, { tag: 'vip' });
    assert.equal(vault.accounts.find((a) => a.id === r2.created.id)?.tag, 'vip');

    const txA = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      existingAccount: r1.created,
      customerName: 'Ramesh',
      direction: 'given',
      amount: 700,
      note: 'Sugar',
    });
    vault = txA.vault;

    const txB = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      existingAccount: r2.created,
      customerName: 'Ramesh Sharma',
      direction: 'received',
      amount: 250,
      note: 'Part payment',
    });
    vault = txB.vault;

    const merged = applyMergeAccounts(vault, {
      sourceAccountId: r1.created.id,
      targetAccountId: r2.created.id,
    });
    vault = merged.vault;

    assert.equal(merged.movedTxCount, 1);
    assert.equal(vault.accounts.length, 1);
    assert.equal(vault.accounts[0].id, r2.created.id);
    assert.equal(vault.accounts[0].balance, 450);
    assert.equal(vault.transactions.filter((t) => t.accountId === r2.created.id).length, 2);
  });

  it('supports +1000 and +5000 keypad preset increments', () => {
    assert.equal(applyKeypadKey('500', '+1000'), '1500');
    assert.equal(applyKeypadKey('', '+5000'), '5000');
  });

  it('validates GSTIN checksum using Mod-36 and splits CGST/SGST 50/50', () => {
    const first14 = '27AAPFU0939F1Z';
    const checkDigit = computeGstinCheckDigit(first14);
    const validGstin = `${first14}${checkDigit}`;

    assert.equal(verifyGstinChecksum(validGstin).validChecksum, true);
    assert.equal(verifyGstinChecksum(validGstin).validState, true);
    assert.equal(isValidGstNumber(validGstin), true);

    const wrongCheck = validGstin.slice(0, 14) + (checkDigit === '0' ? '1' : '0');
    assert.equal(verifyGstinChecksum(wrongCheck).validChecksum, false);
    assert.equal(isValidGstNumber('45AABCU9603R1ZM'), false);

    const split = splitCgstSgst(185);
    assert.equal(split.cgst, 92.5);
    assert.equal(split.sgst, 92.5);
  });

  it('parses Kirana/Mandi Hinglish & Devanagari dialect vocabulary accurately', () => {
    const p1 = parseHinglishEntry('Ramesh 500 udhaar likho');
    assert.equal(p1.name, 'Ramesh');
    assert.equal(p1.type, 'credit');
    assert.equal(p1.amount, 500);

    const p2 = parseHinglishEntry('Suresh 300 vasooli');
    assert.equal(p2.name, 'Suresh');
    assert.equal(p2.type, 'debit');
    assert.equal(p2.amount, 300);

    const p3 = parseVoiceCommand('गल्ला 2500 नकद');
    assert.ok(p3.intent === 'galla_cash' || p3.entries.length >= 1);
  });

  it('tracks offline queued operations and skips weekly backup reminder below 5 records', () => {
    const q1 = appendOfflineQueuedOp([], 'biz1', 'Credit ₹500 for Amit');
    assert.equal(q1.length, 1);
    assert.equal(q1[0].businessId, 'biz1');

    const backupLow = isWeeklyBackupRecommended(3);
    assert.equal(backupLow.needed, false);
  });
});
