import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_CASES,
  amountToHinglishWords,
  parseHinglishEntry,
  parseVoiceCommand,
} from './bolbahi-parser';
import {
  getLocalDateKey,
  isValidGstNumber,
  isValidIndianMobile,
  isValidUpiId,
} from './i18n';
import {
  computeCustomerTrustScore,
  computeDailyGallaPulse,
} from './ucred-intelligence';
import type { BillDocument, CashbookEntry, LedgerAccount, LedgerTransaction, StockItem } from './types';

test('contains at least 50 test phrases', () => {
  assert.equal(TEST_CASES.length, 50);
});

test('all 50 Hinglish, Devanagari, and digit phrases parse accurately', () => {
  let passCount = 0;
  const failures: string[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const actual = parseHinglishEntry(tc.input);
    const ok = actual.name === tc.name && actual.amount === tc.amount && actual.type === tc.type;
    if (ok) {
      passCount++;
    } else {
      failures.push(
        `#${i + 1} "${tc.input}": expected (${tc.name}, ${tc.amount}, ${tc.type}) got (${actual.name}, ${actual.amount}, ${actual.type})`
      );
    }
  }

  assert.equal(failures.length, 0, `Parser failures:\n${failures.join('\n')}`);
  assert.equal(passCount, 50);
});

test('amountToHinglishWords formats read-back cleanly', () => {
  assert.equal(amountToHinglishWords(2000), 'do hazaar');
  assert.equal(amountToHinglishWords(150), 'ek sau pachaas');
  assert.equal(amountToHinglishWords(250000), 'do lakh pachaas hazaar');
});

test('parseVoiceCommand handles balance queries, daily summary, and multi-entry batches', () => {
  const bal1 = parseVoiceCommand('Ramesh ka hisaab batao');
  assert.equal(bal1.intent, 'balance_query');
  if (bal1.intent === 'balance_query') assert.equal(bal1.customerName, 'Ramesh');

  const bal2 = parseVoiceCommand('सुरेश का कितना बाकी है');
  assert.equal(bal2.intent, 'balance_query');
  if (bal2.intent === 'balance_query') assert.equal(bal2.customerName, 'Suresh');

  const sum1 = parseVoiceCommand('Aaj ka hisaab batao');
  assert.equal(sum1.intent, 'daily_summary');

  const batch = parseVoiceCommand('Ramesh 500 udhaar aur Suresh se 300 mila');
  assert.equal(batch.intent, 'entries');
  if (batch.intent === 'entries') {
    assert.equal(batch.entries.length, 2);
    assert.equal(batch.entries[0].name, 'Ramesh');
    assert.equal(batch.entries[0].amount, 500);
    assert.equal(batch.entries[0].type, 'credit');
    assert.equal(batch.entries[1].name, 'Suresh');
    assert.equal(batch.entries[1].amount, 300);
    assert.equal(batch.entries[1].type, 'debit');
  }

  const compoundSingle = parseVoiceCommand('Anita ke teen hazar aur char sau bakaya');
  assert.equal(compoundSingle.intent, 'entries');
  if (compoundSingle.intent === 'entries') {
    assert.equal(compoundSingle.entries.length, 1);
    assert.equal(compoundSingle.entries[0].amount, 3400);
  }
});

test('parser handles honorifics, currency punctuation, lakh fractions, and item notes', () => {
  const honorific = parseHinglishEntry('Ramesh bhai ko 500/- udhaar');
  assert.equal(honorific.name, 'Ramesh');
  assert.equal(honorific.amount, 500);
  assert.equal(honorific.type, 'credit');

  const savaLakh = parseHinglishEntry('Suresh sava lakh udhaar');
  assert.equal(savaLakh.name, 'Suresh');
  assert.equal(savaLakh.amount, 125000);

  const dedhLakh = parseHinglishEntry('Mohan se dedh lakh jama');
  assert.equal(dedhLakh.name, 'Mohan');
  assert.equal(dedhLakh.amount, 150000);
  assert.equal(dedhLakh.type, 'debit');

  const withNote = parseHinglishEntry('Ramesh 500 udhaar atta chawal ke');
  assert.equal(withNote.name, 'Ramesh');
  assert.equal(withNote.amount, 500);
  assert.equal(withNote.note, 'Atta Chawal');
});

test('local date key and validators behave accurately', () => {
  assert.match(getLocalDateKey(new Date(2025, 0, 5, 0, 15, 0)), /^2025-01-05$/);
  assert.equal(isValidUpiId('shop@okaxis'), true);
  assert.equal(isValidUpiId('invalid-upi'), false);
  assert.equal(isValidGstNumber('27AABCU9603R1ZM'), true);
  assert.equal(isValidGstNumber('INVALID123'), false);
  assert.equal(isValidIndianMobile('9876543210'), true);
  assert.equal(isValidIndianMobile('12345'), false);
});

