'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  HelpCircle,
  LayoutGrid,
  MessageCircle,
  Mic,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  Undo2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { auth, googleProvider, testConnection } from '@/lib/firebase';
import {
  addTransactionAtomic,
  clearBusinessData,
  convertQuoteToBill,
  createAccount,
  createBusiness,
  deleteAccountWithTransactions,
  deleteBillDocument,
  deleteBusinessCascade,
  deleteStockItem,
  deleteTransactionAtomic,
  deleteUserAccountCascade,
  getUserProfile,
  restoreBusinessBackup,
  restoreTransactionAtomic,
  saveBillDocument,
  saveStockItem,
  seedDemoBusinessData,
  subscribeAccounts,
  subscribeBills,
  subscribeBusinesses,
  subscribeStockItems,
  subscribeTransactions,
  updateAccountMeta,
  updateBusiness,
  updateTransactionAtomic,
  upsertUserProfile,
} from '@/lib/firestore-service';
import {
  buildDailyMunimScript,
  buildTransactionSlipMessage,
  buildWhatsAppUrl,
  formatINR,
  getAvatarColor,
  getLocalDateKey,
  getUIStrings,
  hashPinForUid,
  speakHinglish,
  stopSpeaking,
} from '@/lib/i18n';
import type {
  AccentTheme,
  AccountKind,
  AppNotificationItem,
  AppearanceMode,
  BillDocType,
  BillDocument,
  BillLineItem,
  BillPaymentStatus,
  BillTemplateId,
  Business,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  StockItem,
  TxDirection,
  UserProfile,
} from '@/lib/types';
import { AccountChatLedger } from './AccountChatLedger';
import { BillsView, getNextSequenceNumber } from './BillsView';
import { CollectionView } from './CollectionView';
import { ErrorBoundary } from './ErrorBoundary';
import { LedgerView } from './LedgerView';
import { OnboardingFlow, type OnboardingStep } from './OnboardingFlow';
import { OfflineIndicator, PWAInstallButton } from './PwaControls';
import {
  AccountSummaryView,
  BusinessProfileView,
  HelpSupportView,
  MoreDrawerSheet,
  MultiDeviceView,
  NotificationsDrawer,
  PinLockOverlay,
  SettingsView,
  type SecondaryRoute,
} from './SecondaryViews';
import { StockView } from './StockView';
import { VoiceEntryModal } from './VoiceEntryModal';

type MainTab = 'ledger' | 'collection' | 'bills' | 'stock';
type NotifPrefsMap = Record<string, { read?: boolean; fav?: boolean }>;

