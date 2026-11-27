'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { UCRED_LOGO_PATH, formatINR, formatINRCompact } from '@/lib/i18n';
import {
  PERSONA_OPTIONS,
  type PersonaCapabilities,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';
import type { Business } from '@/types';
import {
  APPLE_EASE,
  SNAPPY_SPRING,
  SPATIAL_SPRING,
  getChromeGlideTransition,
} from '../motion/SpatialMotionEngine';

export interface DynamicIslandToast {
  id: string;
  kind: 'added' | 'deleted';
  title: string;
  subtitle: string;
  whatsappUrl?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

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
  voiceModalOpen?: boolean;
  islandToast?: DynamicIslandToast | null;
  undoBusy?: boolean;
  isHeaderVisible?: boolean;
  onOpenBusinessSwitcher: () => void;
  onToggleSearch: () => void;
  onChangeSearch: (q: string) => void;
  onOpenNotifications: () => void;
  onOpenProfileTools: () => void;
  onSwitchPersonaFocus: (focus: PersonaCategoryId) => void;
  onEditPersonaModes: () => void;
  onBackToTop: () => void;
}

/**
 * Liquid Glass iOS 27 Top Live Capsule:
 * - Single sculpted translucent capsule with hairline specular rim
 * - Morphs smoothly into obsidian confirmation capsule on `islandToast` (Undo + WhatsApp Receipt)
 * - Docks compact Net Balance readout on scroll using GPU opacity/scale/y
 * - Expands live summary drawer via GPU transforms/opacity (zero height:auto animation)
 * - Automatically hides on downward scroll and reappears on upward scroll (YouTube / Safari style)
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
  voiceModalOpen = false,
  islandToast = null,
  undoBusy = false,
  isHeaderVisible = true,
  onOpenBusinessSwitcher,
  onToggleSearch,
  onChangeSearch,
  onOpenNotifications,
  onOpenProfileTools,
  onSwitchPersonaFocus,
  onEditPersonaModes,
  onBackToTop,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [islandExpanded, setIslandExpanded] = useState(false);

  const absNet = Math.abs(netBalance);
  const netSign = netBalance < 0 ? '-' : '';
  const initialLetter = (business.name || 'U').charAt(0).toUpperCase();

  // Raycast / Linear style global Cmd+K shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        haptics.tap();
        onToggleSearch();
      } else if (e.key === 'Escape' && searchOpen) {
        e.preventDefault();
        onToggleSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSearch, searchOpen]);

  const effectiveHeaderVisible = isHeaderVisible || Boolean(islandToast) || voiceModalOpen || searchOpen;

  return (
    <motion.header
      initial={false}
      animate={
        prefersReducedMotion
          ? { opacity: effectiveHeaderVisible ? 1 : 0 }
          : { y: effectiveHeaderVisible ? 0 : -116, opacity: effectiveHeaderVisible ? 1 : 0 }
      }
      transition={getChromeGlideTransition(effectiveHeaderVisible)}
      aria-hidden={!effectiveHeaderVisible}
      className="no-print absolute top-0 inset-x-0 z-40 px-4 lg:px-6 pt-safe pb-2 pointer-events-none bg-gradient-to-b from-[var(--app-bg)]/95 via-[var(--app-bg)]/55 to-transparent will-change-transform"
    >
      <div
        className={`w-full max-w-[1120px] mx-auto space-y-2 ${
          effectiveHeaderVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <motion.div
          layout={!prefersReducedMotion}
          transition={SPATIAL_SPRING}
          className={
            islandToast || voiceModalOpen
              ? 'rounded-[26px] px-2.5 py-1.5 bg-[#0A0A0A]/95 dark:bg-[#18181B]/95 backdrop-blur-2xl text-white border border-white/12 shadow-[0_14px_34px_-8px_rgba(0,0,0,0.45)] transition-colors'
              : 'transition-colors'
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            {voiceModalOpen && !islandToast ? (
              <motion.div
                key="island-voice-live"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: APPLE_EASE }}
                className="flex items-center justify-between gap-2 min-h-[44px] px-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-white text-[#0A0A0A] flex items-center justify-center shrink-0">
                    <span className="flex items-end gap-[2px] h-3">
                      <span className="eq-bar w-[2px] h-3 rounded-full bg-[#0A0A0A]" />
                      <span
                        style={{ animationDelay: '0.14s' }}
                        className="eq-bar w-[2px] h-2 rounded-full bg-[#0A0A0A]"
                      />
                      <span
                        style={{ animationDelay: '0.28s' }}
                        className="eq-bar w-[2px] h-3 rounded-full bg-[#0A0A0A]"
                      />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate leading-tight">
                      Voice Entry Active
                    </p>
                    <p className="text-[10px] text-white/65 truncate leading-tight">
                      Listening for credit, payment, or cash entries
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-white/80 shrink-0 whitespace-nowrap">
                  Live
                </span>
              </motion.div>
            ) : islandToast ? (
              <motion.div
                key={`island-toast-${islandToast.id}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: APPLE_EASE }}
                className="flex items-center justify-between gap-2 min-h-[44px] px-1.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SNAPPY_SPRING}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      islandToast.kind === 'added'
                        ? 'bg-[#15803D] text-white'
                        : 'bg-[#B91C1C] text-white'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate font-tabular leading-tight">
                      {islandToast.title}
                    </p>
                    <p className="text-[10px] text-white/70 truncate font-tabular leading-tight">
                      {islandToast.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {islandToast.whatsappUrl && (
                    <a
                      href={islandToast.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-2.5 rounded-full bg-white/15 text-white text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Receipt</span>
                    </a>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    transition={SNAPPY_SPRING}
                    type="button"
                    disabled={undoBusy}
                    onClick={() => {
                      haptics.tap();
                      islandToast.onUndo();
                    }}
                    className="min-h-[36px] px-3 rounded-full bg-white text-[#0A0A0A] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                  >
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Undo</span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={islandToast.onDismiss}
                    aria-label="Dismiss confirmation"
                    className="w-9 h-9 rounded-full text-white/70 hover:text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="island-default-bar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex items-center justify-between gap-2"
              >
                {/* Zone 1: Minimal Monochrome Store Switcher Pill */}
                <motion.button
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  transition={SNAPPY_SPRING}
                  type="button"
                  aria-label={`${business.name} — Switch store`}
                  title={isGuestMode ? 'Saved on device' : 'Cloud Synced'}
                  onClick={() => {
                    haptics.tap();
                    setIslandExpanded(false);
                    onOpenBusinessSwitcher();
                  }}
                  className="liquid-glass min-h-[44px] pl-1.5 pr-3 py-1 rounded-full inline-flex items-center gap-2 min-w-0 text-left"
                >
                  <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[var(--surface-subtle)] border border-[var(--glass-border)] grayscale contrast-125">
                    <Image
                      src={UCRED_LOGO_PATH}
                      alt="Ucred"
                      width={28}
                      height={28}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-display text-[13px] font-semibold truncate max-w-[130px] sm:max-w-[190px] text-[var(--ink)]">
                      {business.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
                  </div>
                </motion.button>

                {/* Zone 2: Scroll-Linked Docked Net Balance Readout */}
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
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  transition={SNAPPY_SPRING}
                  onClick={() => {
                    haptics.tap();
                    setIslandExpanded((v) => !v);
                  }}
                  className="liquid-glass min-h-[40px] max-w-[128px] px-3 rounded-full text-[var(--ink)] inline-flex items-center gap-1 text-xs font-semibold font-tabular shrink-0 whitespace-nowrap truncate"
                >
                  <span
                    className={`truncate ${
                      netBalance > 0
                        ? 'text-[var(--debit-green)]'
                        : netBalance < 0
                          ? 'text-[var(--credit-red)]'
                          : 'text-[var(--ink)]'
                    }`}
                  >
                    {hideBalance ? '₹••••' : `${netSign}${formatINRCompact(absNet)}`}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-[var(--ink-muted)] shrink-0 transition-transform ${
                      islandExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </motion.button>

                {/* Zone 3: Minimal Monochrome Search + Account Orbs (44x44px touch targets) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <motion.button
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={SNAPPY_SPRING}
                    onClick={() => {
                      haptics.tap();
                      onToggleSearch();
                    }}
                    aria-label="Search accounts"
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                      searchOpen
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                        : 'liquid-glass-orb text-[var(--ink)]'
                    }`}
                  >
                    <Search className="w-[18px] h-[18px] stroke-[1.9]" />
                  </motion.button>

                  <motion.button
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={SNAPPY_SPRING}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onOpenProfileTools();
                    }}
                    aria-label="Open Settings"
                    className="w-11 h-11 rounded-full liquid-glass-orb flex items-center justify-center"
                  >
                    <span className="w-8 h-8 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] font-display text-xs font-semibold flex items-center justify-center">
                      {initialLetter}
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* GPU-Composited Floating Live Summary Drawer */}
        <AnimatePresence>
          {islandExpanded && !islandToast && !voiceModalOpen && (
            <motion.div
              key="dynamic-island-drawer"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.16, ease: APPLE_EASE } }
              }
              transition={SPATIAL_SPRING}
              className="liquid-glass-elevated rounded-[24px] p-3 space-y-3 will-change-transform"
            >
              <div
                className={`grid gap-2 ${
                  capabilities.showGalla ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                <div className="rounded-2xl bg-[var(--surface-subtle)] px-3 py-2.5">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--ink-muted)]">
                    <ArrowDown className="w-3 h-3 shrink-0" />
                    <span className="truncate">{capabilities.lenaLabel}</span>
                  </div>
                  <p className="font-display text-xs font-semibold font-tabular text-[var(--debit-green)] mt-0.5 truncate">
                    {hideBalance
                      ? '₹••••'
                      : totalReceivable >= 1000000
                        ? formatINRCompact(totalReceivable)
                        : formatINR(totalReceivable)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface-subtle)] px-3 py-2.5">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--ink-muted)]">
                    <ArrowUp className="w-3 h-3 shrink-0" />
                    <span className="truncate">{capabilities.denaLabel}</span>
                  </div>
                  <p className="font-display text-xs font-semibold font-tabular text-[var(--credit-red)] mt-0.5 truncate">
                    {hideBalance
                      ? '₹••••'
                      : totalPayable >= 1000000
                        ? formatINRCompact(totalPayable)
                        : formatINR(totalPayable)}
                  </p>
                </div>

                {capabilities.showGalla && (
                  <div className="rounded-2xl bg-[var(--surface-subtle)] px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--ink-muted)]">
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span className="truncate">{capabilities.gallaSegmentLabel || 'Cashbook'}</span>
                    </div>
                    <p className="font-display text-xs font-semibold font-tabular text-[var(--ink)] mt-0.5 truncate">
                      {hideBalance
                        ? '₹••••'
                        : gallaBalance >= 1000000
                          ? formatINRCompact(gallaBalance)
                          : formatINR(gallaBalance)}
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
                  className="min-h-[40px] px-3.5 rounded-full bg-[var(--surface-subtle)] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Workspaces</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setIslandExpanded(false);
                    onBackToTop();
                  }}
                  className="min-h-[40px] px-3.5 rounded-full bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Back to Top</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Multi-Mode Workspace Strip (Only when user enables 2+ modes) */}
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
                  className={`relative min-h-[34px] px-3.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 active:scale-95 transition-colors ${
                    isActive
                      ? 'text-[var(--brand-fg)]'
                      : 'liquid-glass text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'dynamicModePill'}
                      transition={SPATIAL_SPRING}
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
              aria-label="Edit workspaces"
              className="min-h-[34px] px-3 rounded-full liquid-glass text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 active:scale-95 transition"
            >
              Workspaces
            </button>
          </div>
        )}

        {/* Spotlight Command Palette / Search Drawer */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.14, ease: APPLE_EASE } }
              }
              transition={SNAPPY_SPRING}
              className="relative"
            >
              <div className="relative">
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onChangeSearch(e.target.value)}
                  placeholder={
                    capabilities.showSuppliers
                      ? 'Search party name or phone... (Esc to close)'
                      : 'Search contact name or phone... (Esc to close)'
                  }
                  className="w-full min-h-[46px] rounded-[20px] liquid-glass-elevated pl-10 pr-12 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
                <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2]" />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onChangeSearch('');
                    }}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-semibold text-[var(--ink-muted)] bg-[var(--surface-subtle)] border border-[var(--glass-border)] font-tabular">
                    Esc
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};
