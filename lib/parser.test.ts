import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_CASES,
  amountToHinglishWords,
  parseHinglishEntry,
  parseVoiceCommand,
} from './bolbahi-parser';

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

import {
  getLocalDateKey,
  isValidGstNumber,
  isValidIndianMobile,
  isValidUpiId,
} from './i18n';

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


