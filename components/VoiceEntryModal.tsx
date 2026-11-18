'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Edit3,
  MessageCircle,
  Mic,
  MicOff,
  Repeat,
  Volume2,
  X,
} from 'lucide-react';
import {
  amountToHinglishWords,
  parseVoiceCommand,
  type ParsedHinglishEntry,
} from '@/lib/bolbahi-parser';
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  formatINR,
  getUIStrings,
  speakHinglish,
  stopSpeaking,
} from '@/lib/i18n';
import type {
  AccountKind,
  Business,
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

interface VoiceEntryModalProps {
  open: boolean;
  language: LanguageCode;
  accounts: LedgerAccount[];
  business: Business;
  prefillCustomerName?: string;
  defaultKind?: AccountKind;
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
  }) => Promise<void>;
}

interface BatchItemState extends ParsedHinglishEntry {
  selected: boolean;
  direction: TxDirection;
}

export const VoiceEntryModal: React.FC<VoiceEntryModalProps> = ({
  open,
  language,
  accounts,
  business,
  prefillCustomerName = '',
  defaultKind = 'customer',
  onClose,
  onOpenAccount,
  onOpenDailySummary,
  onSaveEntry,
}) => {
  const t = getUIStrings(language);
  const [stage, setStage] = useState<'listen' | 'confirm' | 'batch' | 'balance' | 'saved'>('listen');
  const [continuousMode, setContinuousMode] = useState(false);
  const [queueSavedCount, setQueueSavedCount] = useState(0);
  const [listening, setListening] = useState(false);
  const [statusText, setStatusText] = useState('Starting microphone...');
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [voiceError, setVoiceError] = useState('');

  // Single Confirm fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [direction, setDirection] = useState<TxDirection>('given');
  const [note, setNote] = useState('');
  const [rawPhrase, setRawPhrase] = useState('');
  const [micDenied, setMicDenied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // Multi-entry batch fields
  const [batchItems, setBatchItems] = useState<BatchItemState[]>([]);

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

  const applyTranscriptToConfirm = (phrase: string) => {
    stopMic();
    const cmd = parseVoiceCommand(phrase);

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
    const resolvedName = parsed.name || prefillCustomerName || 'Customer';
    const resolvedDir: TxDirection = parsed.type === 'debit' ? 'received' : 'given';
    setName(resolvedName);
    setAmount(parsed.amount);
    setDirection(resolvedDir);
    setNote(parsed.note || '');
    setRawPhrase(phrase);
    setEditing(parsed.amount <= 0 || !parsed.name);
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
      setStatusText('Voice recognition unavailable on this browser.');
      setVoiceError('Type any Hinglish entry, balance query, or "Aaj ka hisaab" below.');
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
          setStatusText('Tap mic to retry or type below');
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
      setStage('listen');
      setQueueSavedCount(0);
      setManualText('');
      setNote('');
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
  }, [open]);

  if (!open) return null;

  const handleSave = async (keepGoing: boolean) => {
    setConfirmError('');
    if (!name.trim()) {
      setConfirmError('Customer name is required.');
      return;
    }
    if (!amount || amount <= 0) {
      setConfirmError('Amount must be greater than zero.');
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

    setSaving(true);
    try {
      await onSaveEntry({
        customerName: name.trim(),
        direction,
        amount,
        note: note.trim() || undefined,
        voiceRaw: rawPhrase,
        kind: defaultKind,
      });
      lastSavedSigRef.current = { sig, at: Date.now() };
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      setSaving(false);

      if (keepGoing || continuousMode) {
        setQueueSavedCount((c) => c + 1);
        setManualText('');
        setNote('');
        setTranscript('');
        setStage('listen');
        speakHinglish('Save ho gaya. Agla boliye.', language);
        setTimeout(() => startMic(), 350);
        return;
      }

      setStage('saved');
      setTimeout(() => {
        onClose();
      }, 850);
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
    setSaving(true);
    setConfirmError('');
    try {
      for (const item of valid) {
        await onSaveEntry({
          customerName: item.name.trim(),
          direction: item.direction,
          amount: item.amount,
          note: item.note,
          voiceRaw: item.raw || rawPhrase,
          kind: defaultKind,
        });
      }
      setSaving(false);
      setStage('saved');
      setTimeout(() => {
        onClose();
      }, 850);
    } catch (err) {
      setSaving(false);
      setConfirmError(err instanceof Error ? err.message : 'Failed to save batch entries.');
    }
  };

  const readbackType = direction === 'given' ? 'Udhaar' : 'Mila';
  const readbackText = `${name || 'Customer'}, ${Math.round(amount)} rupaye, ${readbackType}. Sahi hai?`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voice Khata Entry"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
      >
        {stage === 'listen' && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Bolne Wala Munim
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Entry, Balance Check, or Daily Closing Summary
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close voice entry"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Single vs Continuous Queue Switch */}
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800/70 px-3.5 py-2">
              <button
                type="button"
                onClick={() => setContinuousMode((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 min-h-[36px]"
              >
                <Repeat className={`w-4 h-4 ${continuousMode ? 'text-[var(--brand)]' : 'text-slate-400'}`} />
                <span>Continuous Queue Mode: {continuousMode ? 'ON' : 'OFF'}</span>
              </button>
              {queueSavedCount > 0 && (
                <span className="text-xs font-extrabold font-tabular text-[var(--brand)]">
                  Saved {queueSavedCount}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center justify-center py-3 gap-3">
              <button
                type="button"
                onClick={() => (listening ? stopMic() : startMic())}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg transition ${
                  listening
                    ? 'bg-red-600 voice-fab-pulse scale-105'
                    : 'bg-[var(--brand)] hover:bg-[var(--brand-hover)]'
                }`}
              >
                {listening ? <Mic className="w-10 h-10" /> : <MicOff className="w-9 h-9" />}
              </button>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {statusText}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 min-h-[76px] flex items-center justify-center text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {transcript || 'Speak entry, balance check, or "Aaj ka hisaab"...'}
              </p>
            </div>

            {voiceError && (
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5 space-y-1.5">
                <p>{voiceError}</p>
                {micDenied && (
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] font-medium">
                    <span>
                      Tap the Lock / Site Settings icon in your browser bar → Permissions → Allow Microphone.
                    </span>
                    <button
                      type="button"
                      onClick={startMic}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold"
                    >
                      Retry Mic
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="voice-manual-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Quick Commands or Type Manually
              </label>
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
                      : 'Ramesh 500 udhaar aur Suresh 300 mila'
                  }
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-base font-medium text-slate-900 dark:text-white outline-none focus:border-[var(--brand)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualText.trim()) applyTranscriptToConfirm(manualText.trim());
                  }}
                  className="min-h-[48px] px-5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold whitespace-nowrap"
                >
                  Next
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
                {[
                  'Ramesh 500 udhaar',
                  'Ramesh ka hisaab batao',
                  'Aaj ka hisaab',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => applyTranscriptToConfirm(sample)}
                    className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-[var(--brand)] hover:text-[var(--brand)] whitespace-nowrap shrink-0"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {stage === 'confirm' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Confirm Voice Entry
              </h2>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-sm font-bold text-[var(--brand)] hover:bg-[var(--brand-tint)]"
              >
                <Edit3 className="w-4 h-4" />
                <span>{editing ? 'Done' : 'Edit'}</span>
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
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
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <Volume2 className="w-4 h-4 text-[var(--brand)]" />
                <span>Listen Again</span>
              </button>
            </div>

            {willExceedLimit && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3.5 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-semibold">
                  <p className="font-extrabold">Credit Limit Alert for {matchedAccount?.name}</p>
                  <p className="font-tabular mt-0.5">
                    New balance {formatINR(willExceedLimit.projected)} exceeds limit {formatINR(willExceedLimit.limit)} by {formatINR(willExceedLimit.excess)}.
                  </p>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 px-4">
              <div className="py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Name</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {name || '—'}
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Amount</span>
                <span
                  className={`text-2xl font-extrabold font-tabular ${
                    direction === 'given' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatINR(amount)}
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Type</span>
                <span
                  className={`text-base font-extrabold ${
                    direction === 'given' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {direction === 'given' ? 'Given (Udhaar)' : 'Received (Mila)'}
                </span>
              </div>
              {note && (
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-500">Note</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {note}
                  </span>
                </div>
              )}
            </div>

            {editing && (
              <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Customer / Party Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-base font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xl font-extrabold font-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Note / Item (Optional)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Chini 2kg"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDirection('given')}
                    className={`min-h-[46px] rounded-xl font-bold text-sm border-2 ${
                      direction === 'given'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    Given (Udhaar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('received')}
                    className={`min-h-[46px] rounded-xl font-bold text-sm border-2 ${
                      direction === 'received'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    Received (Mila)
                  </button>
                </div>
              </div>
            )}

            {confirmError && (
              <p className="text-sm font-semibold text-red-600">{confirmError}</p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save & Close'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-1.5"
              >
                <Repeat className="w-4 h-4" />
                <span>Save &amp; Next</span>
              </button>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => setStage('listen')}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm"
            >
              Re-Record Voice
            </button>
          </>
        )}

        {stage === 'batch' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Batch Entries ({batchItems.filter((i) => i.selected).length})
                </h2>
                <p className="text-xs text-slate-500">
                  Multiple entries detected from one voice phrase
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close batch voice"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {batchItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3"
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
                      <p className="font-extrabold text-sm truncate">{item.name || 'Customer'}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.direction === 'given' ? 'Given (Udhaar)' : 'Received (Mila)'}
                      </p>
                    </div>
                  </label>
                  <span
                    className={`font-extrabold font-tabular text-base shrink-0 ${
                      item.direction === 'given' ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatINR(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {confirmError && (
              <p className="text-sm font-semibold text-red-600">{confirmError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveBatch}
                className="min-h-[50px] rounded-2xl bg-[var(--brand)] text-white font-extrabold text-sm"
              >
                {saving ? 'Saving...' : `Save All (${batchItems.filter((i) => i.selected).length})`}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setStage('listen')}
                className="min-h-[50px] rounded-2xl border border-slate-300 dark:border-slate-700 font-bold text-sm"
              >
                Re-Record
              </button>
            </div>
          </>
        )}

        {stage === 'balance' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Spoken Balance Check
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close balance check"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {matchedAccount ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold">{matchedAccount.name}</p>
                    <p className="text-xs text-slate-500">
                      {matchedAccount.phone ? `+91 ${matchedAccount.phone}` : 'No mobile saved'}
                      {matchedAccount.dueDate ? ` · Due ${matchedAccount.dueDate}` : ''}
                    </p>
                  </div>
                  <div className="text-right font-tabular">
                    <p
                      className={`text-2xl font-extrabold ${
                        matchedAccount.balance > 0
                          ? 'text-red-600'
                          : matchedAccount.balance < 0
                          ? 'text-emerald-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {formatINR(Math.abs(matchedAccount.balance))}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {matchedAccount.balance > 0
                        ? t.due
                        : matchedAccount.balance < 0
                        ? t.advance
                        : t.settled}
                    </p>
                  </div>
                </div>

                {matchedAccount.creditLimit && matchedAccount.creditLimit > 0 && (
                  <p className="text-xs font-semibold font-tabular text-slate-600 dark:text-slate-300">
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
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
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
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-6 text-center space-y-2">
                <p className="text-base font-extrabold">
                  No party found matching &quot;{queriedName || 'Customer'}&quot;
                </p>
                <p className="text-xs text-slate-500">
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
              className="w-full min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-sm"
            >
              Ask Another Question
            </button>
          </>
        )}

        {stage === 'saved' && (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center"
            >
              <Check className="w-10 h-10 stroke-[3]" />
            </motion.div>
            <h3 className="text-2xl font-extrabold text-emerald-600">Entry Saved!</h3>
            <p className="text-sm text-slate-500">
              {batchItems.length > 1
                ? `${batchItems.filter((i) => i.selected).length} entries saved to khata`
                : `${name} · ${formatINR(amount)} (${direction === 'given' ? 'Given' : 'Received'})`}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
