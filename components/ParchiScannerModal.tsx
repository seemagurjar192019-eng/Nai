'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
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
  onRestockItems?: (
    items: Array<{ name: string; quantity: number; unit: string; price: number }>
  ) => Promise<void>;
}

export const ParchiScannerModal: React.FC<ParchiScannerModalProps> = ({
  open,
  onClose,
  accounts,
  onPostToKhata,
  onCreateBillFromScan,
  onRestockItems,
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
  const [restocking, setRestocking] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);

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
    setRestocking(false);
    setRestockSuccess(false);
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
      setScanError(err instanceof Error ? err.message : 'Receipt scan failed. Try a clearer photo.');
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
      notes: notes.trim() || 'Created from Receipt Scan',
    });
    resetAll();
    onClose();
  };

  const validStockItems = useMemo(
    () => items.filter((i) => i.name.trim() && (Number(i.qty) || 0) > 0),
    [items]
  );

  const handleRestockStock = async () => {
    if (!onRestockItems || validStockItems.length === 0 || restocking || restockSuccess) return;
    setPostError('');
    setRestocking(true);
    try {
      await onRestockItems(
        validStockItems.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.qty) || 1,
          unit: 'pcs',
          price: Number(it.rate) || 0,
        }))
      );
      setRestockSuccess(true);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to restock scanned items.');
    } finally {
      setRestocking(false);
    }
  };

  return (
    <DetentSheetOverlay
      open={open}
      onClose={() => {
        if (scanning || posting) return;
        resetAll();
        onClose();
      }}
      title="Receipt Scanner"
      subtitle="Snap a handwritten parchi or supplier bill · Post to Ledger or GST Bill"
      initialDetent="full"
    >
      <div className="space-y-4 pb-safe">
        <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--ink-muted)]">
          <span
            style={{ background: 'var(--munim-gradient)' }}
            className="w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0"
          >
            <Receipt className="w-4 h-4" />
          </span>
          <span>Auto-extracts party name, line items &amp; total amount</span>
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
          <div className="rounded-[26px] bg-[var(--app-bg)] p-7 text-center space-y-4">
            <div
              style={{ background: 'var(--munim-gradient)' }}
              className="mx-auto w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg"
            >
              <Camera className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-base font-extrabold text-[var(--ink)]">
                Capture Handwritten Receipt or Invoice
              </p>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Supports handwritten retail slips, supplier invoices, and thermal receipts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[48px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm inline-flex items-center justify-center gap-2 tactile-key-primary active:scale-95 transition"
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[48px] px-4 rounded-2xl liquid-glass font-extrabold text-sm text-[var(--ink)] inline-flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Upload className="w-4 h-4 text-[var(--brand-accent)]" />
                <span>Upload</span>
              </button>
            </div>
            <p className="text-[11px] font-medium text-[var(--ink-muted)] leading-snug">
              Camera is accessed only when you tap Take Photo; compressed receipt images are sent over HTTPS solely for bill item extraction.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview with Animated Glowing Cyan/Indigo Laser Overlay while scanning */}
            <div className="rounded-[24px] bg-[var(--app-bg)] p-2.5 space-y-2.5">
              <div
                className={`relative rounded-2xl overflow-hidden bg-[var(--surface-subtle)] ${
                  scanning ? 'ring-2 ring-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.28)]' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbDataUrl}
                  alt="Scanned receipt preview"
                  className="w-full max-h-52 object-contain"
                />
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      style={{ background: 'var(--munim-gradient)' }}
                      className="parchi-laser absolute left-0 right-0 h-1 shadow-[0_0_16px_4px_rgba(6,182,212,0.75)]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[44px] rounded-xl liquid-glass text-xs font-bold text-[var(--ink)] active:scale-95 transition"
                >
                  Retake
                </button>
                <button
                  type="button"
                  disabled={scanning || !scanDataUrl}
                  onClick={() => runAiScan(scanDataUrl)}
                  className="min-h-[44px] rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center justify-center gap-1 active:scale-95 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Scan</span>
                </button>
              </div>
            </div>

            {scanning && (
              <div className="space-y-3">
                <div
                  style={{ background: 'var(--munim-gradient)' }}
                  className="rounded-2xl p-4 text-white flex items-center gap-3 shadow-lg"
                >
                  <Loader2 className="w-6 h-6 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-extrabold">Reading Receipt...</p>
                    <p className="text-xs opacity-90">
                      Extracting party name, line items, quantities, and total amount.
                    </p>
                  </div>
                </div>

                {/* Spatial Skeleton Shimmer Preview */}
                <div className="rounded-[22px] bg-[var(--app-bg)] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="h-9 rounded-xl spatial-shimmer" />
                    <div className="h-9 rounded-xl spatial-shimmer" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 rounded-full spatial-shimmer" />
                    <div className="h-4 w-1/2 rounded-full spatial-shimmer" />
                  </div>
                </div>
              </div>
            )}

            {scanError && (
              <div
                role="alert"
                className="rounded-2xl bg-[var(--credit-tint)] p-4 space-y-2"
              >
                <div className="flex items-start gap-2 text-xs font-bold text-[var(--credit-red)]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => scanDataUrl && runAiScan(scanDataUrl)}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[var(--credit-red)] text-white text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Scan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanError('');
                      setHasScanResult(true);
                      if (items.length === 0) {
                        setItems([{ name: 'Receipt Item', qty: 1, rate: 0, gstRate: 0 }]);
                      }
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl liquid-glass text-xs font-bold text-[var(--ink)] active:scale-95 transition"
                  >
                    Fill Manually
                  </button>
                </div>
              </div>
            )}

            {hasScanResult && !scanning && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-muted)]">
                    <span>
                      Scan Confidence:{' '}
                      <strong className="text-[var(--ink)] capitalize">{confidence}</strong>
                      {matchedAccount ? ` · Matched: ${matchedAccount.name}` : ' · New/Manual Party'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1">
                        Party / Customer Name
                      </label>
                      <input
                        type="text"
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        placeholder="Ramesh Kirana"
                        className="w-full min-h-[44px] rounded-2xl bg-[var(--surface-subtle)] px-3 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1">
                        Mobile (Optional)
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full min-h-[44px] rounded-2xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1">
                        Entry Type
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDirection('given')}
                          className={`min-h-[44px] rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                            direction === 'given'
                              ? 'bg-[var(--credit-red)] text-white shadow-xs'
                              : 'bg-[var(--app-bg)] text-[var(--ink)]'
                          }`}
                        >
                          Credit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirection('received')}
                          className={`min-h-[44px] rounded-xl text-[11px] font-extrabold active:scale-95 transition ${
                            direction === 'received'
                              ? 'bg-[var(--debit-green)] text-white shadow-xs'
                              : 'bg-[var(--app-bg)] text-[var(--ink)]'
                          }`}
                        >
                          Paid
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1">
                        Bill Date
                      </label>
                      <input
                        type="date"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl bg-[var(--surface-subtle)] px-2.5 text-xs font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Editable Line Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[var(--ink-muted)]">
                      Extracted Line Items ({items.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => [...prev, { name: '', qty: 1, rate: 0, gstRate: 0 }])
                      }
                      className="min-h-[44px] px-2 text-xs font-extrabold text-[var(--brand-accent)] inline-flex items-center gap-1 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-1.5 items-center rounded-2xl bg-[var(--app-bg)] p-2"
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
                          className="col-span-5 min-h-[44px] rounded-xl ios27-ceramic-tile px-2.5 text-xs font-semibold text-[var(--ink)] outline-none"
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
                          className="col-span-2 min-h-[44px] rounded-xl ios27-ceramic-tile px-2 text-xs font-tabular text-[var(--ink)] outline-none"
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
                          className="col-span-3 min-h-[44px] rounded-xl ios27-ceramic-tile px-2 text-xs font-tabular text-[var(--ink)] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setItems((prev) => prev.filter((_, i) => i !== idx));
                            setManualTotal('');
                          }}
                          aria-label="Remove item"
                          className="col-span-2 min-h-[44px] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--credit-red)] active:scale-95 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Note & Total Override */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1">
                      Note / Receipt Ref
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Atta, Sugar & Oil"
                      className="w-full min-h-[44px] rounded-2xl bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink-muted)] mb-1 font-tabular">
                      Total (₹) · Sum {formatINR(computedItemsTotal)}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={manualTotal !== '' ? manualTotal : String(computedItemsTotal || '')}
                      onChange={(e) => setManualTotal(e.target.value)}
                      className="w-full min-h-[44px] rounded-2xl bg-[var(--surface-subtle)] ring-2 ring-[var(--brand-accent)] px-3 text-base font-extrabold font-tabular text-[var(--ink)] outline-none"
                    />
                  </div>
                </div>

                {postError && <p className="text-xs font-bold text-[var(--credit-red)]">{postError}</p>}

                {/* Dual Action Bar */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={posting || restocking}
                      onClick={handlePostKhata}
                      className="min-h-[48px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 tactile-key-primary disabled:opacity-60 active:scale-95 transition"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span className="font-tabular">
                        {posting ? 'Posting...' : `Post ${formatINR(effectiveTotal)}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={posting || restocking}
                      onClick={handleOpenInBillBuilder}
                      className="min-h-[48px] rounded-2xl bg-[var(--app-bg)] font-extrabold text-xs text-[var(--ink)] inline-flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <FileText className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                      <span>Create GST Bill</span>
                    </button>
                  </div>

                  {onRestockItems && validStockItems.length > 0 && (
                    <button
                      type="button"
                      disabled={posting || restocking || restockSuccess}
                      onClick={handleRestockStock}
                      className={`w-full min-h-[44px] rounded-2xl border font-extrabold text-xs inline-flex items-center justify-center gap-2 active:scale-95 transition ${
                        restockSuccess
                          ? 'bg-[var(--debit-tint)] border-[var(--debit-green)]/30 text-[var(--debit-green)]'
                          : 'bg-[var(--surface-subtle)] border-[var(--glass-border)] text-[var(--ink)] hover:border-[var(--brand-accent)]/40'
                      }`}
                    >
                      {restockSuccess ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Restocked {validStockItems.length} items to Inventory</span>
                        </>
                      ) : (
                        <>
                          <PackagePlus className="w-4 h-4 shrink-0 text-[var(--ink)]" />
                          <span>
                            {restocking
                              ? 'Updating stock...'
                              : `Add ${validStockItems.length} Scanned Items to Stock`}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DetentSheetOverlay>
  );
};
