'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, type MotionValue } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { UCRED_LOGO_PATH, formatINR } from '@/lib/i18n';
import {
  PERSONA_OPTIONS,
  getTimeGreeting,
  type PersonaCapabilities,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';
import type { Business } from '@/types';

export interface DynamicIslandHeaderProps {
  business: Business;
  isGuestMode: boolean;
  hideBalance: boolean;
  searchOpen: boolean;
  searchQuery: string;
  unreadCount: number;
  netBalance: number;
  totalReceivable: number;
  totalPayable: number;
  gallaBalance: number;
  capabilities: PersonaCapabilities;
  personaPrefs: PersonaPrefs;
  isHeroDocked: boolean;
  dockedPillOpacity: MotionValue<number>;
  dockedPillScale: MotionValue<number>;
  dockedPillY: MotionValue<number>;
  onOpenBusinessSwitcher: () => void;
  onToggleSearch: () => void;
  onChangeSearch: (q: string) => void;
  onOpenNotifications: () => void;
  onOpenProfileTools: () => void;
  onSwitchPersonaFocus: (focus: PersonaCategoryId) => void;
  onEditPersonaModes: () => void;
  onBackToTop: () => void;
}

const ISLAND_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };
const TACTILE_SPRING = { type: 'spring' as const, stiffness: 460, damping: 24 };

/**
 * Scroll-Linked Top Dynamic Island Header.
 * Solid matte opaque pill that receives the compressed Hero Balance via compositor transforms
 * and expands inline on tap to reveal persona-filtered totals, 1-tap mode switch, and Back to Top.
 */
