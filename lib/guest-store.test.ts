import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAddCashbookEntry,
  applyAddTransactionAtomic,
  applyConvertQuoteToBill,
  applyCreateAccount,
  applyCreateBusiness,
  applyDeleteTransactionAtomic,
  applyRestoreTransactionAtomic,
  applySaveBillDocument,
  applySaveStockItem,
  applyUpdateTransactionAtomic,
  createInitialGuestVault,
  hasGuestRecordsToSync,
} from './guest-store';

describe('Guest Mode Vault & Atomic Ledger Logic', () => {
  it('bootstraps 1 clean starter shop with zero dummy accounts or transactions', () => {
    const vault = createInitialGuestVault({ language: 'hi', appearance: 'light' });
    assert.equal(vault.businesses.length, 1);
    assert.equal(vault.businesses[0].name, 'My Store');
    assert.equal(vault.accounts.length, 0);
    assert.equal(vault.transactions.length, 0);
    assert.equal(hasGuestRecordsToSync(vault), false);
  });

  it('adds atomic Udhaar and Jama entries, updates balance, and syncs Galla', () => {
    let vault = createInitialGuestVault();
    const bizId = vault.businesses[0].id;

    const accStep = applyCreateAccount(vault, {
      businessId: bizId,
      kind: 'customer',
      name: 'Ramesh Kirana',
      phone: '9876543210',
    });
    vault = accStep.vault;

    const tx1 = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      existingAccount: accStep.created,
      customerName: 'Ramesh Kirana',
      direction: 'given',
      amount: 500,
      note: 'Atta bag',
    });
    vault = tx1.vault;
    assert.equal(tx1.newBalance, 500);
    assert.equal(hasGuestRecordsToSync(vault), true);

    const tx2 = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      existingAccount: tx1.account,
      customerName: 'Ramesh Kirana',
      direction: 'received',
      amount: 200,
      note: 'Cash mila',
      syncToGalla: { mode: 'cash' },
    });
    vault = tx2.vault;
    assert.equal(tx2.newBalance, 300);
    assert.equal(vault.cashbookEntries.length, 1);
    assert.equal(vault.cashbookEntries[0].entryType, 'inflow');
    assert.equal(vault.cashbookEntries[0].amount, 200);
  });

  it('recalculates balance accurately on edit, delete, and undo restore', () => {
    let vault = createInitialGuestVault();
    const bizId = vault.businesses[0].id;
    const t1 = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      customerName: 'Suresh',
      direction: 'given',
      amount: 1000,
      billDate: '2026-04-01T10:00:00.000Z',
    });
    vault = t1.vault;

    vault = applyUpdateTransactionAtomic(vault, {
      tx: t1.tx,
      account: t1.account,
      patch: {
        direction: 'given',
        amount: 750,
        note: 'Corrected bill',
        billDate: '2026-04-01T10:00:00.000Z',
      },
    });
    assert.equal(vault.accounts[0].balance, 750);

    const editedTx = vault.transactions[0];
    vault = applyDeleteTransactionAtomic(vault, {
      tx: editedTx,
      account: vault.accounts[0],
    });
    assert.equal(vault.accounts[0].balance, 0);
    assert.equal(vault.transactions.length, 0);

    vault = applyRestoreTransactionAtomic(vault, {
      tx: editedTx,
      account: vault.accounts[0],
    });
    assert.equal(vault.accounts[0].balance, 750);
    assert.equal(vault.transactions.length, 1);
  });

  it('auto-deducts stock and records Galla inflow on paid bill & quote conversion', () => {
    let vault = createInitialGuestVault();
    const bizId = vault.businesses[0].id;

    const stk = applySaveStockItem(vault, {
      businessId: bizId,
      name: 'Sugar',
      unit: 'kg',
      salePrice: 45,
      purchasePrice: 40,
      quantity: 20,
      lowStockThreshold: 5,
    });
    vault = stk.vault;

    const billRes = applySaveBillDocument(vault, {
      businessId: bizId,
      docType: 'bill',
      billNumber: 'INV-001',
      customerName: 'Verma',
      customerPhone: '',
      items: [{ name: 'Sugar', qty: 3, rate: 45, gstRate: 0, stockItemId: stk.itemId }],
      paymentStatus: 'paid',
      syncToGalla: { mode: 'upi' },
      templateId: 'classic',
      notes: '',
      billDate: '2026-04-02',
    });
    vault = billRes.vault;
    assert.equal(billRes.deductedCount, 1);
    assert.equal(vault.stockItems[0].quantity, 17);
    assert.equal(vault.cashbookEntries[0].mode, 'upi');
    assert.equal(vault.cashbookEntries[0].amount, 135);

    const quoteRes = applySaveBillDocument(vault, {
      businessId: bizId,
      docType: 'quote',
      billNumber: 'QT-001',
      customerName: 'Kiran',
      customerPhone: '',
      items: [{ name: 'Sugar', qty: 2, rate: 45, gstRate: 0 }],
      templateId: 'classic',
      notes: '',
      billDate: '2026-04-02',
    });
    vault = quoteRes.vault;
    assert.equal(vault.stockItems[0].quantity, 17); // Quotes don't deduct until converted

    const conv = applyConvertQuoteToBill(vault, {
      quote: vault.bills[0],
      newBillNumber: 'INV-002',
    });
    vault = conv.vault;
    assert.equal(conv.deductedCount, 1);
    assert.equal(vault.stockItems[0].quantity, 15);
    assert.equal(vault.bills[0].docType, 'bill');
  });

  it('tracks multi-business switching & cashbook entries cleanly', () => {
    let vault = createInitialGuestVault();
    const extra = applyCreateBusiness(vault, { name: 'Sharma Wholesale' });
    vault = extra.vault;
    assert.equal(vault.businesses.length, 2);
    assert.equal(vault.profile.activeBusinessId, extra.created.id);
    assert.equal(hasGuestRecordsToSync(vault), true);

    const cb = applyAddCashbookEntry(vault, {
      businessId: extra.created.id,
      entryType: 'outflow',
      mode: 'cash',
      category: 'Tea & Snacks',
      amount: 80,
    });
    vault = cb.vault;
    assert.equal(vault.cashbookEntries.length, 1);
  });

  it('tags created accounts and transactions with personaContext without losing unified shop storage', () => {
    let vault = createInitialGuestVault();
    const bizId = vault.businesses[0].id;

    const mandiAcc = applyCreateAccount(vault, {
      businessId: bizId,
      kind: 'customer',
      personaContext: 'mandi',
      name: 'Kisan Ramu',
    });
    vault = mandiAcc.vault;
    assert.equal(mandiAcc.created.personaContext, 'mandi');

    const txRes = applyAddTransactionAtomic(vault, {
      businessId: bizId,
      customerName: 'Rahul Roommate',
      personaContext: 'personal',
      direction: 'given',
      amount: 450,
      note: 'Dinner split',
    });
    vault = txRes.vault;
    assert.equal(txRes.account.personaContext, 'personal');
    assert.equal(txRes.tx.personaContext, 'personal');
    assert.equal(vault.accounts.length, 2);
  });
});

