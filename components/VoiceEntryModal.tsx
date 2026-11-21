'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Edit3,
  FileText,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import {
  amountToHinglishWords,
  parseVoiceCommand,
  type ParsedHinglishEntry,
} from '@/lib/bolbahi-parser';
import { SmartEntrySavedStage } from './SmartEntrySavedStage';
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  formatINR,
  getUIStrings,
  speakHinglish,
  stopSpeaking,
} from '@/lib/i18n';
import { haptic } from '@/lib/haptic';
import { getPersonaAdaptation, type PersonaAdaptation } from '@/lib/persona';
import type {
  AccountKind,
  BillLineItem,
  Business,
  HybridVoiceParseResult,
  LanguageCode,
  LedgerAccount,
  TxDirection,
} from '@/lib/types';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SessionQueueSavedItem {
  id: string;
  customerName: string;
  direction: TxDirection;
  amount: number;
  txId?: string;
  accountId?: string;
}

interface VoiceEntryModalProps {
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

interface BatchItemState extends ParsedHinglishEntry {
  selected: boolean;
  direction: TxDirection;
}

const SPRING_FAST = { type: 'spring' as const, stiffness: 420, damping: 28 };
const SPRING_SHEET = { type: 'spring' as const, stiffness: 360, damping: 32 };

// Deterministic 22-bar vertical waveform profile (zero Math.random during render)
const WAVEFORM_HEIGHTS = [
  10, 16, 24, 14, 28, 34, 20, 38, 26, 42, 30, 44, 28, 36, 22, 34, 18, 28, 24, 16, 20, 12,
] as const;

function Waveform22Bars({
  active,
  aiParsing,
}: {
  active: boolean;
  aiParsing: boolean;
}) {
  return (
    <div
      aria-label={active ? 'Live audio waveform' : 'Paused waveform'}
      className="flex items-center justify-center gap-[3px] h-11 px-2 flex-1"
    >
      {WAVEFORM_HEIGHTS.map((peak, i) => (
        <motion.span
          key={i}
          animate={
            active || aiParsing
              ? {
                  height: [6, peak, Math.max(8, Math.round(peak * 0.45)), peak * 0.85, 6],
                  opacity: [0.65, 1, 0.75, 0.95, 0.65],
                }
              : {
                  height: 6,
                  opacity: 0.35,
                }
          }
          transition={
            active || aiParsing
              ? {
                  duration: aiParsing ? 0.65 : 0.95 + (i % 4) * 0.14,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                  delay: (i % 7) * 0.07,
                }
              : { duration: 0.25 }
          }
          style={{ background: 'var(--munim-gradient)' }}
          className="w-[3px] rounded-full block"
        />
      ))}
    </div>
  );
}

export const VoiceEntryModal: React.FC<VoiceEntryModalProps> = ({
  open,
  language,
  accounts,
  stockNames = [],
  business,
  prefillCustomerName = '',
  defaultKind = 'customer',
  initialCounterMode = false,
  personaAdaptation,
  allowBills = true,
  onClose,
  onOpenAccount,
  onOpenDailySummary,
  onSaveEntry,
  onUndoQueueItem,
  onCreateBillFromVoice,
}) => {
  const t = getUIStrings(language);
  const activeAdaptation = useMemo(
    () => personaAdaptation || getPersonaAdaptation(['kirana'], 'kirana'),
    [personaAdaptation]
  );
  const [stage, setStage] = useState<'listen' | 'confirm' | 'batch' | 'bill' | 'balance' | 'saved'>('listen');
  const [continuousMode, setContinuousMode] = useState(initialCounterMode);
  const [sessionQueue, setSessionQueue] = useState<SessionQueueSavedItem[]>([]);
  const [listening, setListening] = useState(false);
  const [statusText, setStatusText] = useState('Starting microphone...');
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [parseSource, setParseSource] = useState<'local' | 'ai'>('local');

  // Single Inline-Editable Confirm fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [direction, setDirection] = useState<TxDirection>('given');
  const [note, setNote] = useState('');
  const [rawPhrase, setRawPhrase] = useState('');
  const [micDenied, setMicDenied] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'amount' | 'type' | 'note' | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    partyName: string;
    previousBalance: number;
    newBalance: number;
    amount: number;
    direction: TxDirection;
  } | null>(null);

  // Multi-entry batch fields
  const [batchItems, setBatchItems] = useState<BatchItemState[]>([]);

  // Voice bill fields
  const [voiceBillCustomer, setVoiceBillCustomer] = useState('');
  const [voiceBillStatus, setVoiceBillStatus] = useState<'paid' | 'unpaid'>('paid');
  const [voiceBillItems, setVoiceBillItems] = useState<BillLineItem[]>([]);

  // Balance query state
  const [queriedName, setQueriedName] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const appliedThisListenRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedSigRef = useRef<{ sig: string; at: number } | null>(null);

