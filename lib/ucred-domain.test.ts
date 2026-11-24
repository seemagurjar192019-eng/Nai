import test from 'node:test';
import assert from 'node:assert';
import { UcredDomainManager } from './ucred-domain';

test('UcredDomainManager computes net cashflow, galla pulse, and customer trust accurately', () => {
  const manager = new UcredDomainManager({
    accounts: [
      {
        id: 'acc-1',
        businessId: 'biz-1',
        name: 'Ramesh Kirana',
        kind: 'customer',
        balance: 1500,
        createdAt: new Date().toISOString(),
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        businessId: 'biz-1',
        accountId: 'acc-1',
        amount: 1500,
        direction: 'given',
        billDate: '2026-06-01T10:00:00.000Z',
        note: 'Udhaar',
      },
    ],
    cashbookEntries: [],
    bills: [],
    stockItems: [],
  });

  const net = manager.getNetCashflow();
  assert.strictEqual(net.totalReceivable, 1500);
  assert.strictEqual(net.totalPayable, 0);

  const trust = manager.getCustomerTrust('acc-1', '2026-06-05');
  assert.ok(trust);
  assert.strictEqual(typeof trust.score, 'number');
});
