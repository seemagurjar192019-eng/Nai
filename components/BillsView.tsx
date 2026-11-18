'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCheck,
  FileText,
  MessageCircle,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildBillShareMessage,
  buildUpiUri,
  buildWhatsAppUrl,
  formatDateTime,
  formatINR,
  getLocalDateKey,
  isValidIndianMobile,
} from '@/lib/i18n';
import type {
  BillDocType,
  BillDocument,
  BillLineItem,
  BillPaymentStatus,
  BillTemplateId,
  Business,
  StockItem,
} from '@/lib/types';

interface BillsViewProps {
  bills: BillDocument[];
  stockItems: StockItem[];
  business: Business;
  prefillCustomer?: { name: string; phone: string } | null;
  onClearPrefill?: () => void;
  onSaveBill: (payload: {
    docType: BillDocType;
    billNumber: string;
    customerName: string;
    customerPhone: string;
    items: BillLineItem[];
    discountAmount: number;
    paymentStatus: BillPaymentStatus;
    templateId: BillTemplateId;
    notes: string;
    billDate: string;
  }) => Promise<{ deductedCount: number }>;
  onConvertQuote: (quote: BillDocument) => Promise<{ billNumber: string; deductedCount: number }>;
  onDeleteBill: (billId: string) => Promise<void>;
}