  const stopMic = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        // Ignore stop errors
      }
    }
  };

  // Live instant offline preview of whatever speech or typed text is streaming
  const liveStreamPreview = useMemo(() => {
    const activePhrase = (transcript || manualText).trim();
    if (!activePhrase) return null;
    const cmd = parseVoiceCommand(activePhrase);
    if (cmd.intent === 'entries' && cmd.entries.length > 0) {
      return cmd.entries;
    }
    return null;
  }, [transcript, manualText]);

  const matchedAccount = useMemo(() => {
    const clean = (stage === 'balance' ? queriedName : name).trim().toLowerCase();
    if (!clean) return null;
    return (
      accounts.find((a) => a.name.toLowerCase() === clean) ||
      accounts.find((a) => a.name.toLowerCase().includes(clean)) ||
      null
    );
  }, [accounts, name, queriedName, stage]);

  const willExceedLimit = useMemo(() => {
    if (!matchedAccount || !matchedAccount.creditLimit || matchedAccount.creditLimit <= 0) {
      return null;
    }
    if (direction !== 'given') return null;
    const projected = matchedAccount.balance + amount;
    if (projected > matchedAccount.creditLimit) {
      return {
        limit: matchedAccount.creditLimit,
        projected,
        excess: Math.round((projected - matchedAccount.creditLimit) * 100) / 100,
      };
    }
    return null;
  }, [matchedAccount, direction, amount]);

  const queueTotal = useMemo(
    () => sessionQueue.reduce((sum, item) => sum + item.amount, 0),
    [sessionQueue]
  );

  const applyAiFallback = async (phrase: string) => {
    setAiParsing(true);
    setVoiceError('');
    setConfirmError('');
    try {
      const res = await fetch('/api/ucred/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: phrase,
          partyNames: accounts.map((a) => a.name).slice(0, 35),
          stockNames: stockNames.slice(0, 35),
          language,
        }),
      });
      const json = (await res.json()) as Partial<HybridVoiceParseResult> & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Smart AI voice parse failed.');
      }

      setParseSource('ai');

      if (json.intent === 'daily_summary') {
        stopSpeaking();
        onClose();
        onOpenDailySummary();
        return;
      }

      if (json.intent === 'balance_query') {
        const targetName = json.customerName || prefillCustomerName || '';
        const found =
          accounts.find((a) => a.name.toLowerCase() === targetName.toLowerCase()) ||
          accounts.find((a) =>
            targetName ? a.name.toLowerCase().includes(targetName.toLowerCase()) : false
          ) ||
          null;
        setQueriedName(found?.name || targetName);
        setRawPhrase(phrase);
        setStage('balance');
        return;
      }

      if (
        allowBills &&
        onCreateBillFromVoice &&
        json.intent === 'bill' &&
        Array.isArray(json.billItems) &&
        json.billItems.length > 0
      ) {
        setVoiceBillCustomer(json.customerName || prefillCustomerName || 'Walk-in Customer');
        setVoiceBillStatus(json.paymentStatus === 'paid' ? 'paid' : 'unpaid');
        setVoiceBillItems(json.billItems);
        setRawPhrase(phrase);
        setStage('bill');
        speakHinglish(
          `${json.customerName || 'Customer'} ke ${json.billItems.length} items ka bill taiyaar hai.`,
          language
        );
        return;
      }

      const aiEntries = Array.isArray(json.entries) ? json.entries : [];
      if (aiEntries.length > 1) {
        setBatchItems(
          aiEntries.map((entry) => ({
            name: entry.name,
            amount: entry.amount,
            type: entry.type,
            note: entry.note,
            raw: phrase,
            selected: entry.amount > 0 && Boolean(entry.name),
            direction: entry.type === 'debit' ? 'received' : 'given',
          }))
        );
        setRawPhrase(phrase);
        setConfirmError('');
        setStage('batch');
        speakHinglish(`${aiEntries.length} entries AI se samajh aayi hain.`, language);
        return;
      }

      const first = aiEntries[0];
      if (first) {
        const resolvedName = first.name || prefillCustomerName || 'Customer';
        const resolvedDir: TxDirection = first.type === 'debit' ? 'received' : 'given';
        setName(resolvedName);
        setAmount(first.amount);
        setDirection(resolvedDir);
        setNote(first.note || '');
        setRawPhrase(phrase);
        setActiveField(first.amount <= 0 ? 'amount' : !first.name ? 'name' : null);
        setStage('confirm');
        const words = first.amount > 0 ? amountToHinglishWords(first.amount) : 'shunya';
        speakHinglish(
          `${resolvedName}, ${words} rupaye, ${resolvedDir === 'given' ? 'Udhaar' : 'Mila'}. Sahi hai?`,
          language
        );
        return;
      }

      setVoiceError('AI could not extract an amount from that speech. Tap any field below to edit.');
      setStage('confirm');
      setActiveField('amount');
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : 'Smart AI parse failed. Tap any field below to edit.'
      );
      setStage('confirm');
      setActiveField('amount');
    } finally {
      setAiParsing(false);
    }
  };

  const applyTranscriptToConfirm = (phrase: string) => {
    stopMic();
    setParseSource('local');
    const cmd = parseVoiceCommand(phrase);

    const looksLikeSpokenBill =
      /\b(bill|invoice|parchi|bana\s*do|banao|ka\s+bill)\b/i.test(phrase) &&
      (phrase.match(/\d+/g)?.length || 0) >= 2;

    if (allowBills && looksLikeSpokenBill && onCreateBillFromVoice) {
      void applyAiFallback(phrase);
      return;
    }

    if (cmd.intent === 'daily_summary') {
      stopSpeaking();
      onClose();
      onOpenDailySummary();
      return;
    }

    if (cmd.intent === 'balance_query') {
      const targetName = cmd.customerName || prefillCustomerName || '';
      const found =
        accounts.find((a) => a.name.toLowerCase() === targetName.toLowerCase()) ||
        accounts.find((a) =>
          targetName ? a.name.toLowerCase().includes(targetName.toLowerCase()) : false
        ) ||
        null;
      setQueriedName(found?.name || targetName);
      setRawPhrase(phrase);
      setStage('balance');
      if (found) {
        const absBal = Math.round(Math.abs(found.balance));
        const words = amountToHinglishWords(absBal);
        const statusSpoken =
          found.balance > 0
            ? 'udhaar baaki hai'
            : found.balance < 0
              ? 'advance jama hai'
              : 'hisaab barabar hai';
        speakHinglish(`${found.name} ka ${words} rupaye ${statusSpoken}.`, language);
      } else {
        speakHinglish(`${targetName || 'Customer'} ka khata nahi mila.`, language);
      }
      return;
    }

    if (cmd.entries.length > 1) {
      setBatchItems(
        cmd.entries.map((entry) => ({
          ...entry,
          selected: entry.amount > 0 && Boolean(entry.name),
          direction: entry.type === 'debit' ? 'received' : 'given',
        }))
      );
      setRawPhrase(phrase);
      setConfirmError('');
      setStage('batch');
      speakHinglish(`${cmd.entries.length} entries mili hain. Check karke save karein.`, language);
      return;
    }

    const parsed = cmd.entries[0] || { name: '', amount: 0, type: 'credit' as const, raw: phrase };

    if ((parsed.amount <= 0 || !parsed.name) && phrase.trim().length > 3) {
      setName(parsed.name || prefillCustomerName || '');
      setAmount(parsed.amount);
      setRawPhrase(phrase);
      void applyAiFallback(phrase);
      return;
    }

    const resolvedName = parsed.name || prefillCustomerName || 'Customer';
    const resolvedDir: TxDirection = parsed.type === 'debit' ? 'received' : 'given';
    setName(resolvedName);
    setAmount(parsed.amount);
    setDirection(resolvedDir);
    setNote(parsed.note || '');
    setRawPhrase(phrase);
    setActiveField(parsed.amount <= 0 ? 'amount' : !parsed.name ? 'name' : null);
    setConfirmError('');
    setStage('confirm');

    const typeWord = resolvedDir === 'given' ? 'Udhaar' : 'Mila';
    const words = parsed.amount > 0 ? amountToHinglishWords(parsed.amount) : 'shunya';
    speakHinglish(`${resolvedName}, ${words} rupaye, ${typeWord}. Sahi hai?`, language);
  };

  const startMic = () => {
    setVoiceError('');
    setMicDenied(false);
    finalTranscriptRef.current = '';
    appliedThisListenRef.current = false;
    setTranscript('');

    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SR) {
      setListening(false);
      setStatusText('Voice recognition paused · type or tap a sample');
      setVoiceError('Live mic unavailable on this browser. Type Hinglish or tap a sample below.');
      setTimeout(() => manualInputRef.current?.focus(), 60);
      return;
    }

    try {
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setListening(true);
        setStatusText('Listening... speak clearly');
      };

      rec.onresult = (ev) => {
        let interim = '';
        let finalText = '';
        for (let i = 0; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript + ' ';
          } else {
            interim += res[0].transcript;
          }
        }
        const combined = (finalText || interim).trim();
        finalTranscriptRef.current = combined;
        setTranscript(combined);
      };

      rec.onerror = (ev) => {
        setListening(false);
        setStatusText('Microphone paused');
        if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
          setMicDenied(true);
          setVoiceError('Microphone permission is blocked in browser settings.');
          setTimeout(() => manualInputRef.current?.focus(), 60);
        } else if (ev?.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
          setVoiceError(`Speech error: ${ev.error}. You can type manually below.`);
        }
      };

      rec.onend = () => {
        setListening(false);
        const text = finalTranscriptRef.current.trim();
        if (text && !appliedThisListenRef.current) {
          appliedThisListenRef.current = true;
          applyTranscriptToConfirm(text);
        } else if (!text) {
          setStatusText('Paused · tap Play to speak or type below');
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setListening(false);
      setStatusText('Could not start microphone');
      setVoiceError('Use the manual phrase input below.');
      setTimeout(() => manualInputRef.current?.focus(), 60);
    }
  };

  useEffect(() => {
    if (!open) {
      stopSpeaking();
      return () => stopMic();
    }
    const timer = setTimeout(() => {
      setContinuousMode(initialCounterMode);
      setStage('listen');
      setSessionQueue([]);
      setManualText('');
      setNote('');
      setActiveField(null);
      setMicDenied(false);
      setVoiceError('');
      setConfirmError('');
      startMic();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      stopMic();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCounterMode]);

  const handleSave = async (keepGoing: boolean) => {
    setConfirmError('');
    if (!name.trim()) {
      setConfirmError('Customer name is required.');
      setActiveField('name');
      return;
    }
    if (!amount || amount <= 0) {
      setConfirmError('Amount must be greater than zero.');
      setActiveField('amount');
      return;
    }
    const sig = `${name.trim().toLowerCase()}|${direction}|${amount}|${rawPhrase.trim()}`;
    if (
      lastSavedSigRef.current &&
      lastSavedSigRef.current.sig === sig &&
      Date.now() - lastSavedSigRef.current.at < 3000
    ) {
      setConfirmError('Duplicate entry ignored — already saved just now.');
      return;
    }

    const prevBal = matchedAccount?.balance ?? 0;
    const signedDelta = direction === 'given' ? amount : -amount;
    setSavedSnapshot({
      partyName: name.trim(),
      previousBalance: prevBal,
      newBalance: prevBal + signedDelta,
      amount,
      direction,
    });

    setSaving(true);
    try {
      const savedMeta = await onSaveEntry({
        customerName: name.trim(),
        direction,
        amount,
        note: note.trim() || undefined,
        voiceRaw: rawPhrase,
        kind: defaultKind,
      });
      lastSavedSigRef.current = { sig, at: Date.now() };
      haptic.success();
      setSaving(false);

      const qItem: SessionQueueSavedItem = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customerName: name.trim(),
        direction,
        amount,
        txId: savedMeta && typeof savedMeta === 'object' ? savedMeta.txId : undefined,
        accountId: savedMeta && typeof savedMeta === 'object' ? savedMeta.accountId : undefined,
      };

      if (keepGoing || continuousMode) {
        setSessionQueue((prev) => [qItem, ...prev]);
        setManualText('');
        setNote('');
        setTranscript('');
        setActiveField(null);
        setStage('listen');
        speakHinglish('Save ho gaya. Agla boliye.', language);
        setTimeout(() => startMic(), 350);
        return;
      }

      setStage('saved');
      setTimeout(() => {
        onClose();
      }, 1150);
    } catch (err) {
      setSaving(false);
      setConfirmError(err instanceof Error ? err.message : 'Failed to save entry.');
    }
  };

  const handleSaveBatch = async () => {
    const valid = batchItems.filter((it) => it.selected && it.name.trim() && it.amount > 0);
    if (valid.length === 0) {
      setConfirmError('Select at least one valid entry.');
      return;
    }
    const batchTotal = valid.reduce((s, it) => s + it.amount, 0);
    const batchNetDelta = valid.reduce(
      (s, it) => s + (it.direction === 'given' ? it.amount : -it.amount),
      0
    );
    setSavedSnapshot({
      partyName: `${valid.length} Parties`,
      previousBalance: 0,
      newBalance: batchNetDelta,
      amount: batchTotal,
      direction: batchNetDelta >= 0 ? 'given' : 'received',
    });
    setSaving(true);
    setConfirmError('');
    try {
      for (const item of valid) {
        const meta = await onSaveEntry({
          customerName: item.name.trim(),
          direction: item.direction,
          amount: item.amount,
          note: item.note,
          voiceRaw: item.raw || rawPhrase,
          kind: defaultKind,
        });
        setSessionQueue((prev) => [
          {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            customerName: item.name.trim(),
            direction: item.direction,
            amount: item.amount,
            txId: meta && typeof meta === 'object' ? meta.txId : undefined,
            accountId: meta && typeof meta === 'object' ? meta.accountId : undefined,
          },
          ...prev,
        ]);
      }
      setSaving(false);
      if (continuousMode) {
        setManualText('');
        setTranscript('');
        setStage('listen');
        speakHinglish('Sab save ho gaya. Agla boliye.', language);
        setTimeout(() => startMic(), 350);
        return;
      }
      setStage('saved');
      setTimeout(() => {
        onClose();
      }, 1150);
    } catch (err) {
      setSaving(false);
      setConfirmError(err instanceof Error ? err.message : 'Failed to save batch entries.');
    }
  };

  const handleBottomSaveAction = () => {
    const activePhrase = (transcript || manualText).trim();
    if (activePhrase) {
      applyTranscriptToConfirm(activePhrase);
      return;
    }
    if (sessionQueue.length > 0) {
      onClose();
      return;
    }
    manualInputRef.current?.focus();
  };

  const readbackType = direction === 'given' ? 'Udhaar' : 'Mila';
  const readbackText = `${name || 'Customer'}, ${Math.round(amount)} rupaye, ${readbackType}. Sahi hai?`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="voice-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Voice Khata and Counter Entry"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={() => {
            if (!saving) onClose();
          }}
          className={`fixed inset-0 z-50 bg-black/45 flex justify-center ${
            stage === 'confirm' || stage === 'saved' ? 'items-center p-4' : 'items-end'
          }`}
        >
          <motion.div
            key="voice-modal-sheet"
            initial={
              stage === 'confirm'
                ? { opacity: 0, scale: 0.94, y: 16 }
                : { clipPath: 'circle(24px at 50% 92%)', opacity: 0.72, scale: 0.96 }
            }
            animate={
              stage === 'confirm'
                ? { opacity: 1, scale: 1, y: 0 }
                : { clipPath: 'circle(150% at 50% 50%)', opacity: 1, scale: 1 }
            }
            exit={
              stage === 'saved'
                ? {
                    opacity: 0,
                    scale: 0.35,
                    y: 110,
                    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                  }
                : {
                    clipPath: 'circle(24px at 50% 92%)',
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                  }
            }
            transition={SPRING_SHEET}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full bg-[var(--surface)] space-y-4 max-h-[90dvh] overflow-y-auto no-scrollbar overflow-hidden ${
              stage === 'confirm' || stage === 'saved'
                ? 'p-5 max-w-[385px] rounded-[28px] shadow-[0_20px_50px_rgba(17,24,39,0.22)]'
                : 'px-6 pt-4 pb-6 max-w-[430px] rounded-t-[32px] spatial-sheet pb-safe'
            }`}
          >

            <div className="w-10 h-1.5 rounded-full bg-[var(--surface-subtle)] mx-auto" />

            {stage === 'listen' && (
              <div className="relative z-10 flex flex-col gap-3.5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      style={{ background: 'var(--munim-gradient)' }}
                      className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0"
                    >
                      <Mic className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-extrabold text-[var(--ink)] truncate">
                        {continuousMode ? 'Hands-Free Counter Mode' : 'Bolne Wala Munim'}
                      </h2>
                      <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                        {aiParsing ? 'Smart AI parsing your speech...' : statusText}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close voice entry"
                    className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Hands-Free Counter Mode Toggle Pill */}
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--app-bg)] px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() => setContinuousMode((v) => !v)}
                    className="flex items-center gap-2 text-xs font-bold text-[var(--ink)] min-h-[38px] active:scale-95 transition"
                  >
                    <Repeat
                      className={`w-4 h-4 ${
                        continuousMode ? 'text-[var(--brand-accent)]' : 'text-[var(--ink-muted)]'
                      }`}
                    />
                    <span>Hands-Free Counter Queue: {continuousMode ? 'ON' : 'OFF'}</span>
                  </button>
                  {sessionQueue.length > 0 && (
                    <span className="text-xs font-extrabold font-tabular text-[var(--brand-accent)]">
                      {sessionQueue.length} saved · {formatINR(queueTotal)}
                    </span>
                  )}
                </div>

                {/* Top-Stacking Live Streaming Cards (Superlist Capture Feel) */}
                <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                  {aiParsing && (
                    <div className="rounded-[22px] bg-[var(--surface)] shadow-[var(--spatial-shadow)] p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-3.5 w-28 rounded-full spatial-shimmer" />
                        <div className="h-5 w-20 rounded-full spatial-shimmer" />
                      </div>
                      <div className="h-3 w-48 rounded-full spatial-shimmer" />
                    </div>
                  )}

                  {/* Live streaming parsed preview card while user speaks or types */}
                  {liveStreamPreview ? (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={SPRING_FAST}
                      className="space-y-2"
                    >
                      {liveStreamPreview.map((entry, idx) => (
                        <div
                          key={`${entry.name}_${idx}`}
                          className="rounded-[22px] bg-[var(--surface)] shadow-[var(--spatial-shadow)] ring-2 ring-[var(--brand)] p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                              <Sparkles className="w-3 h-3" />
                              <span>Live Draft</span>
                            </span>
                            <p className="text-sm font-extrabold text-[var(--ink)] truncate">
                              {entry.name || prefillCustomerName || 'Customer'}
                            </p>
                            {entry.note && (
                              <p className="text-[11px] text-[var(--ink-muted)] truncate">
                                {entry.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`font-display text-lg font-extrabold font-tabular ${
                                entry.type === 'debit'
                                  ? 'text-[var(--debit-green)]'
                                  : 'text-[var(--credit-red)]'
                              }`}
                            >
                              {entry.amount > 0 ? formatINR(entry.amount) : '₹...'}
                            </p>
                            <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                              {entry.type === 'debit' ? 'Received (Mila)' : 'Given (Udhaar)'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <div className="rounded-[22px] bg-[var(--app-bg)] p-4 min-h-[68px] flex items-center justify-center text-center">
                      <p className="text-sm font-bold text-[var(--ink)] leading-relaxed">
                        {transcript ||
                          (allowBills
                            ? 'Speak entry, multi-item bill, balance check, or "Aaj ka hisaab"...'
                            : 'Speak entry, friend balance check, or "Aaj ka hisaab"...')}
                      </p>
                    </div>
                  )}

                  {/* Saved Session Queue Cards */}
                  {sessionQueue.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={SPRING_FAST}
                      className="flex items-center justify-between gap-2 text-xs bg-[var(--surface)] shadow-[var(--spatial-shadow)] rounded-[20px] px-3.5 py-2.5"
                    >
                      <span className="font-extrabold text-[var(--ink)] truncate">
                        {item.customerName} · {item.direction === 'given' ? 'Udhaar' : 'Mila'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-extrabold font-tabular ${
                            item.direction === 'given'
                              ? 'text-[var(--credit-red)]'
                              : 'text-[var(--debit-green)]'
                          }`}
                        >
                          {formatINR(item.amount)}
                        </span>
                        {onUndoQueueItem && item.txId && item.accountId && (
                          <button
                            type="button"
                            disabled={undoingId === item.id}
                            onClick={async () => {
                              if (!item.txId || !item.accountId) return;
                              setUndoingId(item.id);
                              try {
                                await onUndoQueueItem({ txId: item.txId, accountId: item.accountId });
                                setSessionQueue((prev) => prev.filter((q) => q.id !== item.id));
                              } finally {
                                setUndoingId(null);
                              }
                            }}
                            aria-label={`Undo ${item.customerName}`}
                            className="text-[11px] font-bold text-[var(--alert-amber)] hover:underline inline-flex items-center gap-0.5 active:scale-95 transition"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>{undoingId === item.id ? '...' : 'Undo'}</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {voiceError && (
                  <div className="text-xs font-semibold text-[var(--alert-amber)] bg-[var(--alert-tint)] rounded-2xl px-3.5 py-2.5 space-y-1.5">
                    <p>{voiceError}</p>
                    {micDenied && (
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] font-medium">
                        <span>
                          Tap Lock / Site Settings in browser bar → Permissions → Allow Microphone.
                        </span>
                        <button
                          type="button"
                          onClick={startMic}
                          className="min-h-[34px] px-3 py-1 rounded-xl bg-[var(--alert-amber)] text-white font-bold active:scale-95 transition"
                        >
                          Retry Mic
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Typing + Sample Quick-Tap Strip */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      ref={manualInputRef}
                      id="voice-manual-input"
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualText.trim()) {
                          applyTranscriptToConfirm(manualText.trim());
                        }
                      }}
                      placeholder={
                        prefillCustomerName
                          ? `${prefillCustomerName} paanch sau udhaar`
                          : activeAdaptation.voicePlaceholder
                      }
                      className="flex-1 min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-medium text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                    />
                    <button
                      type="button"
                      disabled={aiParsing || !manualText.trim()}
                      onClick={() => {
                        haptic.tap();
                        if (manualText.trim()) applyTranscriptToConfirm(manualText.trim());
                      }}
                      className="min-h-[46px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-[var(--brand-fg)] font-extrabold text-sm whitespace-nowrap shadow-sm active:scale-95 transition"
                    >
                      Next
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {activeAdaptation.voiceSamples.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          haptic.tap();
                          applyTranscriptToConfirm(sample);
                        }}
                        className="min-h-[36px] px-3 rounded-xl bg-[var(--app-bg)] text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--brand-accent)] whitespace-nowrap shrink-0 active:scale-95 transition"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clean 3-Button Solid Bottom Bar: Pause/Resume (||) | 22-Bar Waveform | Save (✓) */}
                <div className="mt-1 rounded-full bg-[var(--surface-subtle)] shadow-md p-2 flex items-center justify-between gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={aiParsing}
                    onClick={() => {
                      haptic.tap();
                      if (listening) stopMic();
                      else startMic();
                    }}
                    aria-label={listening ? 'Pause voice capture' : 'Resume voice capture'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition ${
                      listening
                        ? 'bg-[var(--brand-tint)] text-[var(--brand-accent)]'
                        : 'bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    {listening ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </motion.button>

                  <Waveform22Bars active={listening} aiParsing={aiParsing} />

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={aiParsing}
                    onClick={() => {
                      haptic.tap();
                      handleBottomSaveAction();
                    }}
                    aria-label="Parse and save voice entry"
                    style={{ background: 'var(--munim-gradient)' }}
                    className="tactile-key-primary w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0 disabled:opacity-60"
                  >
                    <Check className="w-5 h-5 stroke-[2.75]" />
                  </motion.button>
                </div>

                <p className="text-[10px] font-medium text-center text-[var(--ink-muted)]">
                  Mic listens only while this drawer is open — zero background audio stored.
                </p>
              </div>
            )}

            {stage === 'confirm' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
                      Confirm Voice Entry
                    </h2>
                    <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                      {parseSource === 'ai' ? 'Hybrid Gemini AI' : 'Instant Offline Parser'} · Tap any
                      row to edit
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rawPhrase && parseSource !== 'ai' && (
                      <button
                        type="button"
                        disabled={aiParsing}
                        onClick={() => applyAiFallback(rawPhrase)}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold active:scale-95 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{aiParsing ? 'Parsing...' : 'AI Parse'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close voice confirm"
                      className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {aiParsing && (
                  <div className="rounded-[22px] bg-[var(--app-bg)] p-4 space-y-2.5">
                    <div className="h-3.5 w-32 rounded-full spatial-shimmer" />
                    <div className="h-3 w-48 rounded-full spatial-shimmer" />
                  </div>
                )}

                <div className="rounded-2xl bg-[var(--app-bg)] p-3.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-[var(--ink)] leading-snug">
                    {readbackText}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      speakHinglish(
                        `${name}, ${amountToHinglishWords(amount)} rupaye, ${readbackType}. Sahi hai?`,
                        language
                      )
                    }
                    className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl spatial-card text-xs font-extrabold text-[var(--brand-accent)] active:scale-95 transition"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Listen</span>
                  </button>
                </div>

                {willExceedLimit && (
                  <div className="rounded-2xl bg-[var(--alert-tint)] p-3.5 flex items-start gap-2.5 text-[var(--alert-amber)]">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs font-semibold">
                      <p className="font-extrabold">Credit Limit Alert for {matchedAccount?.name}</p>
                      <p className="font-tabular mt-0.5">
                        New balance {formatINR(willExceedLimit.projected)} exceeds limit{' '}
                        {formatINR(willExceedLimit.limit)} by {formatINR(willExceedLimit.excess)}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Single Clean Inline-Editable Receipt Summary Card */}
                <div className="rounded-[24px] bg-[var(--app-bg)] divide-y divide-[var(--surface-subtle)] overflow-hidden">
                  <div
                    onClick={() => setActiveField('name')}
                    className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] shrink-0">
                      Name
                    </span>
                    {activeField === 'name' ? (
                      <input
                        type="text"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => setActiveField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setActiveField(null);
                        }}
                        className="flex-1 text-right bg-[var(--surface)] border border-[var(--brand-accent)] rounded-xl px-3 min-h-[40px] text-base font-extrabold text-[var(--ink)] outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-base font-extrabold text-[var(--ink)] text-right">
                        <span>{name || 'Tap to enter name'}</span>
                        <Edit3 className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => setActiveField('amount')}
                    className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] shrink-0">
                      Amount
                    </span>
                    {activeField === 'amount' ? (
                      <input
                        type="number"
                        autoFocus
                        min="1"
                        value={amount || ''}
                        onChange={(e) => setAmount(Number(e.target.value) || 0)}
                        onBlur={() => setActiveField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setActiveField(null);
                        }}
                        className="w-36 text-right bg-[var(--surface)] border border-[var(--brand-accent)] rounded-xl px-3 min-h-[42px] text-xl font-extrabold font-tabular text-[var(--ink)] outline-none"
                      />
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 text-2xl font-extrabold font-tabular ${
                          direction === 'given'
                            ? 'text-[var(--credit-red)]'
                            : 'text-[var(--debit-green)]'
                        }`}
                      >
                        <span>{formatINR(amount)}</span>
                        <Edit3 className="w-3.5 h-3.5 opacity-60" />
                      </span>
                    )}
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] shrink-0">
                      Type
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDirection('given')}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold active:scale-95 transition ${
                          direction === 'given'
                            ? 'bg-[var(--credit-red)] text-white shadow-xs'
                            : 'bg-[var(--surface)] text-[var(--ink-muted)]'
                        }`}
                      >
                        Given (Udhaar)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirection('received')}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold active:scale-95 transition ${
                          direction === 'received'
                            ? 'bg-[var(--debit-green)] text-white shadow-xs'
                            : 'bg-[var(--surface)] text-[var(--ink-muted)]'
                        }`}
                      >
                        Received (Mila)
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveField('note')}
                    className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] shrink-0">
                      Note
                    </span>
                    {activeField === 'note' ? (
                      <input
                        type="text"
                        autoFocus
                        value={note}
                        placeholder="e.g. Chini 2kg"
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={() => setActiveField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setActiveField(null);
                        }}
                        className="flex-1 text-right bg-[var(--surface)] ring-2 ring-[var(--brand-accent)] rounded-xl px-3 min-h-[40px] text-sm font-semibold text-[var(--ink)] outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink)] text-right">
                        <span className={note ? '' : 'text-[var(--ink-muted)] font-medium'}>
                          {note || 'Tap to add note'}
                        </span>
                        <Edit3 className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                      </span>
                    )}
                  </div>
                </div>

                {confirmError && (
                  <p className="text-sm font-semibold text-[var(--credit-red)]">{confirmError}</p>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(false)}
                    className="min-h-[50px] rounded-2xl bg-[var(--debit-green)] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save & Close'}</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                    className="min-h-[50px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Repeat className="w-4 h-4" />
                    <span>Save &amp; Next</span>
                  </motion.button>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStage('listen')}
                  className="w-full min-h-[44px] rounded-2xl bg-[var(--app-bg)] text-[var(--ink)] font-bold text-sm active:scale-95 transition"
                >
                  Re-Record Voice
                </button>
              </>
            )}

            {stage === 'batch' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
                      Batch Entries ({batchItems.filter((i) => i.selected).length})
                    </h2>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Multiple entries detected from one voice phrase
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close batch voice"
                    className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {batchItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-[var(--app-bg)] p-3.5 flex items-center justify-between gap-3"
                    >
                      <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const next = [...batchItems];
                            next[idx] = { ...item, selected: e.target.checked };
                            setBatchItems(next);
                          }}
                          className="w-4 h-4 accent-[var(--brand)] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-[var(--ink)] truncate">
                            {item.name || 'Customer'}
                          </p>
                          <p className="text-xs text-[var(--ink-muted)] truncate">
                            {item.direction === 'given' ? 'Given (Udhaar)' : 'Received (Mila)'}
                            {item.note ? ` · ${item.note}` : ''}
                          </p>
                        </div>
                      </label>
                      <span
                        className={`font-extrabold font-tabular text-base shrink-0 ${
                          item.direction === 'given'
                            ? 'text-[var(--credit-red)]'
                            : 'text-[var(--debit-green)]'
                        }`}
                      >
                        {formatINR(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {confirmError && (
                  <p className="text-sm font-semibold text-[var(--credit-red)]">{confirmError}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING_FAST}
                    type="button"
                    disabled={saving}
                    onClick={handleSaveBatch}
                    className="min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-sm shadow-md"
                  >
                    {saving ? 'Saving...' : `Save All (${batchItems.filter((i) => i.selected).length})`}
                  </motion.button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setStage('listen')}
                    className="min-h-[48px] rounded-2xl bg-[var(--app-bg)] font-bold text-sm text-[var(--ink)] active:scale-95 transition"
                  >
                    Re-Record
                  </button>
                </div>
              </>
            )}

            {stage === 'bill' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-[var(--ink)] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[var(--brand-accent)]" />
                      <span>Spoken Multi-Item Bill</span>
                    </h2>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Party: <strong>{voiceBillCustomer}</strong> ·{' '}
                      {voiceBillStatus === 'paid' ? 'Paid Cash/UPI' : 'Post as Udhaar'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close voice bill"
                    className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="rounded-2xl bg-[var(--app-bg)] divide-y divide-[var(--surface-subtle)]">
                  {voiceBillItems.map((it, idx) => (
                    <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[var(--ink)]">{it.name}</p>
                        <p className="text-[var(--ink-muted)] font-tabular">
                          {it.qty} × {formatINR(it.rate)}
                          {it.gstRate > 0 ? ` (+${it.gstRate}% GST)` : ''}
                        </p>
                      </div>
                      <span className="font-extrabold font-tabular text-sm text-[var(--ink)]">
                        {formatINR(it.qty * it.rate * (1 + it.gstRate / 100))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (onCreateBillFromVoice) {
                        onCreateBillFromVoice({
                          customerName: voiceBillCustomer,
                          paymentStatus: voiceBillStatus,
                          items: voiceBillItems,
                        });
                      }
                      onClose();
                    }}
                    className="min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Bill Builder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('listen')}
                    className="min-h-[48px] rounded-2xl bg-[var(--app-bg)] font-bold text-xs text-[var(--ink)] active:scale-95 transition"
                  >
                    Re-Record
                  </button>
                </div>
              </>
            )}

            {stage === 'balance' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
                    Spoken Balance Check
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close balance check"
                    className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {matchedAccount ? (
                  <div className="rounded-[22px] bg-[var(--app-bg)] p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-extrabold text-[var(--ink)]">{matchedAccount.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {matchedAccount.phone ? `+91 ${matchedAccount.phone}` : 'No mobile saved'}
                          {matchedAccount.dueDate ? ` · Due ${matchedAccount.dueDate}` : ''}
                        </p>
                      </div>
                      <div className="text-right font-tabular">
                        <p
                          className={`text-2xl font-extrabold ${
                            matchedAccount.balance > 0
                              ? 'text-[var(--credit-red)]'
                              : matchedAccount.balance < 0
                                ? 'text-[var(--debit-green)]'
                                : 'text-[var(--ink-muted)]'
                          }`}
                        >
                          {formatINR(Math.abs(matchedAccount.balance))}
                        </p>
                        <p className="text-xs font-bold text-[var(--ink-muted)]">
                          {matchedAccount.balance > 0
                            ? t.due
                            : matchedAccount.balance < 0
                              ? t.advance
                              : t.settled}
                        </p>
                      </div>
                    </div>

                    {matchedAccount.creditLimit && matchedAccount.creditLimit > 0 && (
                      <p className="text-xs font-semibold font-tabular text-[var(--ink-muted)]">
                        Credit Limit: {formatINR(matchedAccount.creditLimit)}
                        {matchedAccount.balance > matchedAccount.creditLimit ? ' · Limit Exceeded' : ''}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAccount(matchedAccount);
                        }}
                        className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-95 transition"
                      >
                        <span>Open Ledger</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      {matchedAccount.balance > 0 && (
                        <a
                          href={buildWhatsAppUrl(
                            matchedAccount.phone,
                            buildReminderMessage({
                              customerName: matchedAccount.name,
                              amount: matchedAccount.balance,
                              shopName: business.name,
                              upiId: business.upiId,
                              language,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[var(--debit-green)] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[22px] bg-[var(--app-bg)] p-6 text-center space-y-2">
                    <p className="text-base font-extrabold text-[var(--ink)]">
                      No party found matching &quot;{queriedName || 'Customer'}&quot;
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Try speaking their saved name or record a new Udhaar entry.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStage('listen');
                    startMic();
                  }}
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--app-bg)] font-bold text-sm text-[var(--ink)] active:scale-95 transition"
                >
                  Ask Another Question
                </button>
              </>
            )}

            {stage === 'saved' && (
              <SmartEntrySavedStage
                partyName={
                  savedSnapshot?.partyName ||
                  (batchItems.length > 1
                    ? `${batchItems.filter((i) => i.selected).length} Parties`
                    : name)
                }
                previousBalance={savedSnapshot?.previousBalance ?? 0}
                newBalance={
                  savedSnapshot?.newBalance ??
                  (direction === 'given' ? amount : -amount)
                }
                amount={savedSnapshot?.amount ?? amount}
                direction={savedSnapshot?.direction ?? direction}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
