'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Edit3, Minus, Package, Plus, Trash2, X } from 'lucide-react';
import { formatINR } from '@/lib/i18n';
import type { StockItem } from '@/lib/types';

interface StockViewProps {
  items: StockItem[];
  onSaveItem: (payload: {
    existingId?: string;
    name: string;
    unit: string;
    salePrice: number;
    purchasePrice?: number;
    quantity: number;
    lowStockThreshold: number;
  }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

export const StockView: React.FC<StockViewProps> = ({
  items,
  onSaveItem,
  onDeleteItem,
}) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const lowCount = useMemo(
    () => items.filter((i) => i.quantity <= i.lowStockThreshold).length,
    [items]
  );

  const totalRetailValue = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.salePrice, 0),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (stockFilter === 'low' && i.quantity > i.lowStockThreshold) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, stockFilter]);

  const openAddModal = () => {
    setEditingItemId(undefined);
    setName('');
    setUnit('pcs');
    setSalePrice('');
    setPurchasePrice('');
    setQuantity('');
    setLowStockThreshold('5');
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItemId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setSalePrice(String(item.salePrice));
    setPurchasePrice(item.purchasePrice ? String(item.purchasePrice) : '');
    setQuantity(String(item.quantity));
    setLowStockThreshold(String(item.lowStockThreshold));
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Please enter item name.');
      return;
    }
    setSaving(true);
    try {
      await onSaveItem({
        existingId: editingItemId,
        name: name.trim(),
        unit: unit.trim() || 'pcs',
        salePrice: Math.max(0, Number(salePrice) || 0),
        purchasePrice: Math.max(0, Number(purchasePrice) || 0),
        quantity: Math.max(0, Number(quantity) || 0),
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
      });
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save stock item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustQty = async (item: StockItem, delta: number) => {
    setErrorMsg('');
    try {
      await onSaveItem({
        existingId: item.id,
        name: item.name,
        unit: item.unit,
        salePrice: item.salePrice,
        purchasePrice: item.purchasePrice,
        quantity: Math.max(0, Math.round((item.quantity + delta) * 100) / 100),
        lowStockThreshold: item.lowStockThreshold,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update stock quantity.');
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg('');
    try {
      await onDeleteItem(id);
      setArmedDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete item.');
    }
  };

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
            Stock Management
          </h2>
          <p className="text-xs text-[var(--ink-muted)] font-tabular">
            {items.length} products · {lowCount} low stock · {formatINR(totalRetailValue)}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="min-h-[44px] px-3.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Sliding Filter Tabs + Search */}
      <div className="space-y-2.5">
        <div className="relative grid grid-cols-2 rounded-2xl bg-[var(--surface-subtle)] p-1 shadow-inner max-w-[265px]">
          <span
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl spatial-card transition-transform duration-200 ease-out ${
              stockFilter === 'low' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`relative z-10 min-h-[38px] px-3 rounded-xl text-xs font-extrabold transition-colors active:scale-95 ${
              stockFilter === 'all' ? 'text-[var(--brand-accent)]' : 'text-[var(--ink-muted)]'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('low')}
            className={`relative z-10 min-h-[38px] px-3 rounded-xl text-xs font-extrabold transition-colors active:scale-95 ${
              stockFilter === 'low' ? 'text-[var(--alert-amber)]' : 'text-[var(--ink-muted)]'
            }`}
          >
            Low Stock ({lowCount})
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory item..."
          className="w-full min-h-[46px] rounded-2xl spatial-card ring-1 ring-white/80 dark:ring-white/10 px-4 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition"
        />
      </div>

      {errorMsg && !modalOpen && (
        <div
          role="alert"
          className="rounded-2xl bg-[var(--credit-tint)] px-4 py-3 text-xs font-bold text-[var(--credit-red)] flex items-center justify-between shadow-xs"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Dismiss error"
            className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[28px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-8 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/20 shadow-inner text-[var(--brand-accent)] flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <p className="font-display text-base font-bold text-[var(--ink)]">
            {stockFilter === 'low'
              ? 'All items are comfortably stocked!'
              : 'Manage your shop inventory & get low-stock alerts'}
          </p>
          {stockFilter !== 'low' && (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[46px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item, idx) => {
            const isLow = item.quantity <= item.lowStockThreshold;
            const armed = armedDeleteId === item.id;
            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                className="stagger-fade-up rounded-[22px] spatial-card ring-1 ring-white/80 dark:ring-white/10 p-3.5 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-extrabold text-sm text-[var(--ink)] leading-snug truncate">
                    {item.name}
                  </p>
                  <p className="text-xs font-tabular font-semibold text-[var(--ink-muted)]">
                    Sale: {formatINR(item.salePrice)} / {item.unit}
                    {item.purchasePrice ? ` · Cost: ${formatINR(item.purchasePrice)}` : ''}
                  </p>
                  {isLow && (
                    <p className="text-[11px] font-bold text-[var(--alert-amber)] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item, -1)}
                    aria-label={`Decrease stock for ${item.name}`}
                    className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink)] active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[44px] text-center font-extrabold font-tabular text-xs text-[var(--ink)]">
                    {item.quantity} {item.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item, 1)}
                    aria-label={`Increase stock for ${item.name}`}
                    className="w-10 h-10 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    aria-label={`Edit ${item.name}`}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--brand-accent)] hover:bg-[var(--brand-tint)]/60 active:scale-95 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (armed) handleDelete(item.id);
                      else setArmedDeleteId(item.id);
                    }}
                    aria-label={`Delete ${item.name}`}
                    className={`min-w-[40px] min-h-[40px] px-2 rounded-xl text-xs font-bold flex items-center justify-center active:scale-95 transition ${
                      armed
                        ? 'bg-[var(--credit-red)] text-white shadow-sm'
                        : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]/50'
                    }`}
                  >
                    {armed ? 'Delete?' : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/55 flex items-end justify-center backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-slide-up w-full max-w-[430px] rounded-t-[32px] spatial-sheet ring-1 ring-white/80 dark:ring-white/10 p-6 pt-3 space-y-4 pb-safe max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--ink-muted)]/25" />

            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                {editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Toor Dal - 1 kg"
                  className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Sale ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="165"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Cost ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Opt."
                    className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="kg"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="25"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                    Low Stock Alert At
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl bg-[var(--surface-subtle)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-xs font-bold text-[var(--credit-red)]">{errorMsg}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold shadow-md disabled:opacity-60 active:scale-95 transition"
            >
              {saving ? 'Saving...' : editingItemId ? 'Update Stock Item' : 'Save Stock Item'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