export function getNextSequenceNumber(bills: BillDocument[], docType: BillDocType): string {
  const prefix = docType === 'bill' ? 'INV' : 'QT';
  let maxNum = 0;
  for (const b of bills) {
    if (b.docType !== docType) continue;
    const m = String(b.billNumber || '').match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

export const BillsView: React.FC<BillsViewProps> = ({
  bills,
  stockItems,
  business,
  prefillCustomer,
  onClearPrefill,
  onSaveBill,
  onConvertQuote,
  onDeleteBill,
}) => {
  const [docTypeFilter, setDocTypeFilter] = useState<BillDocType>('bill');
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(Boolean(prefillCustomer));
  const [customerName, setCustomerName] = useState(prefillCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(prefillCustomer?.phone || '');
  const [templateId, setTemplateId] = useState<BillTemplateId>('gst-color');
  const [paymentStatus, setPaymentStatus] = useState<BillPaymentStatus>('paid');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [notes, setNotes] = useState('Thank you for shopping with us!');
  const [items, setItems] = useState<BillLineItem[]>([
    { name: 'Grocery Item', qty: 1, rate: 500, gstRate: 5 },
  ]);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [previewBill, setPreviewBill] = useState<BillDocument | null>(null);
  const [deductNotice, setDeductNotice] = useState('');

  useEffect(() => {
    const cleanPrint = () => {
      document.body.classList.remove('printing-bill');
    };
    window.addEventListener('afterprint', cleanPrint);
    return () => {
      window.removeEventListener('afterprint', cleanPrint);
      cleanPrint();
    };
  }, []);

  useEffect(() => {
    if (!creating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        setCreating(false);
        if (onClearPrefill) onClearPrefill();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating, saving, onClearPrefill]);

  const handlePrintBill = () => {
    document.body.classList.add('printing-bill');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-bill');
    }, 1500);
  };

  const typeBills = useMemo(
    () =>
      bills
        .filter((b) => b.docType === docTypeFilter)
        .sort((a, b) => b.billDate.localeCompare(a.billDate)),
    [bills, docTypeFilter]
  );

  const filteredBills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return typeBills;
    return typeBills.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        (b.customerPhone || '').toLowerCase().includes(q)
    );
  }, [typeBills, searchQuery]);

  const totalSales = useMemo(
    () => typeBills.reduce((s, b) => s + b.totalAmount, 0),
    [typeBills]
  );
  const totalGst = useMemo(
    () => typeBills.reduce((s, b) => s + b.totalGst, 0),
    [typeBills]
  );

  const subtotal = items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0);
  const gstSum = items.reduce(
    (s, i) => s + ((i.qty || 0) * (i.rate || 0) * (i.gstRate || 0)) / 100,
    0
  );
  const cleanDiscount = Math.max(
    0,
    Math.min(subtotal + gstSum, Math.round((Number(discountAmount) || 0) * 100) / 100)
  );
  const grandTotal = Math.max(
    0,
    Math.round((subtotal + gstSum - cleanDiscount) * 100) / 100
  );

  const handleCreate = async () => {
    setError('');
    setDeductNotice('');
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (customerPhone && !isValidIndianMobile(customerPhone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (items.every((i) => !i.name.trim())) {
      setError('Add at least one item.');
      return;
    }
    setSaving(true);
    try {
      const nextNum = getNextSequenceNumber(bills, docTypeFilter);
      const effectiveStatus: BillPaymentStatus =
        docTypeFilter === 'quote' ? 'paid' : paymentStatus;
      const res = await onSaveBill({
        docType: docTypeFilter,
        billNumber: nextNum,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items,
        discountAmount: cleanDiscount,
        paymentStatus: effectiveStatus,
        templateId,
        notes,
        billDate: new Date().toISOString(),
      });
      setCreating(false);
      const notices: string[] = [];
      if (res.deductedCount > 0) {
        notices.push(`deducted stock for ${res.deductedCount} item(s)`);
      }
      if (docTypeFilter === 'bill' && effectiveStatus === 'unpaid') {
        notices.push(`posted ${formatINR(grandTotal)} Udhaar to ${customerName.trim()}'s Khata`);
      }
      if (notices.length > 0) {
        setDeductNotice(`Saved ${nextNum} & ${notices.join(' · ')}.`);
      }
      if (onClearPrefill) onClearPrefill();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (quote: BillDocument) => {
    setListError('');
    setConvertingId(quote.id);
    try {
      const res = await onConvertQuote(quote);
      setDeductNotice(
        `Converted ${quote.billNumber} to Bill ${res.billNumber}${
          res.deductedCount > 0 ? ` (${res.deductedCount} stock item(s) deducted)` : ''
        }.`
      );
      setPreviewBill(null);
      setDocTypeFilter('bill');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to convert quote to bill.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleSafeDelete = async (billId: string) => {
    setListError('');
    try {
      await onDeleteBill(billId);
      setArmedDeleteId(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to delete bill.');
    }
  };

  if (previewBill) {
    const upi = buildUpiUri(
      business.upiId || 'shop@upi',
      business.name,
      previewBill.totalAmount
    );
    const isColored = previewBill.templateId === 'gst-color';
    const isThermal = previewBill.templateId === 'thermal-58';
    const shareText = buildBillShareMessage({
      docType: previewBill.docType,
      billNumber: previewBill.billNumber,
      shopName: business.name,
      customerName: previewBill.customerName,
      totalAmount: previewBill.totalAmount,
      billDate: getLocalDateKey(new Date(previewBill.billDate)),
      paymentStatus: previewBill.paymentStatus,
      upiId: business.upiId,
      items: previewBill.items,
    });
    const waUrl = buildWhatsAppUrl(previewBill.customerPhone, shareText);

    if (isThermal) {
      return (
        <div className="space-y-4 pb-24 max-w-md mx-auto">
          <div className="no-print flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPreviewBill(null)}
              className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {previewBill.docType === 'quote' && (
                <button
                  type="button"
                  disabled={convertingId === previewBill.id}
                  onClick={() => handleConvert(previewBill)}
                  className="min-h-[42px] px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{convertingId === previewBill.id ? 'Converting...' : 'Convert to Bill'}</span>
                </button>
              )}
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share</span>
              </a>
              <button
                type="button"
                onClick={handlePrintBill}
                className="min-h-[42px] px-4 rounded-xl bg-[var(--brand)] text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print 58mm</span>
              </button>
            </div>
          </div>

          <div className="print-area mx-auto w-full max-w-[300px] bg-white text-slate-900 border border-dashed border-slate-400 p-4 font-mono text-xs space-y-3 shadow-sm">
            <div className="text-center border-b border-dashed border-slate-400 pb-2 space-y-0.5">
              <p className="text-sm font-bold uppercase">{business.name}</p>
              {business.address && <p className="text-[11px]">{business.address}</p>}
              {business.phone && <p className="text-[11px]">Tel: +91 {business.phone}</p>}
              {business.gstNumber && <p className="text-[11px]">GSTIN: {business.gstNumber}</p>}
            </div>

            <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>
                  {previewBill.docType === 'bill' ? 'BILL' : 'QUOTE'} #{previewBill.billNumber}
                </span>
                <span>{new Date(previewBill.billDate).toLocaleDateString('en-IN')}</span>
              </div>
              <p>Party: {previewBill.customerName}</p>
              {previewBill.docType === 'bill' && previewBill.paymentStatus && (
                <p>
                  Status: {previewBill.paymentStatus === 'paid' ? 'PAID' : 'UDHAAR (UNPAID)'}
                </p>
              )}
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between font-bold border-b border-slate-300 pb-1">
                <span>ITEM</span>
                <span>QTY×RATE = AMT</span>
              </div>
              {previewBill.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="font-semibold truncate">{it.name}</p>
                  <div className="flex justify-between text-[11px]">
                    <span>
                      {it.qty} × ₹{it.rate} {it.gstRate > 0 ? `(+${it.gstRate}%)` : ''}
                    </span>
                    <span className="font-bold">
                      {formatINR(it.qty * it.rate * (1 + it.gstRate / 100))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>SUBTOTAL</span>
                <span>{formatINR(previewBill.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST</span>
                <span>{formatINR(previewBill.totalGst)}</span>
              </div>
              {Number(previewBill.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <span>DISCOUNT</span>
                  <span>-{formatINR(Number(previewBill.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-dashed border-slate-400 pt-1">
                <span>TOTAL</span>
                <span>{formatINR(previewBill.totalAmount)}</span>
              </div>
            </div>

            {business.upiId && (
              <div className="pt-2 border-t border-dashed border-slate-400 flex flex-col items-center gap-1">
                <QRCodeSVG value={upi} size={88} />
                <p className="text-[10px]">Scan &amp; Pay ({business.upiId})</p>
              </div>
            )}

            <p className="text-center text-[10px] pt-1">
              {previewBill.notes || 'Dhanyavaad! Visit Again'}
            </p>
            <p className="text-center text-[9px] text-slate-500">
              Retail estimate / computer-generated bill. Verify GSTIN before tax filing.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-24 max-w-2xl mx-auto">
        <div className="no-print flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPreviewBill(null)}
            className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold"
          >
            ← Back to Bills
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {previewBill.docType === 'quote' && (
              <button
                type="button"
                disabled={convertingId === previewBill.id}
                onClick={() => handleConvert(previewBill)}
                className="min-h-[42px] px-3.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {convertingId === previewBill.id ? 'Converting...' : 'Convert to Bill'}
                </span>
              </button>
            )}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Share</span>
            </a>
            <button
              type="button"
              onClick={handlePrintBill}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--brand)] text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        <div className="print-area rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm overflow-hidden">
          <div
            className={`p-5 flex items-start justify-between gap-4 ${
              isColored ? 'bg-[var(--brand)] text-white' : 'border-b border-slate-200'
            }`}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                {previewBill.docType === 'bill' ? 'Tax / Retail Bill' : 'Price Quote'}
              </p>
              <h2 className="text-xl font-extrabold">{business.name}</h2>
              {business.gstNumber && (
                <p className="text-xs opacity-90">GSTIN: {business.gstNumber}</p>
              )}
              {business.phone && (
                <p className="text-xs opacity-90">Phone: +91 {business.phone}</p>
              )}
            </div>
            <div className="text-right font-tabular">
              <p className="text-sm font-extrabold">{previewBill.billNumber}</p>
              <p className="text-xs opacity-80">{formatDateTime(previewBill.billDate)}</p>
              {previewBill.docType === 'bill' && previewBill.paymentStatus && (
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    previewBill.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {previewBill.paymentStatus === 'paid' ? 'Paid' : 'Udhaar / Unpaid'}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Bill To</p>
                <p className="text-base font-extrabold">{previewBill.customerName}</p>
                {previewBill.customerPhone && (
                  <p className="text-xs text-slate-500">+91 {previewBill.customerPhone}</p>
                )}
              </div>
              {business.upiId && (
                <div className="flex items-center gap-2">
                  <QRCodeSVG value={upi} size={64} />
                </div>
              )}
            </div>

            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">GST%</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-tabular">
                {previewBill.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-sans font-semibold">{it.name}</td>
                    <td className="py-2 text-right">{it.qty}</td>
                    <td className="py-2 text-right">{formatINR(it.rate)}</td>
                    <td className="py-2 text-right">{it.gstRate}%</td>
                    <td className="py-2 text-right font-bold">
                      {formatINR(it.qty * it.rate * (1 + it.gstRate / 100))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <div className="w-60 space-y-1 text-sm font-tabular">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatINR(previewBill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total GST</span>
                  <span>{formatINR(previewBill.totalGst)}</span>
                </div>
                {Number(previewBill.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>-{formatINR(Number(previewBill.discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-extrabold border-t border-slate-200 pt-1">
                  <span>Grand Total</span>
                  <span className="text-[var(--brand)]">
                    {formatINR(previewBill.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1">
              {previewBill.notes && (
                <p className="text-xs text-slate-600">Note: {previewBill.notes}</p>
              )}
              <p className="text-[10px] text-slate-400">
                Computer-generated retail bill / estimate. Verify GSTIN and tax rates before official GST filing.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1">
          {(['bill', 'quote'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setDocTypeFilter(tab);
                setArmedDeleteId(null);
              }}
              className={`min-h-[38px] px-5 rounded-lg text-sm font-bold capitalize transition ${
                docTypeFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-[var(--brand)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab === 'bill' ? 'Bills' : 'Quotes'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            setCreating(true);
          }}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-extrabold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create {docTypeFilter === 'bill' ? 'Bill' : 'Quote'}</span>
        </button>
      </div>

      {/* Search Bills / Quotes */}
      {typeBills.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${docTypeFilter === 'bill' ? 'bills' : 'quotes'} by number, customer, or mobile...`}
            className="w-full min-h-[42px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-10 pr-3 text-sm outline-none focus:border-[var(--brand)]"
          />
        </div>
      )}

      {deductNotice && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span>{deductNotice}</span>
          <button type="button" onClick={() => setDeductNotice('')} aria-label="Dismiss notice">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {listError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{listError}</span>
          <button type="button" onClick={() => setListError('')} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sales & GST Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase">
            Total {docTypeFilter === 'bill' ? 'Sales' : 'Quotes'}
          </p>
          <p className="text-2xl font-extrabold font-tabular text-slate-900 dark:text-white mt-1">
            {formatINR(totalSales)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase">Total GST</p>
          <p className="text-2xl font-extrabold font-tabular text-[var(--brand)] mt-1">
            {formatINR(totalGst)}
          </p>
        </div>
      </div>

      {/* Bill List */}
      {filteredBills.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
            <Receipt className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">
            {searchQuery.trim()
              ? `No ${docTypeFilter}s matched "${searchQuery.trim()}".`
              : `Create your first kaccha, pakka, GST, or 58mm thermal ${docTypeFilter}`}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-[46px] px-5 rounded-xl bg-[var(--brand)] text-white text-sm font-extrabold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create {docTypeFilter === 'bill' ? 'Bill' : 'Quote'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBills.map((b) => {
            const armed = armedDeleteId === b.id;
            return (
              <div
                key={b.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => setPreviewBill(b)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <p className="font-extrabold text-sm truncate">
                      {b.billNumber} · {b.customerName}
                    </p>
                    {b.docType === 'bill' && b.paymentStatus === 'unpaid' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold shrink-0">
                        Udhaar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {b.items.length} item(s) · {formatDateTime(b.billDate)}
                  </p>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-extrabold font-tabular text-base text-[var(--brand)]">
                    {formatINR(b.totalAmount)}
                  </span>
                  {b.docType === 'quote' && (
                    <button
                      type="button"
                      disabled={convertingId === b.id}
                      onClick={() => handleConvert(b)}
                      title="Convert Quote to Bill"
                      aria-label="Convert Quote to Bill"
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      <FileCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (armed) {
                        void handleSafeDelete(b.id);
                      } else {
                        setArmedDeleteId(b.id);
                      }
                    }}
                    aria-label="Delete bill"
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                      armed
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-red-600'
                    }`}
                  >
                    {armed ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Bill Builder Modal */}
      {creating && (
        <div
          onClick={() => {
            if (!saving) {
              setCreating(false);
              if (onClearPrefill) onClearPrefill();
            }
          }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                New {docTypeFilter === 'bill' ? 'Bill' : 'Quote'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  if (onClearPrefill) onClearPrefill();
                }}
                aria-label="Close bill builder"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ramesh"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Items {docTypeFilter === 'bill' ? '· Auto-deducts linked Stock' : ''}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      { name: '', qty: 1, rate: 0, gstRate: 0 },
                    ])
                  }
                  className="text-xs font-bold text-[var(--brand)]"
                >
                  + Add Item
                </button>
              </div>

              {stockItems.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
                  <Package className="w-4 h-4 text-[var(--brand)] shrink-0" />
                  <select
                    aria-label="Pick item from stock"
                    defaultValue=""
                    onChange={(e) => {
                      const picked = stockItems.find((s) => s.id === e.target.value);
                      if (picked) {
                        setItems((prev) => [
                          ...prev.filter((row) => row.name !== 'Grocery Item' || prev.length > 1),
                          {
                            name: picked.name,
                            qty: 1,
                            rate: picked.salePrice,
                            gstRate: 0,
                            stockItemId: picked.id,
                          },
                        ]);
                      }
                      e.target.value = '';
                    }}
                    className="flex-1 bg-transparent text-xs font-bold outline-none"
                  >
                    <option value="">
                      + Add directly from Stock Inventory ({stockItems.length} items)...
                    </option>
                    {stockItems.map((stk) => (
                      <option key={stk.id} value={stk.id}>
                        {stk.name} — ₹{stk.salePrice}/{stk.unit} ({stk.quantity} left)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2"
                >
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, name: e.target.value, stockItemId: undefined };
                      setItems(next);
                    }}
                    placeholder="Item name"
                    className="col-span-5 min-h-[38px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 text-xs font-semibold"
                  />
                  <input
                    type="number"
                    min="1"
                    value={it.qty || ''}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, qty: Number(e.target.value) || 0 };
                      setItems(next);
                    }}
                    placeholder="Qty"
                    className="col-span-2 min-h-[38px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 text-xs font-tabular"
                  />
                  <input
                    type="number"
                    min="0"
                    value={it.rate || ''}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, rate: Number(e.target.value) || 0 };
                      setItems(next);
                    }}
                    placeholder="₹ Rate"
                    className="col-span-3 min-h-[38px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 text-xs font-tabular"
                  />
                  <input
                    type="number"
                    min="0"
                    value={it.gstRate}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, gstRate: Number(e.target.value) || 0 };
                      setItems(next);
                    }}
                    placeholder="GST%"
                    className="col-span-2 min-h-[38px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 text-xs font-tabular"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Discount (₹ Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular font-bold"
                />
              </div>

              {docTypeFilter === 'bill' && (
                <div>
                  <span className="block text-xs font-bold text-slate-500 mb-1">
                    Payment Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`min-h-[42px] rounded-xl text-xs font-bold border ${
                        paymentStatus === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Paid Cash/UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('unpaid')}
                      className={`min-h-[42px] rounded-xl text-xs font-bold border ${
                        paymentStatus === 'unpaid'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-800 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Post Udhaar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-500 mb-1.5">
                Select Bill Template
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'gst-color', label: 'Coloured GST' },
                    { id: 'modern', label: 'Modern' },
                    { id: 'classic', label: 'Classic' },
                    { id: 'thermal-58', label: '58mm Thermal' },
                  ] as const
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border ${
                      templateId === tpl.id
                        ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500">Grand Total (incl. GST)</p>
                <p className="text-xl font-extrabold font-tabular text-[var(--brand)]">
                  {formatINR(grandTotal)}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleCreate}
                className="min-h-[48px] px-6 rounded-xl bg-[var(--brand)] text-white font-extrabold text-sm disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save & Preview'}
              </button>
            </div>
            {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
