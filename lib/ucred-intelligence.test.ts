import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyKeypadKey,
  computeCustomerTrustScore,
  computeNetCashflowSummary,
  getTopDuePartiesToday,
} from './ucred-intelligence';
import type { LedgerAccount, LedgerTransaction } from './types';

function makeAccount(overrides: Partial<LedgerAccount> & { id: string; name: string }): LedgerAccount {
  return {
    ownerId: 'guest_local',
    businessId: 'biz_1',
    kind: 'customer',
    phone: '9876543210',
    dueDate: '',
    balance: 0,
    lastNote: '',
    lastActivityAt: '2026-04-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('Ucred Intelligence Pure Helpers', () => {
  it('ranks Top 3 Due Parties Today ahead of settled or non-due balances', () => {
    const accounts: LedgerAccount[] = [
      makeAccount({ id: 'a1', name: 'Settled Party', balance: 0 }),
      makeAccount({ id: 'a2', name: 'Upcoming Party', balance: 1500, dueDate: '2026-04-20' }),
      makeAccount({ id: 'a3', name: 'Overdue Party', balance: 2400, dueDate: '2026-04-01' }),
      makeAccount({ id: 'a4', name: 'Promised Today', balance: 900, promiseDate: '2026-04-10' }),
      makeAccount({ id: 'a5', name: 'Due Today', balance: 3200, dueDate: '2026-04-10' }),
    ];

    const trustMap = Object.fromEntries(
      accounts.map((acc) => [
        acc.id,
        computeCustomerTrustScore(acc, [] as LedgerTransaction[], '2026-04-10'),
      ])
    );

    const top3 = getTopDuePartiesToday(accounts, trustMap, '2026-04-10', 3);
    assert.equal(top3.length, 3);
    const names = top3.map((x) => x.account.name);
    assert.equal(names.includes('Settled Party'), false);
    assert.equal(names.includes('Promised Today'), true);
    assert.equal(names.includes('Due Today'), true);
    assert.equal(names.includes('Overdue Party'), true);
  });

  it('computes net cashflow share percentages accurately', () => {
    const accounts: LedgerAccount[] = [
      makeAccount({ id: 'c1', name: 'Ramesh', balance: 3000 }),
      makeAccount({ id: 's1', name: 'Supplier', kind: 'supplier', balance: -1000 }),
    ];
    const summary = computeNetCashflowSummary(accounts);
    assert.equal(summary.totalReceivable, 3000);
    assert.equal(summary.totalPayable, 1000);
    assert.equal(summary.netCashflow, 2000);
    assert.equal(summary.receivableSharePct, 75);
    assert.equal(summary.payableSharePct, 25);
  });

  it('handles Custom 3D Keypad key presses safely without leading-zero or decimal bugs', () => {
    let amt = '';
    amt = applyKeypadKey(amt, '5');
    amt = applyKeypadKey(amt, '0');
    amt = applyKeypadKey(amt, '0');
    assert.equal(amt, '500');

    amt = applyKeypadKey(amt, '+100');
    assert.equal(amt, '600');

    amt = applyKeypadKey(amt, '+2000');
    assert.equal(amt, '2600');

    amt = applyKeypadKey(amt, '.');
    amt = applyKeypadKey(amt, '5');
    amt = applyKeypadKey(amt, '5');
    amt = applyKeypadKey(amt, '9'); // ignored past 2 decimal digits
    assert.equal(amt, '2600.55');

    amt = applyKeypadKey(amt, '.'); // duplicate decimal ignored
    assert.equal(amt, '2600.55');

    amt = applyKeypadKey(amt, 'backspace');
    assert.equal(amt, '2600.5');

    amt = applyKeypadKey(amt, 'clear');
    assert.equal(amt, '');

    amt = applyKeypadKey('', '.');
    assert.equal(amt, '0.');
  });
});