export const DynamicIslandHeader: React.FC<DynamicIslandHeaderProps> = ({
  business,
  isGuestMode,
  hideBalance,
  searchOpen,
  searchQuery,
  unreadCount,
  netBalance,
  totalReceivable,
  totalPayable,
  gallaBalance,
  capabilities,
  personaPrefs,
  isHeroDocked,
  dockedPillOpacity,
  dockedPillScale,
  dockedPillY,
  onOpenBusinessSwitcher,
  onToggleSearch,
  onChangeSearch,
  onOpenNotifications,
  onOpenProfileTools,
  onSwitchPersonaFocus,
  onEditPersonaModes,
  onBackToTop,
}) => {
  const [islandExpanded, setIslandExpanded] = useState(false);

  const absNet = Math.abs(netBalance);
  const netSign = netBalance < 0 ? '-' : '';
  const initialLetter = (business.name || 'U').charAt(0).toUpperCase();

  return (
    <header className="no-print shrink-0 z-40 px-4 pt-3 pb-1 relative space-y-2">
      <motion.div
        layout
        transition={ISLAND_SPRING}
        className="rounded-[26px] bg-[var(--surface)] shadow-[var(--spatial-shadow)] px-2.5 py-1.5"
      >
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: Shop Switcher Badge */}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setIslandExpanded(false);
              onOpenBusinessSwitcher();
            }}
            className="min-h-[40px] pl-1 pr-2 py-0.5 rounded-full hover:bg-[var(--surface-subtle)] inline-flex items-center gap-2 min-w-0 active:scale-95 transition text-left"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[var(--surface-subtle)]">
              <Image
                src={UCRED_LOGO_PATH}
                alt="Ucred"
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--ink-muted)] leading-none">
                {getTimeGreeting()}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-display text-xs font-extrabold truncate max-w-[96px] text-[var(--ink)]">
                  {business.name}
                </span>
                <span
                  aria-label={isGuestMode ? 'Offline Guest Vault' : 'Cloud Synced'}
                  title={isGuestMode ? 'Saved on device' : 'Cloud Synced'}
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                    isGuestMode ? 'bg-[var(--brand)]' : 'bg-[var(--debit-green)]'
                  }`}
                />
                <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
              </div>
            </div>
          </button>

          {/* Center: Scroll-Linked Docked Balance Pill (GPU Opacity/Scale/Y) */}
          <motion.button
            type="button"
            aria-label="Toggle live balance summary"
            aria-expanded={islandExpanded}
            style={{
              opacity: islandExpanded ? 1 : dockedPillOpacity,
              scale: islandExpanded ? 1 : dockedPillScale,
              y: islandExpanded ? 0 : dockedPillY,
              pointerEvents: isHeroDocked || islandExpanded ? 'auto' : 'none',
            }}
            onClick={() => {
              haptics.tap();
              setIslandExpanded((v) => !v);
            }}
            className="min-h-[34px] px-2.5 rounded-full bg-[var(--surface-subtle)] text-[var(--ink)] inline-flex items-center gap-1 text-xs font-extrabold font-tabular shrink-0 active:scale-95 transition"
          >
            <span
              className={
                netBalance > 0
                  ? 'text-[var(--debit-green)]'
                  : netBalance < 0
                    ? 'text-[var(--credit-red)]'
                    : 'text-[var(--ink)]'
              }
            >
              {hideBalance ? '₹••••' : `${netSign}${formatINR(absNet)}`}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-[var(--ink-muted)] transition-transform ${
                islandExpanded ? 'rotate-180' : ''
              }`}
            />
          </motion.button>

          {/* Right: Search + Notifications + Matte Royal Indigo Profile Avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92, rotate: 10 }}
              transition={TACTILE_SPRING}
              onClick={() => {
                haptics.tap();
                onToggleSearch();
              }}
              aria-label="Search accounts"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                searchOpen
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Search className="w-4 h-4" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92, rotate: -14 }}
              transition={TACTILE_SPRING}
              onClick={() => {
                haptics.tap();
                onOpenNotifications();
              }}
              aria-label="Open notifications"
              className="relative w-9 h-9 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
            >
              <Bell
                className={`w-4 h-4 ${
                  unreadCount > 0 ? 'bell-wiggle text-[var(--brand-accent)]' : ''
                }`}
              />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--credit-red)] text-white text-[9px] font-extrabold font-tabular flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={TACTILE_SPRING}
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenProfileTools();
              }}
              aria-label="Open Profile, Backup and Tools"
              style={{ backgroundColor: 'var(--brand)' }}
              className="w-9 h-9 rounded-full text-white font-display text-xs font-extrabold flex items-center justify-center shadow-sm"
            >
              {initialLetter}
            </motion.button>
          </div>
        </div>

        {/* Inline Expanded Dynamic Island Drawer */}
        <AnimatePresence initial={false}>
          {islandExpanded && (
            <motion.div
              key="dynamic-island-drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
              transition={ISLAND_SPRING}
              className="overflow-hidden"
            >
              <div className="pt-2.5 mt-2 border-t border-[var(--surface-subtle)] space-y-2.5 px-1 pb-1">
                {/* Persona-Gated Metric Summary */}
                <div
                  className={`grid gap-2 ${
                    capabilities.showGalla ? 'grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  <div className="rounded-2xl bg-[var(--debit-tint)] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[var(--debit-green)]">
                      <ArrowDown className="w-3 h-3" />
                      <span>Lena</span>
                    </div>
                    <p className="font-display text-xs font-extrabold font-tabular text-[var(--debit-green)] mt-0.5">
                      {hideBalance ? '₹••••' : formatINR(totalReceivable)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--credit-tint)] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[var(--credit-red)]">
                      <ArrowUp className="w-3 h-3" />
                      <span>Dena</span>
                    </div>
                    <p className="font-display text-xs font-extrabold font-tabular text-[var(--credit-red)] mt-0.5">
                      {hideBalance ? '₹••••' : formatINR(totalPayable)}
                    </p>
                  </div>

                  {capabilities.showGalla && (
                    <div className="rounded-2xl bg-[var(--brand-tint)] px-2.5 py-2">
                      <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[var(--brand-accent)]">
                        <Wallet className="w-3 h-3" />
                        <span>Galla</span>
                      </div>
                      <p className="font-display text-xs font-extrabold font-tabular text-[var(--brand-accent)] mt-0.5">
                        {hideBalance ? '₹••••' : formatINR(gallaBalance)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setIslandExpanded(false);
                      onEditPersonaModes();
                    }}
                    className="min-h-[34px] px-3 rounded-full bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 active:scale-95 transition"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Modes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      setIslandExpanded(false);
                      onBackToTop();
                    }}
                    className="min-h-[34px] px-3 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-extrabold inline-flex items-center gap-1 active:scale-95 transition"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Back to Top</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 1-Tap Multi-Mode Capsule Switcher when user selected multiple business/personal modes */}
      {personaPrefs.categories.length > 1 && (
        <div
          aria-label="Active workspace mode switcher"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5"
        >
          {personaPrefs.categories.map((catId) => {
            const meta = PERSONA_OPTIONS.find((o) => o.id === catId);
            if (!meta) return null;
            const isActive = personaPrefs.activeFocus === catId;
            return (
              <button
                key={catId}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  haptics.tap();
                  onSwitchPersonaFocus(catId);
                }}
                className={`relative min-h-[30px] px-3 rounded-full text-[11px] font-extrabold whitespace-nowrap shrink-0 active:scale-95 transition-colors ${
                  isActive
                    ? 'text-[var(--brand-fg)]'
                    : 'bg-[var(--surface)] text-[var(--ink-muted)] shadow-[var(--spatial-shadow)]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="dynamicModePill"
                    transition={ISLAND_SPRING}
                    className="absolute inset-0 rounded-full bg-[var(--brand)] shadow-xs"
                  />
                )}
                <span className="relative z-10">{meta.badge}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onEditPersonaModes();
            }}
            aria-label="Edit business modes"
            className="min-h-[30px] px-2.5 rounded-full bg-[var(--surface-subtle)] text-[10px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] whitespace-nowrap shrink-0"
          >
            + Modes
          </button>
        </div>
      )}

      {/* Search Drawer */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pt-0.5"
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              placeholder={
                capabilities.showSuppliers
                  ? 'Search party name or mobile...'
                  : 'Search contact name or mobile...'
              }
              className="w-full min-h-[44px] rounded-2xl bg-[var(--surface)] shadow-[var(--spatial-shadow)] px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
