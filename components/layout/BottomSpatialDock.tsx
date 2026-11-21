'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, NotebookPen, Receipt, Users } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { MunimVoiceOrb } from '../voice/MunimVoiceOrb';
import type { PersonaCapabilities } from '@/lib/persona';
import type { MainTab } from '@/types';

export interface BottomSpatialDockProps {
  mainTab: MainTab;
  hasSecondaryRoute: boolean;
  voiceModalOpen: boolean;
  capabilities: PersonaCapabilities;
  onSelectLeftTab: () => void;
  onOpenVoice: () => void;
  onSelectRightTab: () => void;
}

const DOCK_SPRING = { type: 'spring' as const, stiffness: 420, damping: 28 };

/**
 * Solid Matte Spatial Bottom Dock:
 * Separated left pill (Vasooli / Notes) + raised center Matte Royal Indigo Mic Orb + right pill (Bills / Activity).
 * Strictly zero floating right `+` FAB to prevent bottom-card overlap.
 */
export const BottomSpatialDock: React.FC<BottomSpatialDockProps> = ({
  mainTab,
  hasSecondaryRoute,
  voiceModalOpen,
  capabilities,
  onSelectLeftTab,
  onOpenVoice,
  onSelectRightTab,
}) => {
  const leftActive = !hasSecondaryRoute && mainTab === 'collection';
  const rightActive =
    mainTab === 'bills' ||
    mainTab === 'stock' ||
    mainTab === 'more' ||
    hasSecondaryRoute;

  const LeftIcon = capabilities.showGstBills ? Users : NotebookPen;
  const RightIcon = capabilities.showGstBills ? Receipt : Activity;

  return (
    <div className="no-print absolute bottom-0 inset-x-0 z-40 pb-safe pointer-events-none">
      <nav
        aria-label="Primary navigation"
        className="mx-4 mb-3.5 flex items-center justify-between gap-2.5"
      >
        {/* Left Separated Matte Pill */}
        <div className="pointer-events-auto flex-1 bg-[var(--surface)] rounded-full p-1 shadow-[var(--spatial-dock-shadow)]">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onSelectLeftTab();
            }}
            className={`relative w-full min-h-[46px] rounded-full flex items-center justify-center gap-1.5 px-3 text-xs font-extrabold whitespace-nowrap active:scale-95 transition-colors ${
              leftActive
                ? 'text-[var(--brand-accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {leftActive && (
              <motion.span
                layoutId="dockActiveTab"
                transition={DOCK_SPRING}
                className="absolute inset-0 rounded-full bg-[var(--brand-tint)]"
              />
            )}
            <LeftIcon className="w-[16px] h-[16px] relative z-10 shrink-0" />
            <span className="relative z-10 leading-none">{capabilities.leftDockLabel}</span>
          </button>
        </div>

        {/* Dead-Center Raised Matte Royal Indigo Mic Orb */}
        <div className="pointer-events-auto flex items-center justify-center -mt-4 relative z-20 shrink-0">
          <MunimVoiceOrb
            size="dock"
            listening={voiceModalOpen}
            onClick={onOpenVoice}
            ariaLabel="Open Bolne Wala Munim Voice Entry"
          />
        </div>

        {/* Right Separated Matte Pill */}
        <div className="pointer-events-auto flex-1 bg-[var(--surface)] rounded-full p-1 shadow-[var(--spatial-dock-shadow)]">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onSelectRightTab();
            }}
            className={`relative w-full min-h-[46px] rounded-full flex items-center justify-center gap-1.5 px-3 text-xs font-extrabold whitespace-nowrap active:scale-95 transition-colors ${
              rightActive
                ? 'text-[var(--brand-accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {rightActive && (
              <motion.span
                layoutId="dockActiveTab"
                transition={DOCK_SPRING}
                className="absolute inset-0 rounded-full bg-[var(--brand-tint)]"
              />
            )}
            <RightIcon className="w-[16px] h-[16px] relative z-10 shrink-0" />
            <span className="relative z-10 leading-none">{capabilities.rightDockLabel}</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
