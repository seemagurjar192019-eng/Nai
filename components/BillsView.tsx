'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FileCheck,
  FileText,
  MessageCircle,
  Mic,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
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
  CashbookMode,
  StockItem,
} from '@/lib/types';

export interface BillExternalDraft {
  customerName: string;
  customerPhone?: string;
  items?: BillLineItem[];
  paymentStatus?: BillPaymentStatus;
  notes?: string;
}

interface BillsViewProps {
  bills: BillDocument[];
  stockItems: StockItem[];
  business: Business;
  prefillCustomer?: { name: string; phone: string } | null;
  externalDraft?: BillExternalDraft | null;
  onClearPrefill?: () => void;
  onOpenVoiceBill?: () => void;
  onSaveBill: (payload: {
    docType: BillDocType;
    billNumber: string;
    customerName: string;
    customerPhone: string;
    items: BillLineItem[];
    discountAmount: number;
    paymentStatus: BillPaymentStatus;
    syncToGalla?: { mode: CashbookMode } | null;
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
  externalDraft,
  onClearPrefill,
  onOpenVoiceBill,
  onSaveBill,
  onConvertQuote,
  onDeleteBill,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [docTypeFilter, setDocTypeFilter] = useState<BillDocType>('bill');
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(Boolean(prefillCustomer || externalDraft));
  const [customerName, setCustomerName] = useState(
    externalDraft?.customerName || prefillCustomer?.name || ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    externalDraft?.customerPhone || prefillCustomer?.phone || ''
  );
  const [templateId, setTemplateId] = useState<BillTemplateId>('gst-color');
  const [paymentStatus, setPaymentStatus] = useState<BillPaymentStatus>(
    externalDraft?.paymentStatus || 'paid'
  );
  const [syncGallaMode, setSyncGallaMode] = useState<CashbookMode | null>('cash');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [notes, setNotes] = useState(
    externalDraft?.notes || 'Thank you for shopping with us!'
  );
  const [items, setItems] = useState<BillLineItem[]>(
    externalDraft?.items && externalDraft.items.length > 0
      ? externalDraft.items
      : [{ name: 'Grocery Item', qty: 1, rate: 500, gstRate: 5 }]
  );
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
  const totalGst = useMemo(() => typeBills.reduce((s, b) => s + b.totalGst, 0), [typeBills]);

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
      const syncToGalla =
        docTypeFilter === 'bill' && effectiveStatus === 'paid' && syncGallaMode
          ? { mode: syncGallaMode }
          : null;
      const res = await onSaveBill({
        docType: docTypeFilter,
        billNumber: nextNum,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items,
        discountAmount: cleanDiscount,
        paymentStatus: effectiveStatus,
        syncToGalla,
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
        notices.push(`posted ${formatINR(grandTotal)} Credit to ${customerName.trim()}'s Ledger`);
      }
      if (syncToGalla) {
        notices.push(`synced ${formatINR(grandTotal)} to Galla (${syncToGalla.mode.toUpperCase()})`);
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
        <div className="space-y-4 pb-32">
          <div className="no-print flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPreviewBill(null)}
              className="min-h-[44px] px-4 rounded-xl spatial-card text-sm font-bold text-[var(--ink)] active:scale-95 transition"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {previewBill.docType === 'quote' && (
                <button
                  type="button"
                  disabled={convertingId === previewBill.id}
                  onClick={() => handleConvert(previewBill)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[var(--alert-amber)] text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{convertingId === previewBill.id ? 'Converting...' : 'Convert'}</span>
                </button>
              )}
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-3.5 rounded-xl bg-[var(--debit-green)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share</span>
              </a>
              <button
                type="button"
                onClick={handlePrintBill}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-bold inline-flex items-center gap-2 tactile-key-primary active:scale-95 transition"
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
                  <div className="flex justify-between text-[11px] font-tabular">
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

            <div className="space-y-1 text-[11px] font-tabular">
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
      <div className="space-y-4 pb-32">
        <div className="no-print flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPreviewBill(null)}
            className="min-h-[44px] px-4 rounded-xl spatial-card text-sm font-bold text-[var(--ink)] active:scale-95 transition"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {previewBill.docType === 'quote' && (
              <button
                type="button"
                disabled={convertingId === previewBill.id}
                onClick={() => handleConvert(previewBill)}
                className="min-h-[44px] px-3.5 rounded-xl bg-[var(--alert-amber)] text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition"
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
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--debit-green)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={handlePrintBill}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-bold inline-flex items-center gap-2 tactile-key-primary active:scale-95 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        <div className="print-area rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm overflow-hidden">
          <div
            className={`p-5 flex items-start justify-between gap-4 ${
              isColored ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-b border-slate-200'
            }`}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                {previewBill.docType === 'bill' ? 'Tax / Retail Bill' : 'Price Quote'}
              </p>
              <h2 className="font-display text-xl font-extrabold">{business.name}</h2>
              {business.gstNumber && (
                <p className="text-xs opacity-90">GSTIN: {business.gstNumber}</p>
              )}
              {business.phone && <p className="text-xs opacity-90">Phone: +91 {business.phone}</p>}
            </div>
            <div className="text-right font-tabular">
              <p className="text-sm font-extrabold">{previewBill.billNumber}</p>
              <p className="text-xs opacity-80">{formatDateTime(previewBill.billDate)}</p>
              {previewBill.docType === 'bill' && previewBill.paymentStatus && (
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    previewBill.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {previewBill.paymentStatus === 'paid' ? 'Paid' : 'Credit / Unpaid'}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Bill To</p>
                <p className="text-base font-extrabold">{previewBill.customerName}</p>
                {previewBill.customerPhone && (
                  <p className="text-xs font-tabular text-slate-500">+91 {previewBill.customerPhone}</p>
                )}
              </div>
              {business.upiId && (
                <div className="flex items-center gap-2">
                  <QRCodeSVG value={upi} size={64} />
                </div>
              )}
            </div>

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
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
              <div className="w-56 space-y-1 text-xs font-tabular">
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
                <div className="flex justify-between text-base font-extrabold border-t border-slate-200 pt-1">
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
                Computer-generated retail bill / estimate. Verify GSTIN and tax rates before official
                GST filing.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Voice Bill Hero Card */}
      <div className="rounded-[28px] spatial-hero p-4.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ background: 'var(--munim-gradient)' }}
            className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 tactile-key-primary"
          >
            <Mic className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold text-[var(--ink)] leading-tight">
              Voice Bill Builder
            </h2>
            <p className="text-xs text-[var(--ink-muted)] leading-snug mt-0.5">
              Speak items like &quot;Verma ka 2 atta 480 aur 1 oil 175 bill&quot;
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onOpenVoiceBill) onOpenVoiceBill();
            else setCreating(true);
          }}
          style={{ background: 'var(--munim-gradient)' }}
          className="min-h-[44px] px-3.5 rounded-xl text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 tactile-key-primary active:scale-95 transition"
        >
          <Mic className="w-4 h-4 shrink-0" />
          <span>Speak Bill</span>
        </button>
      </div>

      {/* iOS 27 Segmented Bills/Quotes Tabs + Create CTA */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="grid grid-cols-2 rounded-2xl bg-[var(--surface-subtle)] p-1 flex-1 max-w-[215px]">
          {(['bill', 'quote'] as const).map((tab) => {
            const active = docTypeFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setDocTypeFilter(tab);
                  setArmedDeleteId(null);
                }}
                className={`relative min-h-[38px] px-3 rounded-xl text-xs font-extrabold capitalize transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'billsDocTypeSeg'}
                    transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-[var(--surface)] shadow-xs"
                  />
                )}
                <span className="relative z-10">{tab === 'bill' ? 'Bills' : 'Quotes'}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            setCreating(true);
          }}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 tactile-key-primary active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New {docTypeFilter === 'bill' ? 'Bill' : 'Quote'}</span>
        </button>
      </div>

      {/* Search Bills / Quotes */}
      {typeBills.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${docTypeFilter === 'bill' ? 'bills' : 'quotes'} by number, customer, or mobile...`}
            className="w-full min-h-[46px] rounded-2xl spatial-card pl-10 pr-3.5 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition"
          />
        </div>
      )}

      {deductNotice && (
        <div className="rounded-2xl bg-[var(--debit-tint)] px-4 py-3 text-xs font-bold text-[var(--debit-green)] flex items-center justify-between gap-2 shadow-xs">
          <span>{deductNotice}</span>
          <button
            type="button"
            onClick={() => setDeductNotice('')}
            aria-label="Dismiss notice"
            className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {listError && (
        <div className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between gap-2 shadow-xs">
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => setListError('')}
            aria-label="Dismiss error"
            className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sales & GST Summary Bento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] spatial-card p-4">
          <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Total {docTypeFilter === 'bill' ? 'Sales' : 'Quotes'}
          </p>
          <p className="font-display text-xl font-extrabold font-tabular text-[var(--ink)] mt-1">
            {formatINR(totalSales)}
          </p>
        </div>
        <div className="rounded-[24px] spatial-card p-4">
          <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Total GST
          </p>
          <p className="font-display text-xl font-extrabold font-tabular text-[var(--brand-accent)] mt-1">
            {formatINR(totalGst)}
          </p>
        </div>
      </div>

      {/* Itemized GST / Kacha Bill Cards */}
      {filteredBills.length === 0 ? (
        <div className="rounded-[28px] spatial-card p-8 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
            <Receipt className="w-7 h-7" />
          </div>
          <p className="font-display text-base font-bold text-[var(--ink)]">
            {searchQuery.trim()
              ? `No ${docTypeFilter}s matched "${searchQuery.trim()}".`
              : `Create your first kaccha, pakka, GST, or 58mm thermal ${docTypeFilter}`}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-[46px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold inline-flex items-center gap-1.5 tactile-key-primary active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create {docTypeFilter === 'bill' ? 'Bill' : 'Quote'}</span>
          </button>
        </div>
      ) : (
        <div className="ios27-inset-group rounded-[26px] divide-y divide-[var(--surface-border)] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredBills.map((b, idx) => {
              const armed = armedDeleteId === b.id;
              const isUnpaid = b.docType === 'bill' && b.paymentStatus === 'unpaid';
              return (
                <motion.div
                  layout={!prefersReducedMotion}
                  key={b.id}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 30,
                    delay: Math.min(idx, 10) * 0.02,
                  }}
                  className="px-4 py-3.5 flex items-center justify-between gap-2.5 hover:bg-[var(--app-bg)]/45 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setPreviewBill(b);
                    }}
                    className="text-left min-w-0 flex-1 flex items-center gap-3 active:scale-[0.985] transition"
                  >
                    <span className="w-10 h-10 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-sm text-[var(--ink)] leading-snug truncate">
                        {b.billNumber} · {b.customerName}
                      </p>
                      <p className="text-[11px] font-medium text-[var(--ink-muted)] mt-0.5 leading-snug truncate">
                        {b.items.length} item(s) · {formatDateTime(b.billDate)}
                        {b.createdByName ? ` · ${b.createdByName}` : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right pr-1">
                      <span className="block font-extrabold font-tabular text-sm text-[var(--ink)]">
                        {formatINR(b.totalAmount)}
                      </span>
                      {b.docType === 'bill' && (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            isUnpaid
                              ? 'bg-[var(--credit-tint)] text-[var(--credit-red)]'
                              : 'bg-[var(--debit-tint)] text-[var(--debit-green)]'
                          }`}
                        >
                          {isUnpaid ? 'Credit' : 'Paid'}
                        </span>
                      )}
                    </div>
                    {b.docType === 'quote' && (
                      <button
                        type="button"
                        disabled={convertingId === b.id}
                        onClick={() => handleConvert(b)}
                        title="Convert Quote to Bill"
                        aria-label="Convert Quote to Bill"
                        className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[var(--alert-amber)] hover:bg-[var(--alert-tint)] active:scale-95 transition"
                      >
                        <FileCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        if (armed) {
                          void handleSafeDelete(b.id);
                        } else {
                          setArmedDeleteId(b.id);
                        }
                      }}
                      aria-label={`Delete ${b.billNumber}`}
                      className={`min-w-[44px] min-h-[44px] px-2 rounded-xl text-xs font-bold flex items-center justify-center active:scale-95 transition ${
                        armed
                          ? 'bg-[var(--credit-red)] text-white shadow-sm'
                          : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                      }`}
                    >
                      {armed ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Bill Builder Detent Sheet */}
      <DetentSheetOverlay
        open={creating}
        onClose={() => {
          if (!saving) {
            setCreating(false);
            if (onClearPrefill) onClearPrefill();
          }
        }}
        title={`New ${docTypeFilter === 'bill' ? 'Bill' : 'Quote'}`}
        subtitle={
          docTypeFilter === 'bill'
            ? 'Itemized invoice · Auto-deducts stock when linked'
            : 'Customer price estimate'
        }
        initialDetent="full"
      >
        <div className="space-y-4 pb-safe">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ramesh"
                className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-[var(--ink-muted)] uppercase">
                Items {docTypeFilter === 'bill' ? '· Auto-deducts Stock' : ''}
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [...prev, { name: '', qty: 1, rate: 0, gstRate: 0 }])
                }
                className="min-h-[36px] px-2.5 rounded-lg text-xs font-extrabold text-[var(--brand-accent)] bg-[var(--brand-tint)] active:scale-95 transition"
              >
                + Add Item
              </button>
            </div>

            {stockItems.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-subtle)] px-3 py-2.5">
                <Package className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
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
                  className="flex-1 bg-transparent text-xs font-bold text-[var(--ink)] outline-none"
                >
                  <option value="">
                    + Add from Stock Inventory ({stockItems.length} items)...
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
                className="grid grid-cols-12 gap-1.5 items-center rounded-2xl bg-[var(--surface-subtle)] p-2"
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
                  className="col-span-5 min-h-[40px] rounded-xl bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] outline-none shadow-xs"
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
                  className="col-span-2 min-h-[40px] rounded-xl bg-[var(--surface)] px-2 text-xs font-tabular text-[var(--ink)] outline-none shadow-xs"
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
                  className="col-span-3 min-h-[40px] rounded-xl bg-[var(--surface)] px-2 text-xs font-tabular text-[var(--ink)] outline-none shadow-xs"
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
                  className="col-span-2 min-h-[40px] rounded-xl bg-[var(--surface)] px-2 text-xs font-tabular text-[var(--ink)] outline-none shadow-xs"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
                className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
              />
            </div>

            {docTypeFilter === 'bill' && (
              <div>
                <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                  Payment Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`min-h-[44px] rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                      paymentStatus === 'paid'
                        ? 'bg-[var(--debit-tint)] text-[var(--debit-green)] ring-2 ring-[var(--debit-green)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                    }`}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`min-h-[44px] rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                      paymentStatus === 'unpaid'
                        ? 'bg-[var(--credit-tint)] text-[var(--credit-red)] ring-2 ring-[var(--credit-red)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                    }`}
                  >
                    Credit
                  </button>
                </div>
              </div>
            )}
          </div>

          {docTypeFilter === 'bill' && paymentStatus === 'paid' && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-subtle)] px-3 py-2">
              <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                Sync Paid Bill to Galla
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: null, label: 'Off' },
                    { id: 'cash', label: 'Cash' },
                    { id: 'upi', label: 'UPI' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSyncGallaMode(opt.id)}
                    className={`min-h-[36px] px-2.5 rounded-lg text-[11px] font-extrabold active:scale-95 transition ${
                      syncGallaMode === opt.id
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                        : 'bg-[var(--surface)] text-[var(--ink-muted)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="block text-xs font-bold text-[var(--ink-muted)] mb-1.5">
              Select Bill Template
            </span>
            <div className="grid grid-cols-2 gap-2">
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
                  className={`min-h-[44px] rounded-xl text-xs font-bold active:scale-95 transition ${
                    templateId === tpl.id
                      ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-3 text-xs text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs text-[var(--ink-muted)]">Grand Total (incl. GST)</p>
              <p className="font-display text-xl font-extrabold font-tabular text-[var(--brand-accent)]">
                {formatINR(grandTotal)}
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="min-h-[48px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm tactile-key-primary disabled:opacity-60 active:scale-95 transition"
            >
              {saving ? 'Saving...' : 'Save & Preview'}
            </button>
          </div>
          {error && <p className="text-xs font-bold text-[var(--credit-red)]">{error}</p>}
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
