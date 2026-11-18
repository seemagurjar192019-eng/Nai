'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  compressImageToDataUrl,
  formatINR,
  getLocalDateKey,
  isValidIndianMobile,
} from '@/lib/i18n';
import type {
  BillLineItem,
  BillPaymentStatus,
  LedgerAccount,
  ParchiScanResult,
  TxDirection,
} from '@/lib/types';

interface ParchiScannerModalProps {
  open: boolean;
  onClose: () => void;
  accounts: LedgerAccount[];
  onPostToKhata: (payload: {
    customerName: string;
    phone: string;
    direction: TxDirection;
    amount: number;
    note: string;
    billDate: string;
    billImage: string;
  }) => Promise<void>;
  onCreateBillFromScan: (draft: {
    customerName: string;
    customerPhone: string;
    items: BillLineItem[];
    paymentStatus: BillPaymentStatus;
    notes: string;
  }) => void;
}

export const ParchiScannerModal: React.FC<ParchiScannerModalProps> = ({
  open,
  onClose,
  accounts,
  onPostToKhata,
  onCreateBillFromScan,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [thumbDataUrl, setThumbDataUrl] = useState('');
  const [scanDataUrl, setScanDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [hasScanResult, setHasScanResult] = useState(false);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');

  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [direction, setDirection] = useState<TxDirection>('given');
  const [billDate, setBillDate] = useState(() => getLocalDateKey());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BillLineItem[]>([]);
  const [manualTotal, setManualTotal] = useState('');

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !scanning && !posting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, scanning, posting, onClose]);

  const matchedAccount = useMemo(() => {
    const clean = partyName.trim().toLowerCase();
    if (!clean) return null;
    return (
      accounts.find((a) => a.name.toLowerCase() === clean) ||
      accounts.find((a) => a.name.toLowerCase().includes(clean)) ||
      null
    );
  }, [accounts, partyName]);

  const computedItemsTotal = useMemo(
    () =>
      Math.round(
        items.reduce(
          (sum, it) =>
            sum + (Number(it.qty) || 0) * (Number(it.rate) || 0) * (1 + (Number(it.gstRate) || 0) / 100),
          0
        ) * 100
      ) / 100,
    [items]
  );

  const effectiveTotal = useMemo(() => {
    const m = Number(manualTotal);
    if (Number.isFinite(m) && m > 0) return Math.round(m * 100) / 100;
    return computedItemsTotal;
  }, [manualTotal, computedItemsTotal]);

  const resetAll = () => {
    setThumbDataUrl('');
    setScanDataUrl('');
    setScanning(false);
    setScanError('');
    setHasScanResult(false);
    setPartyName('');
    setPhone('');
    setDirection('given');
    setBillDate(getLocalDateKey());
    setNotes('');
    setItems([]);
    setManualTotal('');
    setPostError('');
  };

  const runAiScan = async (imageForAi: string) => {
    setScanError('');
    setScanning(true);
    try {
      const res = await fetch('/api/ucred/scan-parchi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: imageForAi }),
      });
      const json = (await res.json()) as Partial<ParchiScanResult> & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Could not scan parchi image.');
      }

      const nextParty = String(json.partyName || 'Walk-in Party');
      const nextItems: BillLineItem[] = Array.isArray(json.items)
        ? json.items.map((it) => ({
            name: String(it.name || 'Item'),
            qty: Number(it.qty) || 1,
            rate: Number(it.rate) || 0,
            gstRate: Number(it.gstRate) || 0,
          }))
        : [];
      const nextTotal = Number(json.totalAmount) || 0;

      setPartyName(nextParty);
      setPhone(String(json.phone || '').replace(/\D/g, '').slice(-10));
      setDirection(json.direction === 'received' ? 'received' : 'given');
      setBillDate(
        json.billDate && /^\d{4}-\d{2}-\d{2}/.test(json.billDate)
          ? json.billDate.slice(0, 10)
          : getLocalDateKey()
      );
      setNotes(String(json.notes || 'Scanned Parchi'));
      setItems(nextItems.length > 0 ? nextItems : [{ name: 'Parchi Item', qty: 1, rate: nextTotal, gstRate: 0 }]);
      setManualTotal(nextTotal > 0 ? String(nextTotal) : '');
      setConfidence(
        json.confidence === 'high' || json.confidence === 'low' ? json.confidence : 'medium'
      );
      setHasScanResult(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'AI Parchi scan failed. Try a clearer photo.');
    } finally {
      setScanning(false);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanError('');
    setPostError('');
    try {
      const [thumb, highRes] = await Promise.all([
        compressImageToDataUrl(file, { maxSide: 720, maxBytes: 140000 }),
        compressImageToDataUrl(file, { maxSide: 1080, maxBytes: 420000 }),
      ]);
      setThumbDataUrl(thumb);
      setScanDataUrl(highRes || thumb);
      await runAiScan(highRes || thumb);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unable to read image file.');
    }
  };

  const handlePostKhata = async () => {
    setPostError('');
    if (!partyName.trim()) {
      setPostError('Enter customer or party name.');
      return;
    }
    if (phone && !isValidIndianMobile(phone)) {
      setPostError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (effectiveTotal <= 0) {
      setPostError('Total amount must be greater than ₹0.');
      return;
    }

    setPosting(true);
    try {
      const timeNow = new Date().toTimeString().slice(0, 8);
      const isoDate = new Date(`${billDate || getLocalDateKey()}T${timeNow}`).toISOString();
      const itemSummary = items
        .filter((i) => i.name.trim())
        .slice(0, 4)
        .map((i) => `${i.name} (${i.qty})`)
        .join(', ');
      const composedNote =
        notes.trim() || (itemSummary ? `Parchi: ${itemSummary}` : 'Scanned Parchi');

      await onPostToKhata({
        customerName: matchedAccount?.name || partyName.trim(),
        phone: phone.trim() || matchedAccount?.phone || '',
        direction,
        amount: effectiveTotal,
        note: composedNote.slice(0, 200),
        billDate: isoDate,
        billImage: thumbDataUrl,
      });
      resetAll();
      onClose();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post scanned parchi to khata.');
    } finally {
      setPosting(false);
    }
  };

  const handleOpenInBillBuilder = () => {
    setPostError('');
    const validItems = items.filter((i) => i.name.trim());
    onCreateBillFromScan({
      customerName: matchedAccount?.name || partyName.trim() || 'Walk-in Customer',
      customerPhone: phone.trim() || matchedAccount?.phone || '',
      items:
        validItems.length > 0
          ? validItems
          : [{ name: 'Parchi Total', qty: 1, rate: effectiveTotal, gstRate: 0 }],
      paymentStatus: direction === 'received' ? 'paid' : 'unpaid',
      notes: notes.trim() || 'Created from AI Parchi Scan',
    });
    resetAll();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Parchi and Receipt Scanner"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[var(--brand)]" />
              <span>AI Parchi &amp; Receipt Scanner</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Snap a handwritten parchi or supplier bill · Post to Khata or GST Bill in 1 tap
            </p>
          </div>
          <button
            type="button"
            disabled={scanning || posting}
            onClick={() => {
              resetAll();
              onClose();
            }}
            aria-label="Close Parchi Scanner"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilePicked}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFilePicked}
          className="hidden"
        />

        {!thumbDataUrl ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--surface-border)] bg-[var(--app-bg)] p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
              <Camera className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                Capture Handwritten Parchi or Invoice
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Supports Hindi, Hinglish, and English kirana slips, supplier invoices, and thermal receipts.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[46px] px-5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm inline-flex items-center gap-2 shadow-sm"
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[46px] px-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] font-extrabold text-sm inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4 text-[var(--brand)]" />
                <span>Upload Image</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview + Scan Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--app-bg)] p-2 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbDataUrl}
                  alt="Scanned Parchi preview"
                  className="w-full max-h-44 object-contain rounded-xl bg-black/5"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => cameraInputRef.current?.click()}
                    className="min-h-[34px] rounded-lg border border-[var(--surface-border)] text-[11px] font-bold"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    disabled={scanning || !scanDataUrl}
                    onClick={() => runAiScan(scanDataUrl)}
                    className="min-h-[34px] rounded-lg bg-[var(--brand-tint)] text-[var(--brand)] text-[11px] font-bold inline-flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-Scan</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-3">
                {scanning && (
                  <div className="rounded-2xl bg-[var(--brand-tint)] border border-[var(--brand)]/25 p-5 flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Reading Parchi with Ucred AI...
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Extracting party name, line items, quantities, and total amount.
                      </p>
                    </div>
                  </div>
                )}

                {scanError && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 space-y-2"
                  >
                    <div className="flex items-start gap-2 text-xs font-bold text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => scanDataUrl && runAiScan(scanDataUrl)}
                        className="min-h-[36px] px-3 rounded-lg bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry AI Scan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScanError('');
                          setHasScanResult(true);
                          if (items.length === 0) {
                            setItems([{ name: 'Parchi Item', qty: 1, rate: 0, gstRate: 0 }]);
                          }
                        }}
                        className="min-h-[36px] px-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] text-xs font-bold"
                      >
                        Fill Manually
                      </button>
                    </div>
                  </div>
                )}

                {hasScanResult && !scanning && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>
                        AI Confidence:{' '}
                        <strong className="text-slate-900 dark:text-white capitalize">
                          {confidence}
                        </strong>
                        {matchedAccount ? ` · Matched Khata: ${matchedAccount.name}` : ' · New/Manual Party'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Party / Customer Name
                        </label>
                        <input
                          type="text"
                          value={partyName}
                          onChange={(e) => setPartyName(e.target.value)}
                          placeholder="Ramesh Kirana"
                          className="w-full min-h-[42px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Mobile (Optional)
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="9876543210"
                          className="w-full min-h-[42px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-tabular font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">
                          Entry Type
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDirection('given')}
                            className={`min-h-[40px] rounded-xl text-xs font-extrabold border ${
                              direction === 'given'
                                ? 'bg-red-600 border-red-600 text-white'
                                : 'border-[var(--surface-border)]'
                            }`}
                          >
                            Udhaar (Given)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirection('received')}
                            className={`min-h-[40px] rounded-xl text-xs font-extrabold border ${
                              direction === 'received'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-[var(--surface-border)]'
                            }`}
                          >
                            Paid (Jama)
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Bill Date
                        </label>
                        <input
                          type="date"
                          value={billDate}
                          onChange={(e) => setBillDate(e.target.value)}
                          className="w-full min-h-[40px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-xs font-tabular font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {hasScanResult && !scanning && (
              <>
                {/* Editable Line Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-500">
                      Extracted Line Items ({items.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => [...prev, { name: '', qty: 1, rate: 0, gstRate: 0 }])
                      }
                      className="text-xs font-bold text-[var(--brand)] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-1.5 items-center rounded-xl bg-[var(--app-bg)] p-2"
                      >
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...it, name: e.target.value };
                            setItems(next);
                          }}
                          placeholder="Item"
                          className="col-span-5 min-h-[36px] rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] px-2 text-xs font-semibold"
                        />
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={it.qty || ''}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...it, qty: Number(e.target.value) || 0 };
                            setItems(next);
                            setManualTotal('');
                          }}
                          placeholder="Qty"
                          className="col-span-2 min-h-[36px] rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] px-2 text-xs font-tabular"
                        />
                        <input
                          type="number"
                          min="0"
                          value={it.rate || ''}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...it, rate: Number(e.target.value) || 0 };
                            setItems(next);
                            setManualTotal('');
                          }}
                          placeholder="Rate"
                          className="col-span-3 min-h-[36px] rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] px-2 text-xs font-tabular"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setItems((prev) => prev.filter((_, i) => i !== idx));
                            setManualTotal('');
                          }}
                          aria-label="Remove item"
                          className="col-span-2 min-h-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Note & Total Override */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Note / Parchi Ref
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Atta, Sugar & Oil parchi"
                      className="w-full min-h-[42px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Total Amount (₹) · Items Sum {formatINR(computedItemsTotal)}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={manualTotal !== '' ? manualTotal : String(computedItemsTotal || '')}
                      onChange={(e) => setManualTotal(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border-2 border-[var(--brand)] bg-transparent px-3 text-base font-extrabold font-tabular"
                    />
                  </div>
                </div>

                {postError && <p className="text-xs font-bold text-red-600">{postError}</p>}

                {/* Dual Action Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={posting}
                    onClick={handlePostKhata}
                    className="min-h-[48px] rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {posting
                        ? 'Posting...'
                        : `Post ${formatINR(effectiveTotal)} to Khata`}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={posting}
                    onClick={handleOpenInBillBuilder}
                    className="min-h-[48px] rounded-xl border border-[var(--surface-border)] hover:border-[var(--brand)] font-extrabold text-sm inline-flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-[var(--brand)]" />
                    <span>Create GST Bill</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
