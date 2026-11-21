'use client';

import React from 'react';
import { VoiceEntryModal } from '../VoiceEntryModal';
import type { PersonaAdaptation } from '@/lib/persona';
import type {
  AccountKind,
  BillLineItem,
  Business,
  LanguageCode,
  LedgerAccount,
  TxDirection,
} from '@/types';

export interface VoiceMunimSheetProps {
  open: boolean;
  language: LanguageCode;
  accounts: LedgerAccount[];
  stockNames?: string[];
  business: Business;
  prefillCustomerName?: string;
  defaultKind?: AccountKind;
  initialCounterMode?: boolean;
  personaAdaptation?: PersonaAdaptation;
  allowBills?: boolean;
  onClose: () => void;
  onOpenAccount: (account: LedgerAccount) => void;
  onOpenDailySummary: () => void;
  onSaveEntry: (entry: {
    customerName: string;
    direction: TxDirection;
    amount: number;
    note?: string;
    voiceRaw: string;
    kind: AccountKind;
  }) => Promise<{ txId?: string; accountId?: string } | void>;
  onUndoQueueItem?: (item: { txId: string; accountId: string }) => Promise<void>;
  onCreateBillFromVoice?: (draft: {
    customerName: string;
    paymentStatus: 'paid' | 'unpaid';
    items: BillLineItem[];
  }) => void;
}

/**
 * Spatial Aperture Iris Voice Capture Wrapper.
 * Strictly gates bill creation off when `allowBills` is false (Personal mode).
 */
export const VoiceMunimSheet: React.FC<VoiceMunimSheetProps> = ({
  allowBills = true,
  onCreateBillFromVoice,
  ...rest
}) => {
  return (
    <VoiceEntryModal
      {...rest}
      allowBills={allowBills}
      onCreateBillFromVoice={allowBills ? onCreateBillFromVoice : undefined}
    />
  );
};