function BolBahiAppInner() {
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Preferences & onboarding state
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>('green');
  const [appearance, setAppearance] = useState<AppearanceMode>('light');
  const [mobileNumber, setMobileNumber] = useState('');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('splash');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const authFlowBusyRef = useRef(false);

  // Domain Firestore collections
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoadedForUid, setBusinessesLoadedForUid] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [bills, setBills] = useState<BillDocument[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  // Navigation & overlays
  const [mainTab, setMainTab] = useState<MainTab>('ledger');
  const [secondaryRoute, setSecondaryRoute] = useState<SecondaryRoute | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefsMap>({});
  const [bizSwitcherOpen, setBizSwitcherOpen] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [creatingBiz, setCreatingBiz] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voicePrefillName, setVoicePrefillName] = useState('');
  const [billPrefill, setBillPrefill] = useState<{ name: string; phone: string } | null>(null);
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [actionToast, setActionToast] = useState<
    | {
        kind: 'added';
        tx: LedgerTransaction;
        account: LedgerAccount;
        newBalance: number;
        accountCreated: boolean;
      }
    | {
        kind: 'deleted';
        tx: LedgerTransaction;
        account: LedgerAccount;
      }
    | null
  >(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLaunchRef = useRef<{ action?: string | null; tab?: string | null } | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Register Service Worker, hydrate prelogin/notification prefs, and capture PWA shortcut params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
      const params = new URLSearchParams(window.location.search);
      const actionParam = params.get('action');
      const tabParam = params.get('tab');
      if (actionParam || tabParam) {
        pendingLaunchRef.current = { action: actionParam, tab: tabParam };
      }

      Promise.resolve().then(() => {
        try {
          const raw = localStorage.getItem('bolbahi_prelogin_prefs');
          if (raw) {
            const parsed = JSON.parse(raw) as {
              language?: LanguageCode;
              accentTheme?: AccentTheme;
              appearance?: AppearanceMode;
              mobileNumber?: string;
            };
            if (parsed.language) setLanguage(parsed.language);
            if (parsed.accentTheme) setAccentTheme(parsed.accentTheme);
            if (parsed.appearance) setAppearance(parsed.appearance);
            if (parsed.mobileNumber) setMobileNumber(parsed.mobileNumber);
          }
          const rawNotifs = localStorage.getItem('bolbahi_notif_prefs');
          if (rawNotifs) {
            setNotifPrefs(JSON.parse(rawNotifs) as NotifPrefsMap);
          }
        } catch {
          // Ignore storage read errors
        }
      });
    }
  }, []);

  // 1.5 second splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashDone(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Apply Accent Theme & Dark Mode classes on documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (accentTheme === 'crimson') {
      root.setAttribute('data-accent', 'crimson');
    } else {
      root.removeAttribute('data-accent');
    }

    const applyDark = (isDark: boolean) => {
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (appearance === 'dark') {
      applyDark(true);
    } else if (appearance === 'light') {
      applyDark(false);
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [accentTheme, appearance]);

  // Firebase Auth listener & profile hydration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setBusinesses([]);
        setAccounts([]);
        setTransactions([]);
        setBills([]);
        setStockItems([]);
        setOnboardingStep((prev) => (prev === 'verified' ? prev : 'language'));
        setAuthReady(true);
        return;
      }

      testConnection().catch(() => {});
      if (authFlowBusyRef.current) {
        setAuthReady(true);
        return;
      }

      try {
        setAuthError('');
        const existing = await getUserProfile(fbUser.uid);
        if (existing) {
          setProfile(existing);
          setLanguage(existing.language);
          setAccentTheme(existing.accentTheme);
          setAppearance(existing.appearance);
          setMobileNumber(existing.mobileNumber || '');
          if (!existing.appLockPin) setPinUnlocked(true);
          if (!existing.onboardingDone) {
            setOnboardingStep('welcome');
          }
        } else {
          const created = await upsertUserProfile(fbUser.uid, {
            language,
            accentTheme,
            appearance,
            mobileNumber,
            onboardingDone: false,
          });
          setProfile(created);
          setPinUnlocked(true);
          setOnboardingStep('welcome');
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to load your profile.');
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to user's businesses
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeBusinesses(user.uid, (rows) => {
      setBusinesses(rows);
      setBusinessesLoadedForUid(user.uid);
    });
    return () => unsub();
  }, [user]);

  const activeBusiness: Business | null = useMemo(() => {
    if (businesses.length === 0) return null;
    const matched = businesses.find((b) => b.id === profile?.activeBusinessId);
    return matched || businesses[0];
  }, [businesses, profile?.activeBusinessId]);

  // Subscribe to active business collections
  useEffect(() => {
    if (!user || !activeBusiness?.id) return;
    const bizId = activeBusiness.id;
    const u1 = subscribeAccounts(user.uid, bizId, setAccounts);
    const u2 = subscribeTransactions(user.uid, bizId, setTransactions);
    const u3 = subscribeBills(user.uid, bizId, setBills);
    const u4 = subscribeStockItems(user.uid, bizId, setStockItems);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [user, activeBusiness?.id]);

  const persistPrelogin = (next: {
    language?: LanguageCode;
    accentTheme?: AccentTheme;
    appearance?: AppearanceMode;
    mobileNumber?: string;
  }) => {
    try {
      const merged = {
        language,
        accentTheme,
        appearance,
        mobileNumber,
        ...next,
      };
      localStorage.setItem('bolbahi_prelogin_prefs', JSON.stringify(merged));
    } catch {
      // Ignore storage failures
    }
  };

  const handleSelectLanguage = async (lang: LanguageCode) => {
    setLanguage(lang);
    persistPrelogin({ language: lang });
    if (user) {
      const updated = await upsertUserProfile(user.uid, { language: lang });
      setProfile(updated);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthBusy(true);
    authFlowBusyRef.current = true;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      const existing = await getUserProfile(fbUser.uid);
      const saved = await upsertUserProfile(fbUser.uid, {
        mobileNumber: mobileNumber || existing?.mobileNumber || '',
        language,
        accentTheme,
        appearance,
        onboardingDone: existing?.onboardingDone ?? false,
      });
      setProfile(saved);
      if (!saved.appLockPin) setPinUnlocked(true);
      setOnboardingStep('verified');
      setTimeout(() => {
        if (saved.onboardingDone) {
          setOnboardingStep('setup-business');
        } else {
          setOnboardingStep('welcome');
        }
      }, 1700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in popup closed. Tap Continue again to verify your Google account.');
      } else {
        setAuthError(msg);
      }
    } finally {
      authFlowBusyRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleCreateFirstBusiness = async (shopName: string) => {
    if (!user) return;
    setAuthBusy(true);
    try {
      const created = await createBusiness(user.uid, {
        name: shopName,
        phone: mobileNumber,
      });
      const updated = await upsertUserProfile(user.uid, {
        activeBusinessId: created.id,
        onboardingDone: true,
        mobileNumber,
      });
      setProfile(updated);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSwitchBusiness = async (bizId: string) => {
    if (!user) return;
    setSelectedAccountId(null);
    const updated = await upsertUserProfile(user.uid, { activeBusinessId: bizId });
    setProfile(updated);
    setBizSwitcherOpen(false);
  };

  const handleCreateExtraBusiness = async () => {
    if (!user || !newBizName.trim()) return;
    setCreatingBiz(true);
    try {
      const created = await createBusiness(user.uid, {
        name: newBizName.trim(),
        phone: mobileNumber,
      });
      const updated = await upsertUserProfile(user.uid, { activeBusinessId: created.id });
      setProfile(updated);
      setNewBizName('');
      setSelectedAccountId(null);
      setBizSwitcherOpen(false);
    } finally {
      setCreatingBiz(false);
    }
  };

  const showActionToast = (
    next:
      | {
          kind: 'added';
          tx: LedgerTransaction;
          account: LedgerAccount;
          newBalance: number;
          accountCreated: boolean;
        }
      | {
          kind: 'deleted';
          tx: LedgerTransaction;
          account: LedgerAccount;
        }
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActionToast(next);
    toastTimerRef.current = setTimeout(() => {
      setActionToast(null);
    }, 6500);
  };

  const dismissActionToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActionToast(null);
  };

  const handleUndoToast = async () => {
    if (!actionToast || undoBusy) return;
    const current = actionToast;
    setUndoBusy(true);
    dismissActionToast();
    try {
      const liveAccount =
        accounts.find((a) => a.id === current.account.id) || current.account;
      if (current.kind === 'added') {
        const remaining = transactions.filter(
          (item) => item.accountId === liveAccount.id && item.id !== current.tx.id
        );
        if (current.accountCreated && remaining.length === 0) {
          await deleteAccountWithTransactions(liveAccount.id, [current.tx]);
          if (selectedAccountId === liveAccount.id) setSelectedAccountId(null);
        } else {
          await deleteTransactionAtomic({
            tx: current.tx,
            account: liveAccount,
            remainingForAccount: remaining,
          });
        }
      } else {
        const existing = transactions.filter((item) => item.accountId === liveAccount.id);
        await restoreTransactionAtomic({
          tx: current.tx,
          account: liveAccount,
          existingForAccount: existing,
        });
      }
    } finally {
      setUndoBusy(false);
    }
  };

  const dailyStats = useMemo(() => {
    const todayKey = getLocalDateKey();
    let givenToday = 0;
    let receivedToday = 0;
    for (const tx of transactions) {
      if ((tx.billDate || '').startsWith(todayKey)) {
        if (tx.direction === 'given') givenToday += tx.amount;
        else receivedToday += tx.amount;
      }
    }
    const overdueCount = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate && a.dueDate <= todayKey
    ).length;
    const lowStockCount = stockItems.filter(
      (s) => s.quantity <= (s.lowStockThreshold ?? 5)
    ).length;
    return {
      todayKey,
      givenToday,
      receivedToday,
      netToday: receivedToday - givenToday,
      overdueCount,
      lowStockCount,
    };
  }, [accounts, transactions, stockItems]);

  const notifications: AppNotificationItem[] = useMemo(() => {
    const items: AppNotificationItem[] = [];
    const overdueAccs = accounts.filter(
      (a) =>
        a.kind === 'customer' &&
        a.balance > 0 &&
        a.dueDate &&
        a.dueDate <= dailyStats.todayKey
    );
    if (overdueAccs.length > 0) {
      const totalOverdue = overdueAccs.reduce((s, a) => s + a.balance, 0);
      items.push({
        id: 'live-overdue',
        title: `${overdueAccs.length} Payment(s) Due / Overdue`,
        bullets: [
          `Total ${formatINR(totalOverdue)} pending across ${overdueAccs
            .slice(0, 2)
            .map((a) => a.name)
            .join(', ')}${overdueAccs.length > 2 ? '...' : ''}.`,
          'Send a 1-Click WhatsApp Vasooli reminder now.',
        ],
        actionLabel: 'Open Collection',
        targetAction: 'collection',
        read: Boolean(notifPrefs['live-overdue']?.read),
        fav: Boolean(notifPrefs['live-overdue']?.fav),
        timeLabel: 'Action needed',
      });
    }

    const overLimitAccs = accounts.filter(
      (a) => a.creditLimit && a.creditLimit > 0 && a.balance > a.creditLimit
    );
    if (overLimitAccs.length > 0) {
      items.push({
        id: 'live-credit-limit',
        title: `${overLimitAccs.length} Party Over Credit Limit`,
        bullets: overLimitAccs
          .slice(0, 2)
          .map(
            (a) =>
              `${a.name}: ${formatINR(a.balance)} vs limit ${formatINR(a.creditLimit || 0)}`
          ),
        actionLabel: 'Review Collection',
        targetAction: 'collection',
        read: Boolean(notifPrefs['live-credit-limit']?.read),
        fav: Boolean(notifPrefs['live-credit-limit']?.fav),
        timeLabel: 'Limit Alert',
      });
    }

    if (!activeBusiness?.upiId) {
      items.push({
        id: 'live-upi-setup',
        title: 'Add Shop UPI ID for Instant QR',
        bullets: [
          'Embed live UPI payment QR codes in WhatsApp reminders and printed GST bills.',
        ],
        actionLabel: 'Set UPI ID',
        targetAction: 'upi',
        read: Boolean(notifPrefs['live-upi-setup']?.read),
        fav: Boolean(notifPrefs['live-upi-setup']?.fav),
        timeLabel: 'Setup tip',
      });
    }

    items.push({
      id: 'tip-voice-entry',
      title: 'Speak in Hinglish or Hindi',
      bullets: [
        'Say "Ramesh 500 udhaar chini" or check balances via "Ramesh ka hisaab batao".',
        'Supports multi-entry phrases like "Ramesh 500 udhaar aur Suresh 300 mila".',
      ],
      actionLabel: 'Try Voice Entry',
      targetAction: 'voice',
      read: Boolean(notifPrefs['tip-voice-entry']?.read),
      fav: Boolean(notifPrefs['tip-voice-entry']?.fav),
      timeLabel: 'Voice Munim',
    });

    items.push({
      id: 'tip-themes',
      title: 'Customize Emerald Green, Crimson & Dark Mode',
      bullets: [
        'Switch shop theme colors and set a 4-digit PIN lock in Settings.',
      ],
      actionLabel: 'Open Settings',
      targetAction: 'theme',
      read: Boolean(notifPrefs['tip-themes']?.read),
      fav: Boolean(notifPrefs['tip-themes']?.fav),
      timeLabel: 'Tip',
    });

    return items;
  }, [accounts, activeBusiness?.upiId, dailyStats.todayKey, notifPrefs]);

  const updateNotifPref = (id: string, patch: { read?: boolean; fav?: boolean }) => {
    setNotifPrefs((prev) => {
      const next: NotifPrefsMap = {
        ...prev,
        [id]: { ...prev[id], ...patch },
      };
      try {
        localStorage.setItem('bolbahi_notif_prefs', JSON.stringify(next));
      } catch {
        // Ignore storage write error
      }
      return next;
    });
  };

  // Apply deep-linked PWA shortcuts (?action=voice or ?tab=bills) once authenticated & unlocked
  const shellReady =
    splashDone &&
    authReady &&
    Boolean(user) &&
    Boolean(profile?.onboardingDone) &&
    businesses.length > 0 &&
    (!profile?.appLockPin || pinUnlocked);

  useEffect(() => {
    if (!shellReady || !pendingLaunchRef.current) return;
    const { action, tab } = pendingLaunchRef.current;
    pendingLaunchRef.current = null;
    const timer = setTimeout(() => {
      if (tab === 'bills' || tab === 'collection' || tab === 'stock' || tab === 'ledger') {
        setSecondaryRoute(null);
        setSelectedAccountId(null);
        setMainTab(tab);
      }
      if (action === 'voice') {
        setVoicePrefillName('');
        setVoiceModalOpen(true);
      }
      if (typeof window !== 'undefined' && window.location.search) {
        window.history.replaceState(null, '', '/');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [shellReady]);

  const openDailyMunimSummary = () => {
    const shopName = activeBusiness?.name || businesses[0]?.name || 'BolBahi Shop';
    setDailySummaryOpen(true);
    speakHinglish(
      buildDailyMunimScript({
        givenToday: dailyStats.givenToday,
        receivedToday: dailyStats.receivedToday,
        overdueCount: dailyStats.overdueCount,
        lowStockCount: dailyStats.lowStockCount,
        shopName,
        language,
      }),
      language
    );
  };

  const closeDailyMunimSummary = () => {
    stopSpeaking();
    setDailySummaryOpen(false);
  };

  // Global Escape key handler for overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dailySummaryOpen) closeDailyMunimSummary();
      else if (bizSwitcherOpen) setBizSwitcherOpen(false);
      else if (moreOpen) setMoreOpen(false);
      else if (notifOpen) setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dailySummaryOpen, bizSwitcherOpen, moreOpen, notifOpen]);

  // Android hardware Back / browser popstate handling for nested views
  const hasNestedLayer = Boolean(
    voiceModalOpen ||
      dailySummaryOpen ||
      bizSwitcherOpen ||
      moreOpen ||
      notifOpen ||
      secondaryRoute ||
      selectedAccountId
  );

  useEffect(() => {
    if (!shellReady || !hasNestedLayer) return;
    if (window.location.hash !== '#nav') {
      window.history.pushState({ bolbahiNav: true }, '', '#nav');
    }
    const onPopState = () => {
      if (voiceModalOpen) setVoiceModalOpen(false);
      else if (dailySummaryOpen) closeDailyMunimSummary();
      else if (bizSwitcherOpen) setBizSwitcherOpen(false);
      else if (moreOpen) setMoreOpen(false);
      else if (notifOpen) setNotifOpen(false);
      else if (secondaryRoute) setSecondaryRoute(null);
      else if (selectedAccountId) setSelectedAccountId(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    shellReady,
    hasNestedLayer,
    voiceModalOpen,
    dailySummaryOpen,
    bizSwitcherOpen,
    moreOpen,
    notifOpen,
    secondaryRoute,
    selectedAccountId,
  ]);

  const handleVoiceSave = async (entry: {
    customerName: string;
    direction: TxDirection;
    amount: number;
    note?: string;
    voiceRaw: string;
    kind: AccountKind;
  }) => {
    if (!user || !activeBusiness) return;
    const match = accounts.find(
      (a) => a.name.toLowerCase() === entry.customerName.trim().toLowerCase()
    );
    const composedNote = entry.note
      ? entry.note
      : entry.voiceRaw
      ? `Voice: ${entry.voiceRaw}`
      : '';
    const res = await addTransactionAtomic({
      ownerId: user.uid,
      businessId: activeBusiness.id,
      existingAccount: match || null,
      customerName: entry.customerName,
      kind: match?.kind || entry.kind,
      direction: entry.direction,
      amount: entry.amount,
      note: composedNote,
      voiceRaw: entry.voiceRaw,
    });
    const accSnapshot: LedgerAccount = match
      ? { ...match, balance: res.newBalance }
      : {
          id: res.accountId,
          ownerId: user.uid,
          businessId: activeBusiness.id,
          kind: entry.kind,
          name: entry.customerName,
          phone: '',
          dueDate: '',
          balance: res.newBalance,
          lastNote: res.tx.note,
          lastActivityAt: res.tx.billDate,
        };
    showActionToast({
      kind: 'added',
      tx: res.tx,
      account: accSnapshot,
      newBalance: res.newBalance,
      accountCreated: res.accountCreated,
    });
  };

  const handleExportCsv = () => {
    if (!activeBusiness) return;
    const rows: string[] = [
      ['Type', 'Account Name', 'Phone', 'Direction', 'Amount (INR)', 'Date', 'Note'].join(','),
    ];
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    for (const tx of transactions) {
      const acc = accMap.get(tx.accountId);
      const escape = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
      rows.push(
        [
          escape(acc?.kind || 'customer'),
          escape(acc?.name || 'Customer'),
          escape(acc?.phone || ''),
          escape(tx.direction),
          String(tx.amount),
          escape(tx.billDate),
          escape(tx.note || tx.voiceRaw),
        ].join(',')
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBusiness.name.replace(/\s+/g, '_')}_bolbahi_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!activeBusiness) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      business: activeBusiness,
      accounts,
      transactions,
      bills,
      stockItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBusiness.name.replace(/\s+/g, '_')}_bolbahi_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJson = async (file: File) => {
    if (!user || !activeBusiness) return;
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    await restoreBusinessBackup(user.uid, activeBusiness.id, parsed);
  };

  const t = getUIStrings(language);

  // 1. Show Splash until 1.5s, Auth hydrated, and signed-in businesses hydrated
  const waitingForBusinesses =
    Boolean(user && profile?.onboardingDone && businessesLoadedForUid !== user.uid);
  if (!splashDone || !authReady || waitingForBusinesses) {
    return (
      <OnboardingFlow
        step="splash"
        language={language}
        accentTheme={accentTheme}
        mobileNumber={mobileNumber}
        authError={authError}
        authBusy={authBusy}
        onSelectLanguage={handleSelectLanguage}
        onMobileChange={setMobileNumber}
        onGoogleLogin={handleGoogleLogin}
        onWelcomeDone={() => setOnboardingStep('setup-business')}
        onCreateBusiness={handleCreateFirstBusiness}
        onSkipBusiness={() => handleCreateFirstBusiness('My Shop')}
        onStepChange={setOnboardingStep}
      />
    );
  }

  // 2. Onboarding / Login Flow if unauthenticated or business not yet set up
  const needsOnboarding =
    !user ||
    onboardingStep === 'verified' ||
    !profile?.onboardingDone ||
    businesses.length === 0;

  if (needsOnboarding) {
    const resolvedStep: OnboardingStep = !user
      ? onboardingStep === 'splash' || onboardingStep === 'verified'
        ? 'language'
        : onboardingStep
      : onboardingStep === 'verified'
      ? 'verified'
      : onboardingStep === 'setup-business'
      ? 'setup-business'
      : !profile?.onboardingDone
      ? 'welcome'
      : 'setup-business';

    return (
      <OnboardingFlow
        step={resolvedStep}
        language={language}
        accentTheme={accentTheme}
        mobileNumber={mobileNumber}
        authError={authError}
        authBusy={authBusy}
        onSelectLanguage={handleSelectLanguage}
        onMobileChange={(phone) => {
          setMobileNumber(phone);
          persistPrelogin({ mobileNumber: phone });
        }}
        onGoogleLogin={handleGoogleLogin}
        onWelcomeDone={async () => {
          if (businesses.length > 0 && user) {
            const updated = await upsertUserProfile(user.uid, { onboardingDone: true });
            setProfile(updated);
          } else {
            setOnboardingStep('setup-business');
          }
        }}
        onCreateBusiness={handleCreateFirstBusiness}
        onSkipBusiness={() => handleCreateFirstBusiness('My Shop')}
        onStepChange={setOnboardingStep}
      />
    );
  }

  // 3. Optional 4-Digit PIN Lock Gate
  if (profile?.appLockPin && !pinUnlocked) {
    return (
      <PinLockOverlay
        expectedPin={profile.appLockPin}
        uid={user.uid}
        onUnlock={() => setPinUnlocked(true)}
        onForgotPin={async () => {
          try {
            await reauthenticateWithPopup(user, googleProvider);
          } catch {
            await signInWithPopup(auth, googleProvider);
          }
          const updated = await upsertUserProfile(user.uid, { appLockPin: '' });
          setProfile(updated);
          setPinUnlocked(true);
        }}
      />
    );
  }

  // 4. Main OkCredit-Style Production App Shell
  const currentBusiness: Business = activeBusiness || businesses[0];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex bg-[var(--app-bg)] text-slate-900 dark:text-slate-100">
      <OfflineIndicator />

      {/* Desktop Sidebar Rail (md+) */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 justify-between z-30">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-1">
            <span className="w-9 h-9 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center font-extrabold">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <p className="text-lg font-extrabold leading-none">BolBahi</p>
              <p className="text-[11px] font-semibold text-slate-500">
                Voice Digital Khata
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBizSwitcherOpen(true)}
            className="w-full rounded-2xl bg-[var(--brand-tint)] border border-[var(--brand)]/30 p-3 flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                style={{ backgroundColor: getAvatarColor(currentBusiness.name) }}
                className="w-9 h-9 rounded-full text-white font-extrabold flex items-center justify-center shrink-0"
              >
                {currentBusiness.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold truncate text-slate-900 dark:text-white">
                  {currentBusiness.name}
                </p>
                <p className="text-[11px] text-[var(--brand)] font-semibold">
                  Switch / Add Shop
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--brand)] shrink-0" />
          </button>

          <nav className="space-y-1">
            {(
              [
                { id: 'ledger', label: t.tabLedger, icon: BookOpen },
                { id: 'collection', label: t.tabCollection, icon: Users },
                { id: 'bills', label: t.tabBills, icon: Receipt },
                { id: 'stock', label: 'Stock Inventory', icon: Package },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = !secondaryRoute && mainTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSecondaryRoute(null);
                    setSelectedAccountId(null);
                    setMainTab(item.id);
                  }}
                  className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                    active
                      ? 'bg-[var(--brand)] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setSelectedAccountId(null);
                setSecondaryRoute('settings');
              }}
              className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                secondaryRoute === 'settings'
                  ? 'bg-[var(--brand)] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{t.settings}</span>
            </button>
          </nav>
        </div>

        <button
          type="button"
          onClick={() => {
            setVoicePrefillName('');
            setVoiceModalOpen(true);
          }}
          className="w-full min-h-[54px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md voice-fab-pulse"
        >
          <Mic className="w-5 h-5" />
          <span>{t.voiceEntry}</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen w-full">
        {/* Sticky Top App Bar (OkCredit video 00:34) */}
        <header className="no-print sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setBizSwitcherOpen(true)}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <div
                style={{ backgroundColor: getAvatarColor(currentBusiness.name) }}
                className="w-9 h-9 rounded-full text-white font-extrabold flex items-center justify-center shrink-0"
              >
                {currentBusiness.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-base font-extrabold truncate max-w-[170px] sm:max-w-xs">
                    {currentBusiness.name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
                <p className="text-[11px] font-semibold text-slate-500 truncate">
                  {accounts.length} {t.accounts} ·{' '}
                  {formatINR(
                    accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0)
                  )}{' '}
                  Due
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <PWAInstallButton compact />

              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label="Open notifications"
                className="relative min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(null);
                  setSecondaryRoute('help-support');
                }}
                aria-label="Help and Support"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search accounts"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="max-w-5xl mx-auto pt-2.5">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer or supplier name / mobile..."
                className="w-full min-h-[42px] rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 text-sm outline-none"
              />
            </div>
          )}
        </header>

        {/* Active View Body */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4">
          {secondaryRoute === 'settings' && (
            <SettingsView
              key={currentBusiness.id}
              language={language}
              accentTheme={accentTheme}
              appearance={appearance}
              mobileNumber={mobileNumber}
              business={currentBusiness}
              appLockPin={profile?.appLockPin || ''}
              userEmail={user.email || ''}
              onBack={() => setSecondaryRoute(null)}
              onChangeLanguage={handleSelectLanguage}
              onChangeAccent={async (nextAccent) => {
                setAccentTheme(nextAccent);
                persistPrelogin({ accentTheme: nextAccent });
                const updated = await upsertUserProfile(user.uid, {
                  accentTheme: nextAccent,
                });
                setProfile(updated);
              }}
              onChangeAppearance={async (nextMode) => {
                setAppearance(nextMode);
                persistPrelogin({ appearance: nextMode });
                const updated = await upsertUserProfile(user.uid, {
                  appearance: nextMode,
                });
                setProfile(updated);
              }}
              onSaveMobile={async (phone) => {
                setMobileNumber(phone);
                const updated = await upsertUserProfile(user.uid, {
                  mobileNumber: phone,
                });
                setProfile(updated);
                await updateBusiness(currentBusiness.id, { phone });
              }}
              onSaveUpiId={async (upiId) => {
                await updateBusiness(currentBusiness.id, { upiId });
              }}
              onSavePin={async (pin) => {
                const hashedPin = pin ? await hashPinForUid(pin, user.uid) : '';
                const updated = await upsertUserProfile(user.uid, {
                  appLockPin: hashedPin,
                });
                setProfile(updated);
                setPinUnlocked(true);
              }}
              onLoadDemo={async () => {
                await seedDemoBusinessData(user.uid, currentBusiness.id);
              }}
              onExportCsv={handleExportCsv}
              onExportJson={handleExportJson}
              onRestoreJson={handleRestoreJson}
              onClearAll={async () => {
                await clearBusinessData(user.uid, currentBusiness.id);
                setSelectedAccountId(null);
              }}
              onDeleteAccount={async () => {
                const lastSignInMs = user.metadata.lastSignInTime
                  ? Date.parse(user.metadata.lastSignInTime)
                  : 0;
                if (!lastSignInMs || Date.now() - lastSignInMs > 4 * 60 * 1000) {
                  await reauthenticateWithPopup(user, googleProvider);
                }
                await deleteUserAccountCascade(user.uid);
                try {
                  await deleteUser(user);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : '';
                  if (msg.includes('requires-recent-login')) {
                    await reauthenticateWithPopup(user, googleProvider);
                    await deleteUser(user);
                  } else {
                    throw err;
                  }
                }
                try {
                  localStorage.removeItem('bolbahi_prelogin_prefs');
                  localStorage.removeItem('bolbahi_notif_prefs');
                } catch {
                  // Ignore storage removal errors
                }
                setSecondaryRoute(null);
                setSelectedAccountId(null);
                setOnboardingStep('language');
              }}
              onLogout={async () => {
                await signOut(auth);
                setSecondaryRoute(null);
                setSelectedAccountId(null);
                setOnboardingStep('login');
              }}
            />
          )}

          {secondaryRoute === 'business-profile' && (
            <BusinessProfileView
              key={currentBusiness.id}
              business={currentBusiness}
              canDeleteBusiness={businesses.length > 1}
              onBack={() => setSecondaryRoute(null)}
              onSave={async (patch) => {
                await updateBusiness(currentBusiness.id, patch);
              }}
              onDeleteBusiness={async () => {
                const fallback = businesses.find((b) => b.id !== currentBusiness.id);
                await deleteBusinessCascade(user.uid, currentBusiness.id);
                if (fallback) {
                  const updated = await upsertUserProfile(user.uid, {
                    activeBusinessId: fallback.id,
                  });
                  setProfile(updated);
                }
                setSelectedAccountId(null);
                setSecondaryRoute(null);
              }}
            />
          )}

          {secondaryRoute === 'account-summary' && (
            <AccountSummaryView
              accounts={accounts}
              transactions={transactions}
              onBack={() => setSecondaryRoute(null)}
              onExportJson={handleExportJson}
              onExportCsv={handleExportCsv}
            />
          )}

          {secondaryRoute === 'multi-device' && (
            <MultiDeviceView
              userEmail={user.email || ''}
              mobileNumber={mobileNumber}
              onBack={() => setSecondaryRoute(null)}
            />
          )}

          {secondaryRoute === 'help-support' && (
            <HelpSupportView onBack={() => setSecondaryRoute(null)} />
          )}

          {!secondaryRoute && selectedAccount && (
            <AccountChatLedger
              key={selectedAccount.id}
              account={selectedAccount}
              business={currentBusiness}
              language={language}
              transactions={transactions.filter((tx) => tx.accountId === selectedAccount.id)}
              onBack={() => setSelectedAccountId(null)}
              onAddTransaction={async (payload) => {
                const res = await addTransactionAtomic({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  existingAccount: selectedAccount,
                  customerName: selectedAccount.name,
                  kind: selectedAccount.kind,
                  direction: payload.direction,
                  amount: payload.amount,
                  note: payload.note,
                  billDate: payload.billDate,
                  billImage: payload.billImage,
                });
                showActionToast({
                  kind: 'added',
                  tx: res.tx,
                  account: { ...selectedAccount, balance: res.newBalance },
                  newBalance: res.newBalance,
                  accountCreated: false,
                });
              }}
              onUpdateTransaction={async (tx, patch) => {
                await updateTransactionAtomic({
                  tx,
                  account: selectedAccount,
                  allForAccount: transactions.filter(
                    (item) => item.accountId === selectedAccount.id
                  ),
                  patch,
                });
              }}
              onDeleteTransaction={async (tx) => {
                const remaining = transactions.filter(
                  (item) => item.accountId === selectedAccount.id && item.id !== tx.id
                );
                await deleteTransactionAtomic({
                  tx,
                  account: selectedAccount,
                  remainingForAccount: remaining,
                });
                showActionToast({
                  kind: 'deleted',
                  tx,
                  account: selectedAccount,
                });
              }}
              onUpdateAccount={async (patch) => {
                await updateAccountMeta(selectedAccount.id, patch);
              }}
              onDeleteAccount={async () => {
                const accTxs = transactions.filter(
                  (tx) => tx.accountId === selectedAccount.id
                );
                await deleteAccountWithTransactions(selectedAccount.id, accTxs);
                setSelectedAccountId(null);
              }}
              onOpenVoiceForCustomer={(name) => {
                setVoicePrefillName(name);
                setVoiceModalOpen(true);
              }}
              onOpenCreateBill={(customerName, customerPhone) => {
                setBillPrefill({ name: customerName, phone: customerPhone });
                setSelectedAccountId(null);
                setMainTab('bills');
              }}
            />
          )}

          {!secondaryRoute && !selectedAccount && mainTab === 'ledger' && (
            <LedgerView
              accounts={accounts}
              transactions={transactions}
              stockItems={stockItems}
              language={language}
              searchQuery={searchQuery}
              onSelectAccount={(acc) => setSelectedAccountId(acc.id)}
              onCreateAccount={async (payload) => {
                const created = await createAccount({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  kind: payload.kind,
                  name: payload.name,
                  phone: payload.phone,
                  dueDate: payload.dueDate,
                  creditLimit: payload.creditLimit,
                });
                setSelectedAccountId(created.id);
              }}
              onOpenCollection={() => setMainTab('collection')}
              onOpenVoiceEntry={() => {
                setVoicePrefillName('');
                setVoiceModalOpen(true);
              }}
              onOpenDailySummary={openDailyMunimSummary}
            />
          )}

          {!secondaryRoute && !selectedAccount && mainTab === 'collection' && (
            <CollectionView
              key={`${currentBusiness.id}_${currentBusiness.upiId || ''}`}
              accounts={accounts}
              business={currentBusiness}
              language={language}
              onUpdateAccountDue={async (accountId, dueDate) => {
                await updateAccountMeta(accountId, { dueDate });
              }}
              onSaveUpiId={async (upiId) => {
                await updateBusiness(currentBusiness.id, { upiId });
              }}
              onOpenAccount={(acc) => {
                setSelectedAccountId(acc.id);
                setMainTab('ledger');
              }}
            />
          )}

          {!secondaryRoute && !selectedAccount && mainTab === 'bills' && (
            <BillsView
              key={`${currentBusiness.id}_${billPrefill?.name || 'none'}`}
              bills={bills}
              stockItems={stockItems}
              business={currentBusiness}
              prefillCustomer={billPrefill}
              onClearPrefill={() => setBillPrefill(null)}
              onSaveBill={async (payload: {
                docType: BillDocType;
                billNumber: string;
                customerName: string;
                customerPhone: string;
                items: BillLineItem[];
                discountAmount: number;
                paymentStatus: BillPaymentStatus;
                templateId: BillTemplateId;
                notes: string;
                billDate: string;
              }) => {
                let linkedTxId: string | undefined;
                if (payload.docType === 'bill' && payload.paymentStatus === 'unpaid') {
                  const sub = payload.items.reduce(
                    (s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0),
                    0
                  );
                  const gst = payload.items.reduce(
                    (s, it) =>
                      s +
                      ((Number(it.qty) || 0) *
                        (Number(it.rate) || 0) *
                        (Number(it.gstRate) || 0)) /
                        100,
                    0
                  );
                  const netBill = Math.max(
                    0,
                    Math.round((sub + gst - (payload.discountAmount || 0)) * 100) / 100
                  );
                  if (netBill > 0) {
                    const matched = accounts.find(
                      (a) =>
                        a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                        (payload.customerPhone && a.phone === payload.customerPhone)
                    );
                    const txRes = await addTransactionAtomic({
                      ownerId: user.uid,
                      businessId: currentBusiness.id,
                      existingAccount: matched || null,
                      customerName: payload.customerName,
                      kind: matched?.kind || 'customer',
                      direction: 'given',
                      amount: netBill,
                      note: `Bill ${payload.billNumber}`,
                      billDate: payload.billDate,
                    });
                    linkedTxId = txRes.txId;
                  }
                }
                const res = await saveBillDocument({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  stockItems,
                  linkedTxId,
                  ...payload,
                });
                return { deductedCount: res.deductedCount };
              }}
              onConvertQuote={async (quote) => {
                const newBillNumber = getNextSequenceNumber(bills, 'bill');
                const deductedCount = await convertQuoteToBill({
                  quote,
                  newBillNumber,
                  stockItems,
                });
                return { billNumber: newBillNumber, deductedCount };
              }}
              onDeleteBill={deleteBillDocument}
            />
          )}

          {!secondaryRoute && !selectedAccount && mainTab === 'stock' && (
            <StockView
              items={stockItems}
              onSaveItem={async (payload) => {
                await saveStockItem({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  ...payload,
                });
              }}
              onDeleteItem={deleteStockItem}
            />
          )}
        </main>
      </div>

      {/* Mobile Sticky 4-Tab Bottom Navigation (OkCredit video 00:34: Ledger | Collection | Bills | More) */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 h-16">
        {(
          [
            { id: 'ledger', label: t.tabLedger, icon: BookOpen },
            { id: 'collection', label: t.tabCollection, icon: Users },
            { id: 'bills', label: t.tabBills, icon: Receipt },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = !secondaryRoute && mainTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSecondaryRoute(null);
                setSelectedAccountId(null);
                setMainTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                active
                  ? 'text-[var(--brand)]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
            secondaryRoute || mainTab === 'stock'
              ? 'text-[var(--brand)]'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>{t.tabMore}</span>
        </button>
      </nav>

      {/* Business Switcher Modal (OkCredit video 00:46 - 00:50) */}
      {bizSwitcherOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Switch Business</h3>
              <button type="button" onClick={() => setBizSwitcherOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {businesses.map((biz) => {
                const active = biz.id === currentBusiness.id;
                return (
                  <button
                    key={biz.id}
                    type="button"
                    onClick={() => handleSwitchBusiness(biz.id)}
                    className={`w-full min-h-[54px] px-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      active
                        ? 'bg-[var(--brand-tint)] border-[var(--brand)]'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        style={{ backgroundColor: getAvatarColor(biz.name) }}
                        className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center shrink-0"
                      >
                        {biz.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-sm truncate">{biz.name}</span>
                    </div>
                    {active && <Check className="w-4 h-4 text-[var(--brand)] shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-bold uppercase text-slate-500">
                Create New Business
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="e.g. Sharma Wholesale"
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 text-sm font-bold outline-none"
                />
                <button
                  type="button"
                  disabled={creatingBiz || !newBizName.trim()}
                  onClick={handleCreateExtraBusiness}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* More Drawer */}
      <MoreDrawerSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={(target) => {
          setSelectedAccountId(null);
          if (target === 'bills' || target === 'stock' || target === 'collection') {
            setSecondaryRoute(null);
            setMainTab(target);
          } else {
            setSecondaryRoute(target);
          }
        }}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={notifOpen}
        items={notifications}
        onClose={() => setNotifOpen(false)}
        onToggleRead={(id) => updateNotifPref(id, { read: true })}
        onToggleFav={(id) =>
          updateNotifPref(id, { fav: !notifPrefs[id]?.fav })
        }
        onTriggerAction={(target) => {
          if (target === 'collection') {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('collection');
          } else if (target === 'theme' || target === 'upi') {
            setSelectedAccountId(null);
            setSecondaryRoute('settings');
          } else if (target === 'voice') {
            setVoicePrefillName('');
            setVoiceModalOpen(true);
          }
        }}
      />

      {/* Floating Undo + Instant WhatsApp Receipt Snackbar */}
      {actionToast && (
        <div className="no-print fixed bottom-20 md:bottom-6 inset-x-3 md:left-72 md:right-6 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-xl border border-slate-700 px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-extrabold truncate">
                {actionToast.kind === 'added'
                  ? `Saved ${formatINR(actionToast.tx.amount)} · ${actionToast.account.name}`
                  : `Deleted ${formatINR(actionToast.tx.amount)} · ${actionToast.account.name}`}
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                {actionToast.kind === 'added'
                  ? `Balance: ${formatINR(Math.abs(actionToast.newBalance))} ${
                      actionToast.newBalance > 0
                        ? 'Due'
                        : actionToast.newBalance < 0
                        ? 'Adv'
                        : 'Clear'
                    }`
                  : 'Entry removed from ledger'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {actionToast.kind === 'added' && (
                <a
                  href={buildWhatsAppUrl(
                    actionToast.account.phone,
                    buildTransactionSlipMessage({
                      customerName: actionToast.account.name,
                      direction: actionToast.tx.direction,
                      amount: actionToast.tx.amount,
                      newBalance: actionToast.newBalance,
                      shopName: currentBusiness.name,
                      upiId: currentBusiness.upiId,
                      language,
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Receipt</span>
                </a>
              )}

              <button
                type="button"
                disabled={undoBusy}
                onClick={handleUndoToast}
                className="min-h-[36px] px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={dismissActionToast}
                aria-label="Dismiss notification"
                className="min-w-[32px] min-h-[32px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Munim Closing Summary Modal */}
      {dailySummaryOpen && (
        <div className="no-print fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold">Aaj Ka Munim Hisaab</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {currentBusiness.name} · {dailyStats.todayKey}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDailyMunimSummary}
                aria-label="Close Munim Summary"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Given Today</p>
                <p className="text-base font-extrabold text-red-600 tabular-nums mt-0.5">
                  {formatINR(dailyStats.givenToday)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Vasooli Today</p>
                <p className="text-base font-extrabold text-emerald-600 tabular-nums mt-0.5">
                  {formatINR(dailyStats.receivedToday)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Net Flow</p>
                <p
                  className={`text-base font-extrabold tabular-nums mt-0.5 ${
                    dailyStats.netToday >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {dailyStats.netToday >= 0 ? '+' : '-'}
                  {formatINR(Math.abs(dailyStats.netToday))}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--brand-tint)] border border-[var(--brand)]/25 p-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {buildDailyMunimScript({
                givenToday: dailyStats.givenToday,
                receivedToday: dailyStats.receivedToday,
                overdueCount: dailyStats.overdueCount,
                lowStockCount: dailyStats.lowStockCount,
                shopName: currentBusiness.name,
                language,
              })}
            </div>

            {(dailyStats.overdueCount > 0 || dailyStats.lowStockCount > 0) && (
              <div className="grid grid-cols-2 gap-2">
                {dailyStats.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      closeDailyMunimSummary();
                      setSecondaryRoute(null);
                      setSelectedAccountId(null);
                      setMainTab('collection');
                    }}
                    className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 px-3 text-xs font-extrabold text-red-700 dark:text-red-300 flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{dailyStats.overdueCount} Overdue</span>
                  </button>
                )}
                {dailyStats.lowStockCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      closeDailyMunimSummary();
                      setSecondaryRoute(null);
                      setSelectedAccountId(null);
                      setMainTab('stock');
                    }}
                    className="min-h-[44px] rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>{dailyStats.lowStockCount} Low Stock</span>
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  speakHinglish(
                    buildDailyMunimScript({
                      givenToday: dailyStats.givenToday,
                      receivedToday: dailyStats.receivedToday,
                      overdueCount: dailyStats.overdueCount,
                      lowStockCount: dailyStats.lowStockCount,
                      shopName: currentBusiness.name,
                      language,
                    }),
                    language
                  )
                }
                className="min-h-[48px] rounded-2xl bg-[var(--brand)] text-white text-sm font-extrabold flex items-center justify-center gap-2"
              >
                <Volume2 className="w-4 h-4" />
                <span>Replay Audio</span>
              </button>
              <button
                type="button"
                onClick={stopSpeaking}
                className="min-h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold flex items-center justify-center gap-2"
              >
                <VolumeX className="w-4 h-4" />
                <span>Stop Voice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Entry Modal */}
      <VoiceEntryModal
        open={voiceModalOpen}
        language={language}
        accounts={accounts}
        business={currentBusiness}
        prefillCustomerName={voicePrefillName}
        onClose={() => setVoiceModalOpen(false)}
        onOpenAccount={(acc) => {
          setSecondaryRoute(null);
          setMainTab('ledger');
          setSelectedAccountId(acc.id);
        }}
        onOpenDailySummary={openDailyMunimSummary}
        onSaveEntry={handleVoiceSave}
      />
    </div>
  );
}

export const BolBahiApp: React.FC = () => (
  <ErrorBoundary>
    <BolBahiAppInner />
  </ErrorBoundary>
);
