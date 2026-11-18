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
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Stock Management
          </h2>
          <p className="text-xs text-slate-500 font-tabular">
            {items.length} products · {lowCount} low stock · Value {formatINR(totalRetailValue)}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-sm font-extrabold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Item</span>
        </button>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 self-start">
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`min-h-[36px] px-4 rounded-lg text-xs font-bold transition ${
              stockFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-[var(--brand)] shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('low')}
            className={`min-h-[36px] px-4 rounded-lg text-xs font-bold transition ${
              stockFilter === 'low'
                ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
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
          className="flex-1 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 text-sm outline-none"
        />
      </div>

      {errorMsg && !modalOpen && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between"
        >
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">
            {stockFilter === 'low'
              ? 'All items are comfortably stocked!'
              : 'Manage your shop inventory & get low-stock alerts'}
          </p>
          {stockFilter !== 'low' && (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const isLow = item.quantity <= item.lowStockThreshold;
            const armed = armedDeleteId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-extrabold text-base truncate">{item.name}</p>
                  <p className="text-xs font-tabular font-semibold text-slate-500">
                    Sale: {formatINR(item.salePrice)} / {item.unit}
                    {item.purchasePrice ? ` · Cost: ${formatINR(item.purchasePrice)}` : ''}
                  </p>
                  {isLow && (
                    <p className="text-[11px] font-bold text-amber-600 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item, -1)}
                    aria-label={`Decrease stock for ${item.name}`}
                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[46px] text-center font-extrabold font-tabular text-sm">
                    {item.quantity} {item.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item, 1)}
                    aria-label={`Increase stock for ${item.name}`}
                    className="w-9 h-9 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    aria-label={`Edit ${item.name}`}
                    className="p-2 text-slate-400 hover:text-[var(--brand)]"
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
                    className={`px-1.5 py-1 rounded-lg text-xs font-bold ${
                      armed ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-600'
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
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Toor Dal - 1 kg"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-bold"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Sale Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="165"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="kg / pcs"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="25"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Low Stock Alert At
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-tabular font-bold"
                  />
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-xs font-bold text-red-600">{errorMsg}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingItemId ? 'Update Stock Item' : 'Save Stock Item'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
