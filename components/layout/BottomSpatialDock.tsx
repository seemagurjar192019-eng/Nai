'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Home, NotebookPen, Receipt, Settings, Users } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { MunimVoiceOrb } from '../voice/MunimVoiceOrb';
import {
  SNAPPY_SPRING,
  SPATIAL_SPRING,
  getChromeGlideTransition,
} from '../motion/SpatialMotionEngine';
import type { PersonaCapabilities } from '@/lib/persona';

export type DockDestination = 'home' | 'bills' | 'overdue' | 'settings';

export interface BottomSpatialDockProps {
  activeDestination: DockDestination;
  voiceModalOpen: boolean;
  isDockVisible?: boolean;
  capabilities: PersonaCapabilities;
  onSelectHome: () => void;
  onSelectBills: () => void;
  onOpenVoice: () => void;
  onSelectOverdue: () => void;
  onSelectSettings: () => void;
}

/**
 * Unified 5-Destination Liquid Glass Floating Capsule Dock (Jacob's Law + Apple HIG):
 * Home · Ledger · Centered Raised Voice Orb · Contacts · More
 * Smoothly glides down on downward scroll and glides back on upward scroll.
 */
export const BottomSpatialDock: React.FC<BottomSpatialDockProps> = ({
  activeDestination,
  voiceModalOpen,
  isDockVisible = true,
  capabilities,
  onSelectHome,
  onSelectBills,
  onOpenVoice,
  onSelectOverdue,
  onSelectSettings,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const BillsIcon = capabilities.showGstBills ? Receipt : Activity;
  const OverdueIcon = capabilities.showGstBills ? Users : NotebookPen;
  const effectiveDockVisible = isDockVisible || voiceModalOpen;

  const renderDockButton = (params: {
    id: DockDestination;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }) => {
    const active = activeDestination === params.id;
    const Icon = params.icon;

    return (
      <motion.button
        key={params.id}
        type="button"
        aria-current={active ? 'page' : undefined}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        transition={SNAPPY_SPRING}
        onClick={() => {
          haptics.select();
          params.onClick();
        }}
        className={`relative flex-1 min-w-0 min-h-[48px] rounded-full flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] whitespace-nowrap transition-colors ${
          active
            ? 'font-semibold text-[var(--ink)]'
            : 'font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
      >
        {active && (
          <motion.span
            layoutId={prefersReducedMotion ? undefined : 'dockActiveTab'}
            transition={SPATIAL_SPRING}
            className="absolute inset-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--glass-border)]"
          />
        )}
        <motion.span
          animate={prefersReducedMotion ? undefined : { scale: active ? 1.05 : 1, y: active ? -0.5 : 0 }}
          transition={SPATIAL_SPRING}
          className="relative z-10 inline-flex items-center justify-center shrink-0"
        >
          <Icon className="w-[19px] h-[19px] shrink-0 stroke-[1.9]" />
        </motion.span>
        <span className="relative z-10 leading-none truncate max-w-full tracking-tight">
          {params.label}
        </span>
      </motion.button>
    );
  };

  return (
    <motion.div
      initial={false}
      animate={
        prefersReducedMotion
          ? { opacity: effectiveDockVisible ? 1 : 0 }
          : { y: effectiveDockVisible ? 0 : 124, opacity: effectiveDockVisible ? 1 : 0 }
      }
      transition={getChromeGlideTransition(effectiveDockVisible)}
      aria-hidden={!effectiveDockVisible}
      className="no-print absolute bottom-0 inset-x-0 z-40 pb-safe pointer-events-none flex justify-center bg-gradient-to-t from-[var(--app-bg)]/90 via-[var(--app-bg)]/35 to-transparent pt-3 will-change-transform"
    >
      <nav
        aria-label="Primary navigation"
        className={`${
          effectiveDockVisible ? 'pointer-events-auto' : 'pointer-events-none'
        } w-full max-w-[420px] mx-3 mb-2 spatial-dock rounded-full px-2 py-1.5 flex items-center justify-between gap-1`}
      >
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

        {/* Centered Elevated Voice Munim Orb */}
        <div className="flex items-center justify-center -mt-5 px-1 relative z-20 shrink-0">
          <MunimVoiceOrb
            size="dock"
            listening={voiceModalOpen}
            onClick={onOpenVoice}
            ariaLabel="Open Voice Munim Transaction Entry"
          />
        </div>

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
      </nav>
    </motion.div>
  );
};
