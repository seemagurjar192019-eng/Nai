'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Home, NotebookPen, Receipt, Settings, Users } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { MunimVoiceOrb } from '../voice/MunimVoiceOrb';
import type { PersonaCapabilities } from '@/lib/persona';

export type DockDestination = 'home' | 'bills' | 'overdue' | 'settings';

export interface BottomSpatialDockProps {
  activeDestination: DockDestination;
  voiceModalOpen: boolean;
  capabilities: PersonaCapabilities;
  onSelectHome: () => void;
  onSelectBills: () => void;
  onOpenVoice: () => void;
  onSelectOverdue: () => void;
  onSelectSettings: () => void;
}

const DOCK_SPRING = { type: 'spring' as const, stiffness: 440, damping: 28 };

/**
 * Ergonomic iOS 27 Floating Capsule Dock:
 * Left Capsule (`Home` + `Bills`/`Summary`) · Center Raised Matte Royal Indigo Voice Orb · Right Capsule (`Overdue`/`Notes` + `Settings`)
 */
export const BottomSpatialDock: React.FC<BottomSpatialDockProps> = ({
  activeDestination,
  voiceModalOpen,
  capabilities,
  onSelectHome,
  onSelectBills,
  onOpenVoice,
  onSelectOverdue,
  onSelectSettings,
}) => {
  const BillsIcon = capabilities.showGstBills ? Receipt : Activity;
  const OverdueIcon = capabilities.showGstBills ? Users : NotebookPen;

  const renderDockButton = (params: {
    id: DockDestination;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }) => {
    const active = activeDestination === params.id;
    const Icon = params.icon;
    return (
      <button
        key={params.id}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          haptics.tap();
          params.onClick();
        }}
        className={`relative flex-1 min-w-0 min-h-[46px] rounded-full flex flex-col items-center justify-center gap-0.5 px-0.5 text-[9.5px] sm:text-[10px] font-extrabold whitespace-nowrap active:scale-95 transition-colors ${
          active
            ? 'text-[var(--brand-accent)]'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
      >
        {active && (
          <motion.span
            layoutId="dockActiveTab"
            transition={DOCK_SPRING}
            className="absolute inset-0 rounded-full bg-[var(--brand-tint)]"
          />
        )}
        <motion.span
          animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
          transition={DOCK_SPRING}
          className="relative z-10 inline-flex items-center justify-center shrink-0"
        >
          <Icon className="w-4 h-4 shrink-0" />
        </motion.span>
        <span className="relative z-10 leading-none truncate max-w-full tracking-tight">{params.label}</span>
      </button>
    );
  };

  return (
    <div className="no-print absolute bottom-0 inset-x-0 z-40 pb-safe pointer-events-none flex justify-center">
      <nav
        aria-label="Primary navigation"
        className="w-full max-w-[430px] mx-2.5 mb-2 flex items-center justify-between gap-1.5"
      >
        {/* Left Floating Capsule: Home + Ledger */}
        <div className="pointer-events-auto flex-1 min-w-0 bg-[var(--surface)] border border-[var(--surface-border)] rounded-full p-1 shadow-[var(--spatial-dock-shadow)] flex items-center gap-0.5">
          {renderDockButton({
            id: 'home',
            label: 'Home',
            icon: Home,
            onClick: onSelectHome,
          })}
          {renderDockButton({
            id: 'bills',
            label: 'Ledger',
            icon: BillsIcon,
            onClick: onSelectBills,
          })}
        </div>

        {/* Center Raised Matte Royal Indigo Voice Orb */}
        <div className="pointer-events-auto flex items-center justify-center -mt-3.5 relative z-20 shrink-0">
          <MunimVoiceOrb
            size="dock"
            listening={voiceModalOpen}
            onClick={onOpenVoice}
            ariaLabel="Open Voice Munim Transaction Entry"
          />
        </div>

        {/* Right Floating Capsule: Contacts + More */}
        <div className="pointer-events-auto flex-1 min-w-0 bg-[var(--surface)] border border-[var(--surface-border)] rounded-full p-1 shadow-[var(--spatial-dock-shadow)] flex items-center gap-0.5">
          {renderDockButton({
            id: 'overdue',
            label: 'Contacts',
            icon: OverdueIcon,
            onClick: onSelectOverdue,
          })}
          {renderDockButton({
            id: 'settings',
            label: 'More',
            icon: Settings,
            onClick: onSelectSettings,
          })}
        </div>
      </nav>
    </div>
  );
};