test('computeCustomerTrustScore scores reliable vs overdue defaulters accurately', () => {
  const today = '2025-05-15';
  const reliableAcc: LedgerAccount = {
    id: 'acc_1',
    ownerId: 'u1',
    businessId: 'b1',
    kind: 'customer',
    name: 'Ramesh',
    phone: '9876543210',
    dueDate: '2025-05-20',
    balance: 200,
    lastNote: 'Paid part',
    lastActivityAt: '2025-05-14T10:00:00Z',
  };
  const reliableTxs: LedgerTransaction[] = [
    {
      id: 't1',
      ownerId: 'u1',
      businessId: 'b1',
      accountId: 'acc_1',
      direction: 'given',
      amount: 1000,
      note: 'Ration',
      billDate: '2025-05-10T10:00:00Z',
      voiceRaw: '',
      billImage: '',
    },
    {
      id: 't2',
      ownerId: 'u1',
      businessId: 'b1',
      accountId: 'acc_1',
      direction: 'received',
      amount: 800,
      note: 'UPI',
      billDate: '2025-05-14T10:00:00Z',
      voiceRaw: '',
      billImage: '',
    },
  ];
  const reliableTrust = computeCustomerTrustScore(reliableAcc, reliableTxs, today);
  assert.equal(reliableTrust.band, 'reliable');
  assert.ok(reliableTrust.score >= 80);
  assert.equal(reliableTrust.overdueDays, 0);

  const riskyAcc: LedgerAccount = {
    id: 'acc_2',
    ownerId: 'u1',
    businessId: 'b1',
    kind: 'customer',
    name: 'Vikram',
    phone: '9876500000',
    dueDate: '2025-04-25',
    promiseDate: '2025-05-10',
    creditLimit: 5000,
    balance: 6200,
    lastNote: 'Credit',
    lastActivityAt: '2025-04-20T10:00:00Z',
  };
  const riskyTxs: LedgerTransaction[] = [
    {
      id: 't3',
      ownerId: 'u1',
      businessId: 'b1',
      accountId: 'acc_2',
      direction: 'given',
      amount: 6200,
      note: 'Stock',
      billDate: '2025-04-20T10:00:00Z',
      voiceRaw: '',
      billImage: '',
    },
  ];
  const riskyTrust = computeCustomerTrustScore(riskyAcc, riskyTxs, today);
  assert.equal(riskyTrust.band, 'high-risk');
  assert.ok(riskyTrust.score < 50);
  assert.equal(riskyTrust.overdueDays, 20);
  assert.equal(riskyTrust.suggestedTone, 'urgent');
  assert.ok(riskyTrust.priorityScore > reliableTrust.priorityScore);
});

test('computeDailyGallaPulse aggregates cash drawer, UPI, and stock profit margins', () => {
  const today = '2025-05-15';
  const cashbook: CashbookEntry[] = [
    {
      id: 'cb1',
      ownerId: 'u1',
      businessId: 'b1',
      entryType: 'inflow',
      mode: 'cash',
      category: 'Opening',
      amount: 2000,
      note: 'Opening drawer',
      entryDate: '2025-05-15T08:00:00Z',
    },
    {
      id: 'cb2',
      ownerId: 'u1',
      businessId: 'b1',
      entryType: 'inflow',
      mode: 'upi',
      category: 'Vasooli',
      amount: 1500,
      note: 'Ramesh UPI',
      entryDate: '2025-05-15T11:00:00Z',
    },
    {
      id: 'cb3',
      ownerId: 'u1',
      businessId: 'b1',
      entryType: 'outflow',
      mode: 'cash',
      category: 'Expense',
      amount: 350,
      note: 'Chai & Transport',
      entryDate: '2025-05-15T13:00:00Z',
    },
  ];
  const stockItems: StockItem[] = [
    {
      id: 'stk1',
      ownerId: 'u1',
      businessId: 'b1',
      name: 'Toor Dal',
      unit: 'kg',
      salePrice: 165,
      purchasePrice: 140,
      quantity: 20,
      lowStockThreshold: 5,
    },
  ];
  const bills: BillDocument[] = [
    {
      id: 'bill1',
      ownerId: 'u1',
      businessId: 'b1',
      docType: 'bill',
      billNumber: 'INV-001',
      customerName: 'Suresh',
      customerPhone: '',
      items: [{ name: 'Toor Dal', qty: 20, rate: 165, gstRate: 0, stockItemId: 'stk1' }],
      subtotal: 3300,
      totalGst: 0,
      totalAmount: 3300,
      paymentStatus: 'paid',
      templateId: 'gst-color',
      notes: '',
      billDate: '2025-05-15T14:00:00Z',
    },
  ];

  const pulse = computeDailyGallaPulse({
    todayStr: today,
    cashbookEntries: cashbook,
    transactions: [],
    bills,
    stockItems,
  });

  assert.equal(pulse.cashDrawerBalance, 1650);
  assert.equal(pulse.upiBankBalance, 1500);
  assert.equal(pulse.totalLiquidBalance, 3150);
  assert.equal(pulse.todayExpenses, 350);
  // 20 * (165 - 140) = 500 margin - 350 expense = 150 profit
  assert.equal(pulse.estimatedDailyProfit, 150);
});
