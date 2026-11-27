'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Edit3, Minus, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { formatINR } from '@/lib/i18n';
import type { StockItem } from '@/lib/types';
import { haptics } from '@/utils/haptics';
import { DetentSheetOverlay } from './motion/DetentSheetOverlay';
import { SNAPPY_SPRING, calculateStaggerDelay } from './motion/SpatialMotionEngine';

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

const SEG_SPRING = SNAPPY_SPRING;

export const StockView: React.FC<StockViewProps> = ({
  items,
  onSaveItem,
  onDeleteItem,
}) => {
  const prefersReducedMotion = useReducedMotion();
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
    haptics.tap();
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
    haptics.tap();
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
      setErrorMsg('Please enter an item name.');
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
      haptics.success();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save stock item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustQty = async (item: StockItem, delta: number) => {
    haptics.tap();
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
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            Stock Inventory
          </h2>
          <p className="text-xs font-medium text-[var(--ink-muted)] font-tabular mt-0.5">
            {items.length} products · {lowCount} low stock · {formatINR(totalRetailValue)}
          </p>
        </div>

        <motion.button
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          transition={SEG_SPRING}
          type="button"
          onClick={openAddModal}
          className="min-h-[44px] px-4 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 tactile-key-primary transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </motion.button>
      </div>

      {/* Unified Pill Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative grid grid-cols-2 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1 sm:w-[270px] shrink-0">
          {(
            [
              { id: 'all', label: `All (${items.length})` },
              { id: 'low', label: `Low Stock (${lowCount})` },
            ] as const
          ).map((tab) => {
            const active = stockFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  haptics.tap();
                  setStockFilter(tab.id);
                }}
                className={`relative z-10 min-h-[40px] px-3 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? tab.id === 'low' && lowCount > 0
                      ? 'text-[var(--alert-amber)]'
                      : 'text-[var(--ink)]'
                    : 'text-[var(--ink-muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'stockFilterSeg'}
                    transition={SEG_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory items..."
            className="w-full min-h-[44px] rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] pl-10 pr-4 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)] transition"
          />
        </div>
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
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[22px] ios27-inset-group p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] text-[var(--ink)] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <p className="font-display text-base font-bold text-[var(--ink)]">
            {stockFilter === 'low'
              ? 'All items are comfortably stocked'
              : 'Manage shop inventory and low-stock alerts'}
          </p>
          {stockFilter !== 'low' && (
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1.5 tactile-key-primary active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="ios27-inset-group rounded-[22px] divide-y divide-[var(--glass-border)] overflow-hidden">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => {
              const isLow = item.quantity <= item.lowStockThreshold;
              const armed = armedDeleteId === item.id;
              return (
                <motion.div
                  key={item.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ ...SEG_SPRING, delay: calculateStaggerDelay(idx) }}
                  className="px-4 py-3.5 min-h-[64px] flex items-center justify-between gap-2.5 hover:bg-[var(--surface-subtle)]/50 transition-colors will-change-transform"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-semibold text-sm text-[var(--ink)] leading-snug truncate">
                      {item.name}
                    </p>
                    <p className="text-xs font-tabular font-medium text-[var(--ink-muted)]">
                      Sale: {formatINR(item.salePrice)} / {item.unit}
                      {item.purchasePrice ? ` · Cost: ${formatINR(item.purchasePrice)}` : ''}
                    </p>
                    {isLow && (
                      <p className="text-[11px] font-semibold text-[var(--alert-amber)] inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <div className="inline-flex items-center rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-0.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustQty(item, -1)}
                        aria-label={`Decrease stock for ${item.name}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface)] active:scale-90 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[44px] px-1 text-center font-semibold font-tabular text-xs text-[var(--ink)]">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustQty(item, 1)}
                        aria-label={`Increase stock for ${item.name}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink)] hover:bg-[var(--surface)] active:scale-90 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      aria-label={`Edit ${item.name}`}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (armed) void handleDelete(item.id);
                        else setArmedDeleteId(item.id);
                      }}
                      aria-label={`Delete ${item.name}`}
                      className={`min-w-[40px] min-h-[40px] px-2 rounded-full text-xs font-semibold flex items-center justify-center active:scale-95 transition ${
                        armed
                          ? 'bg-[var(--credit-red)] text-white shadow-sm'
                          : 'text-[var(--ink-muted)] hover:text-[var(--credit-red)] hover:bg-[var(--credit-tint)]'
                      }`}
                    >
                      {armed ? 'Delete?' : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Item Detent Sheet */}
      <DetentSheetOverlay
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        title={editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'}
        subtitle="Rates & low-stock alerts"
        initialDetent="peek"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lentils - 1 kg"
                className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3.5 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--ink-muted)] mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg"
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-sm font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
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
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--glass-border)] px-3 text-sm font-tabular font-bold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
            </div>
          </div>

          {errorMsg && <p className="text-xs font-bold text-[var(--credit-red)]">{errorMsg}</p>}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full min-h-[48px] rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-semibold tactile-key-primary disabled:opacity-60 active:scale-95 transition"
          >
            {saving ? 'Saving...' : editingItemId ? 'Update Stock Item' : 'Save Stock Item'}
          </button>
        </div>
      </DetentSheetOverlay>
    </div>
  );
};
