'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
  Camera,
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
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { auth, googleProvider, testConnection } from '@/lib/firebase';
import {
  addCashbookEntry,
  addTransactionAtomic,
  clearBusinessData,
  convertQuoteToBill,
  createAccount,
  createBusiness,
  deleteAccountWithTransactions,
  deleteBillDocument,
  deleteBusinessCascade,
  deleteCashbookEntry,
  deleteStaffMember,
  deleteStockItem,
  deleteTransactionAtomic,
  deleteUserAccountCascade,
  getUserProfile,
  recordActivityLog,
  restoreBusinessBackup,
  restoreTransactionAtomic,
  saveBillDocument,
  saveStaffMember,
  saveStockItem,
  seedDemoBusinessData,
  subscribeAccounts,
  subscribeActivityLogs,
  subscribeBills,
  subscribeBusinesses,
  subscribeCashbookEntries,
  subscribeStaffMembers,
  subscribeStockItems,
  subscribeTransactions,
  updateAccountMeta,
  updateBusiness,
  updateTransactionAtomic,
  upsertUserProfile,
} from '@/lib/firestore-service';
import {
  UCRED_LOGO_PATH,
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
import { computeCustomerTrustScore, computeDailyGallaPulse } from '@/lib/ucred-intelligence';
import type {
  AccentTheme,
  AccountKind,
  ActiveOperator,
  ActivityLog,
  AppNotificationItem,
  AppearanceMode,
  BillDocType,
  BillDocument,
  BillLineItem,
  BillPaymentStatus,
  BillTemplateId,
  Business,
  CashbookEntry,
  CashbookMode,
  CustomerTrustScore,
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  StaffMember,
  StockItem,
  TxDirection,
  UserProfile,
} from '@/lib/types';
import { AccountChatLedger } from './AccountChatLedger';
import { BillsView, getNextSequenceNumber, type BillExternalDraft } from './BillsView';
import { CollectionView } from './CollectionView';
import { ErrorBoundary } from './ErrorBoundary';
import { GallaCashbookView } from './GallaCashbookView';
import { LedgerView } from './LedgerView';
import { OnboardingFlow, type OnboardingStep } from './OnboardingFlow';
import { ParchiScannerModal } from './ParchiScannerModal';
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
import { StaffAuditView } from './StaffAuditView';
import { StockView } from './StockView';
import { VoiceEntryModal } from './VoiceEntryModal';

type MainTab = 'ledger' | 'collection' | 'bills' | 'stock';
type NotifPrefsMap = Record<string, { read?: boolean; fav?: boolean }>;

function BolBahiAppInner() {
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Preferences & onboarding state (Ucred Obsidian default)
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>('obsidian');
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
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Active Counter Operator (Owner by default or switched Staff/Munim)
  const [activeOperator, setActiveOperator] = useState<ActiveOperator>({
    staffId: 'owner',
    name: 'Shop Owner',
    role: 'owner',
  });

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

  // Voice, Counter Mode, AI Parchi Scanner & Bill Drafts
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceCounterMode, setVoiceCounterMode] = useState(false);
  const [voicePrefillName, setVoicePrefillName] = useState('');
  const [parchiScannerOpen, setParchiScannerOpen] = useState(false);
  const [billPrefill, setBillPrefill] = useState<{ name: string; phone: string } | null>(null);
  const [billDraft, setBillDraft] = useState<BillExternalDraft | null>(null);
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
          const raw =
            localStorage.getItem('ucred_prelogin_prefs') ||
            localStorage.getItem('bolbahi_prelogin_prefs');
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
          const rawNotifs =
            localStorage.getItem('ucred_notif_prefs') ||
            localStorage.getItem('bolbahi_notif_prefs');
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

  // Apply Accent Theme (obsidian default, green, crimson) & Dark Mode classes on documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (accentTheme === 'crimson') {
      root.setAttribute('data-accent', 'crimson');
    } else if (accentTheme === 'green') {
      root.setAttribute('data-accent', 'green');
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
        setCashbookEntries([]);
        setStaffMembers([]);
        setActivityLogs([]);
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
          setAccentTheme(existing.accentTheme || 'obsidian');
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

  // Subscribe to active business collections (including Galla, Staff & Activity Audit Logs)
  useEffect(() => {
    if (!user || !activeBusiness?.id) return;
    const bizId = activeBusiness.id;
    const u1 = subscribeAccounts(user.uid, bizId, setAccounts);
    const u2 = subscribeTransactions(user.uid, bizId, setTransactions);
    const u3 = subscribeBills(user.uid, bizId, setBills);
    const u4 = subscribeStockItems(user.uid, bizId, setStockItems);
    const u5 = subscribeCashbookEntries(user.uid, bizId, setCashbookEntries);
    const u6 = subscribeStaffMembers(user.uid, bizId, setStaffMembers);
    const u7 = subscribeActivityLogs(user.uid, bizId, setActivityLogs);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [user, activeBusiness?.id]);

  // Deterministic Intelligence Computations
  const trustScoresByAccount = useMemo<Record<string, CustomerTrustScore>>(() => {
    const todayStr = getLocalDateKey();
    const txByAcc = new Map<string, LedgerTransaction[]>();
    for (const tx of transactions) {
      const arr = txByAcc.get(tx.accountId);
      if (arr) arr.push(tx);
      else txByAcc.set(tx.accountId, [tx]);
    }
    const map: Record<string, CustomerTrustScore> = {};
    for (const acc of accounts) {
      map[acc.id] = computeCustomerTrustScore(acc, txByAcc.get(acc.id) || [], todayStr);
    }
    return map;
  }, [accounts, transactions]);

  const gallaPulse = useMemo(
    () =>
      computeDailyGallaPulse({
        todayStr: getLocalDateKey(),
        cashbookEntries,
        transactions,
        bills,
        stockItems,
      }),
    [cashbookEntries, transactions, bills, stockItems]
  );

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
      localStorage.setItem('ucred_prelogin_prefs', JSON.stringify(merged));
    } catch {
      // Ignore storage failures
    }
  };

  const logActivity = (
    actionType: ActivityLog['actionType'],
    summary: string,
    targetName?: string,
    amount?: number
  ) => {
    if (!user || !activeBusiness) return;
    recordActivityLog({
      ownerId: user.uid,
      businessId: activeBusiness.id,
      actorName: activeOperator.name,
      actorRole: activeOperator.role,
      actionType,
      summary,
      targetName,
      amount,
    }).catch(() => {});
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
    setActiveOperator({ staffId: 'owner', name: 'Shop Owner', role: 'owner' });
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
      const liveAccount = accounts.find((a) => a.id === current.account.id) || current.account;
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
        logActivity(
          'ledger',
          `Undid ₹${current.tx.amount} entry for ${liveAccount.name}`,
          liveAccount.name,
          current.tx.amount
        );
      } else {
        const existing = transactions.filter((item) => item.accountId === liveAccount.id);
        await restoreTransactionAtomic({
          tx: current.tx,
          account: liveAccount,
          existingForAccount: existing,
        });
        logActivity(
          'ledger',
          `Restored ₹${current.tx.amount} entry for ${liveAccount.name}`,
          liveAccount.name,
          current.tx.amount
        );
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

    const highRiskAccs = accounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && (trustScoresByAccount[a.id]?.score ?? 100) < 50
    );
    if (highRiskAccs.length > 0) {
      items.push({
        id: 'live-trust-risk',
        title: `${highRiskAccs.length} High Trust-Risk Party`,
        bullets: highRiskAccs
          .slice(0, 2)
          .map(
            (a) =>
              `${a.name}: Trust ${trustScoresByAccount[a.id]?.score}/100 (${trustScoresByAccount[a.id]?.recoveryTimingHint})`
          ),
        actionLabel: 'Collect First',
        targetAction: 'collection',
        read: Boolean(notifPrefs['live-trust-risk']?.read),
        fav: Boolean(notifPrefs['live-trust-risk']?.fav),
        timeLabel: 'Recovery Radar',
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
      id: 'tip-parchi-scanner',
      title: 'Scan Handwritten Parchi with AI',
      bullets: [
        'Snap any handwritten kacha slip or supplier bill to auto-extract party, items & ₹ total.',
      ],
      actionLabel: 'Open Scanner',
      targetAction: 'parchi',
      read: Boolean(notifPrefs['tip-parchi-scanner']?.read),
      fav: Boolean(notifPrefs['tip-parchi-scanner']?.fav),
      timeLabel: 'Ucred AI',
    });

    items.push({
      id: 'tip-voice-entry',
      title: 'Hands-Free Counter Mode & AI Voice Bills',
      bullets: [
        'Say "Ramesh 500 udhaar aur Suresh 300 mila" or "Ramesh ka bill 2kg chini 90".',
      ],
      actionLabel: 'Try Voice Entry',
      targetAction: 'voice',
      read: Boolean(notifPrefs['tip-voice-entry']?.read),
      fav: Boolean(notifPrefs['tip-voice-entry']?.fav),
      timeLabel: 'Voice Munim',
    });

    return items;
  }, [accounts, activeBusiness?.upiId, dailyStats.todayKey, notifPrefs, trustScoresByAccount]);

  const updateNotifPref = (id: string, patch: { read?: boolean; fav?: boolean }) => {
    setNotifPrefs((prev) => {
      const next: NotifPrefsMap = {
        ...prev,
        [id]: { ...prev[id], ...patch },
      };
      try {
        localStorage.setItem('ucred_notif_prefs', JSON.stringify(next));
      } catch {
        // Ignore storage write error
      }
      return next;
    });
  };

  // Apply deep-linked PWA shortcuts (?action=voice|parchi|counter or ?tab=bills|galla|...) once authenticated & unlocked
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
      if (tab === 'galla') {
        setSelectedAccountId(null);
        setSecondaryRoute('galla');
      } else if (tab === 'bills' || tab === 'collection' || tab === 'stock' || tab === 'ledger') {
        setSecondaryRoute(null);
        setSelectedAccountId(null);
        setMainTab(tab);
      }
      if (action === 'voice') {
        setVoicePrefillName('');
        setVoiceCounterMode(false);
        setVoiceModalOpen(true);
      } else if (action === 'counter') {
        setVoicePrefillName('');
        setVoiceCounterMode(true);
        setVoiceModalOpen(true);
      } else if (action === 'parchi') {
        setParchiScannerOpen(true);
      }
      if (typeof window !== 'undefined' && window.location.search) {
        window.history.replaceState(null, '', '/');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [shellReady]);

  const openDailyMunimSummary = () => {
    const shopName = activeBusiness?.name || businesses[0]?.name || 'Ucred Shop';
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
      parchiScannerOpen ||
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
      window.history.pushState({ ucredNav: true }, '', '#nav');
    }
    const onPopState = () => {
      if (parchiScannerOpen) setParchiScannerOpen(false);
      else if (voiceModalOpen) setVoiceModalOpen(false);
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
    parchiScannerOpen,
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
      createdByName: activeOperator.name,
      createdByRole: activeOperator.role,
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
    logActivity(
      'ledger',
      `Voice ${entry.direction === 'given' ? 'Udhaar' : 'Jama'} ₹${entry.amount} for ${entry.customerName}`,
      entry.customerName,
      entry.amount
    );
    return { txId: res.txId, accountId: res.accountId };
  };

  const handleUndoVoiceQueueItem = async (item: { txId: string; accountId: string }) => {
    const liveAcc = accounts.find((a) => a.id === item.accountId);
    const liveTx = transactions.find((t) => t.id === item.txId);
    if (!liveAcc || !liveTx) return;
    const remaining = transactions.filter(
      (t) => t.accountId === liveAcc.id && t.id !== liveTx.id
    );
    await deleteTransactionAtomic({
      tx: liveTx,
      account: liveAcc,
      remainingForAccount: remaining,
    });
    logActivity(
      'ledger',
      `Queue Undo ₹${liveTx.amount} for ${liveAcc.name}`,
      liveAcc.name,
      liveTx.amount
    );
  };

  const handleExportCsv = () => {
    if (!activeBusiness) return;
    const rows: string[] = [
      ['Type', 'Account Name', 'Phone', 'Direction', 'Amount (INR)', 'Date', 'Note', 'Operator'].join(
        ','
      ),
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
          escape(tx.createdByName || 'Shop Owner'),
        ].join(',')
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBusiness.name.replace(/\s+/g, '_')}_ucred_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!activeBusiness) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Ucred',
      business: activeBusiness,
      accounts,
      transactions,
      bills,
      stockItems,
      cashbookEntries,
      staffMembers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBusiness.name.replace(/\s+/g, '_')}_ucred_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJson = async (file: File) => {
    if (!user || !activeBusiness) return;
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    await restoreBusinessBackup(user.uid, activeBusiness.id, parsed);
    logActivity('account', 'Restored JSON cloud backup');
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

  // 4. Main Ucred Production App Shell
  const currentBusiness: Business = activeBusiness || businesses[0];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex bg-[var(--app-bg)] text-slate-900 dark:text-slate-100">
      <OfflineIndicator />

      {/* Desktop Sidebar Rail (md+) */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[var(--surface)] border-r border-[var(--surface-border)] p-4 justify-between z-30">
        <div className="space-y-5 overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-2.5 px-1">
            <Image
              src={UCRED_LOGO_PATH}
              alt="Ucred"
              width={38}
              height={38}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-[var(--surface-border)]"
            />
            <div>
              <p className="text-lg font-extrabold leading-none tracking-tight">Ucred</p>
              <p className="text-[11px] font-semibold text-slate-500">
                Smart Voice Khata &amp; Galla
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBizSwitcherOpen(true)}
            className="w-full rounded-2xl bg-[var(--brand-tint)] border border-[var(--brand)]/25 p-3 flex items-center justify-between gap-2 text-left"
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
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                    active
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
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
                setSecondaryRoute('galla');
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                secondaryRoute === 'galla'
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Galla Cashbook</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAccountId(null);
                setSecondaryRoute('staff-audit');
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                secondaryRoute === 'staff-audit'
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Staff &amp; Audit</span>
            </button>

            <button
              type="button"
              onClick={() => setParchiScannerOpen(true)}
              className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Parchi (AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAccountId(null);
                setSecondaryRoute('settings');
              }}
              className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-bold transition ${
                secondaryRoute === 'settings'
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
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
            setVoiceCounterMode(false);
            setVoiceModalOpen(true);
          }}
          className="w-full min-h-[52px] rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-extrabold text-sm flex items-center justify-center gap-2 shadow-md voice-fab-pulse mt-4 shrink-0"
        >
          <Mic className="w-5 h-5" />
          <span>Voice &amp; Counter</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen w-full">
        {/* Clean 3-Zone Sticky Top App Bar */}
        <header className="no-print sticky top-0 z-20 bg-[var(--surface)]/95 backdrop-blur border-b border-[var(--surface-border)] px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            {/* Zone 1: Ucred Logo + Shop Switcher */}
            <button
              type="button"
              onClick={() => setBizSwitcherOpen(true)}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <Image
                src={UCRED_LOGO_PATH}
                alt="Ucred"
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover border border-[var(--surface-border)] shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-base font-extrabold truncate max-w-[145px] sm:max-w-xs">
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

            {/* Zone 2 & 3: Active Operator Switcher + Search/Bell/Help */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(null);
                  setSecondaryRoute('staff-audit');
                }}
                title="Switch Counter Staff / View Audit Log"
                className="hidden sm:inline-flex min-h-[36px] px-2.5 rounded-xl border border-[var(--surface-border)] text-[11px] font-extrabold items-center gap-1.5 hover:border-[var(--brand)] transition mr-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span className="max-w-[100px] truncate">{activeOperator.name}</span>
              </button>

              <PWAInstallButton compact />

              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search accounts"
                className="min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label="Open notifications"
                className="relative min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
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
                className="min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <HelpCircle className="w-5 h-5" />
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
                className="w-full min-h-[42px] rounded-xl bg-[var(--app-bg)] border border-[var(--surface-border)] px-3.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
          )}
        </header>

        {/* Active View Body */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4">
          {secondaryRoute === 'galla' && (
            <GallaCashbookView
              cashbookEntries={cashbookEntries}
              transactions={transactions}
              bills={bills}
              stockItems={stockItems}
              activeOperatorName={activeOperator.name}
              onAddEntry={async (payload) => {
                await addCashbookEntry({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  entryType: payload.entryType,
                  mode: payload.mode,
                  category: payload.category,
                  amount: payload.amount,
                  note: payload.note,
                  entryDate: payload.entryDate,
                  actorName: activeOperator.name,
                });
                logActivity(
                  'galla',
                  `Galla ${payload.entryType} ₹${payload.amount} (${payload.category})`,
                  payload.category,
                  payload.amount
                );
              }}
              onDeleteEntry={async (entryId) => {
                await deleteCashbookEntry(entryId);
                logActivity('galla', 'Deleted Galla cashbook entry');
              }}
              onBack={() => setSecondaryRoute(null)}
            />
          )}

          {secondaryRoute === 'staff-audit' && (
            <StaffAuditView
              uid={user.uid}
              staffMembers={staffMembers}
              activityLogs={activityLogs}
              activeOperator={activeOperator}
              onSwitchOperator={(op) => {
                setActiveOperator(op);
                logActivity('staff', `Counter switched to ${op.name} (${op.role})`, op.name);
              }}
              onSaveStaff={async (payload) => {
                await saveStaffMember({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  ...payload,
                });
                logActivity(
                  'staff',
                  `${payload.existingId ? 'Updated' : 'Added'} staff ${payload.name} (${payload.role})`,
                  payload.name
                );
              }}
              onDeleteStaff={async (staffId) => {
                const st = staffMembers.find((s) => s.id === staffId);
                await deleteStaffMember(staffId);
                if (activeOperator.staffId === staffId) {
                  setActiveOperator({ staffId: 'owner', name: 'Shop Owner', role: 'owner' });
                }
                logActivity('staff', `Removed staff ${st?.name || ''}`, st?.name);
              }}
              onBack={() => setSecondaryRoute(null)}
            />
          )}

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
                logActivity('account', 'Loaded Ucred demo shop data');
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
                  localStorage.removeItem('ucred_prelogin_prefs');
                  localStorage.removeItem('ucred_notif_prefs');
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
                logActivity('account', 'Updated business profile', patch.name || currentBusiness.name);
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
              trustScore={trustScoresByAccount[selectedAccount.id]}
              onBack={() => setSelectedAccountId(null)}
              onOpenParchiScanner={() => setParchiScannerOpen(true)}
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
                  createdByName: activeOperator.name,
                  createdByRole: activeOperator.role,
                  syncToGalla: payload.syncToGalla,
                });
                showActionToast({
                  kind: 'added',
                  tx: res.tx,
                  account: { ...selectedAccount, balance: res.newBalance },
                  newBalance: res.newBalance,
                  accountCreated: false,
                });
                logActivity(
                  'ledger',
                  `${payload.direction === 'given' ? 'Udhaar' : 'Jama'} ₹${payload.amount} for ${selectedAccount.name}`,
                  selectedAccount.name,
                  payload.amount
                );
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
                logActivity(
                  'ledger',
                  `Edited ₹${patch.amount} entry for ${selectedAccount.name}`,
                  selectedAccount.name,
                  patch.amount
                );
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
                logActivity(
                  'ledger',
                  `Deleted ₹${tx.amount} entry for ${selectedAccount.name}`,
                  selectedAccount.name,
                  tx.amount
                );
              }}
              onUpdateAccount={async (patch) => {
                await updateAccountMeta(selectedAccount.id, patch);
                logActivity(
                  'account',
                  `Updated party details for ${selectedAccount.name}`,
                  selectedAccount.name
                );
              }}
              onDeleteAccount={async () => {
                const accTxs = transactions.filter((tx) => tx.accountId === selectedAccount.id);
                await deleteAccountWithTransactions(selectedAccount.id, accTxs);
                logActivity('account', `Deleted party ${selectedAccount.name}`, selectedAccount.name);
                setSelectedAccountId(null);
              }}
              onOpenVoiceForCustomer={(name) => {
                setVoicePrefillName(name);
                setVoiceCounterMode(false);
                setVoiceModalOpen(true);
              }}
              onOpenCreateBill={(customerName, customerPhone) => {
                setBillDraft(null);
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
              gallaPulse={gallaPulse}
              trustScoresByAccount={trustScoresByAccount}
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
                logActivity(
                  'account',
                  `Added ${payload.kind} ${payload.name}`,
                  payload.name
                );
                setSelectedAccountId(created.id);
              }}
              onOpenCollection={() => setMainTab('collection')}
              onOpenVoiceEntry={() => {
                setVoicePrefillName('');
                setVoiceCounterMode(false);
                setVoiceModalOpen(true);
              }}
              onOpenCounterMode={() => {
                setVoicePrefillName('');
                setVoiceCounterMode(true);
                setVoiceModalOpen(true);
              }}
              onOpenParchiScanner={() => setParchiScannerOpen(true)}
              onOpenGalla={() => {
                setSelectedAccountId(null);
                setSecondaryRoute('galla');
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
              trustScoresByAccount={trustScoresByAccount}
              onUpdateAccountDue={async (accountId, dueDate) => {
                await updateAccountMeta(accountId, { dueDate });
                const target = accounts.find((a) => a.id === accountId);
                logActivity(
                  'account',
                  `Set due date ${dueDate} for ${target?.name || 'Party'}`,
                  target?.name
                );
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
              key={`${currentBusiness.id}_${billDraft?.customerName || billPrefill?.name || 'none'}_${
                billDraft ? billDraft.items?.length || 0 : 0
              }`}
              bills={bills}
              stockItems={stockItems}
              business={currentBusiness}
              prefillCustomer={billPrefill}
              externalDraft={billDraft}
              onClearPrefill={() => {
                setBillPrefill(null);
                setBillDraft(null);
              }}
              onSaveBill={async (payload: {
                docType: BillDocType;
                billNumber: string;
                customerName: string;
                customerPhone: string;
                items: BillLineItem[];
                discountAmount: number;
                paymentStatus: BillPaymentStatus;
                syncToGalla?: { mode: CashbookMode } | null;
                templateId: BillTemplateId;
                notes: string;
                billDate: string;
              }) => {
                let linkedTxId: string | undefined;
                const sub = payload.items.reduce(
                  (s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0),
                  0
                );
                const gst = payload.items.reduce(
                  (s, it) =>
                    s +
                    ((Number(it.qty) || 0) * (Number(it.rate) || 0) * (Number(it.gstRate) || 0)) /
                      100,
                  0
                );
                const netBill = Math.max(
                  0,
                  Math.round((sub + gst - (payload.discountAmount || 0)) * 100) / 100
                );

                if (payload.docType === 'bill' && payload.paymentStatus === 'unpaid' && netBill > 0) {
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
                    createdByName: activeOperator.name,
                    createdByRole: activeOperator.role,
                  });
                  linkedTxId = txRes.txId;
                }
                const res = await saveBillDocument({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  stockItems,
                  linkedTxId,
                  createdByName: activeOperator.name,
                  ...payload,
                });
                logActivity(
                  'bill',
                  `Created ${payload.docType} ${payload.billNumber} for ${payload.customerName}`,
                  payload.customerName,
                  netBill
                );
                return { deductedCount: res.deductedCount };
              }}
              onConvertQuote={async (quote) => {
                const newBillNumber = getNextSequenceNumber(bills, 'bill');
                const deductedCount = await convertQuoteToBill({
                  quote,
                  newBillNumber,
                  stockItems,
                });
                logActivity(
                  'bill',
                  `Converted ${quote.billNumber} -> ${newBillNumber}`,
                  quote.customerName,
                  quote.totalAmount
                );
                return { billNumber: newBillNumber, deductedCount };
              }}
              onDeleteBill={async (billId) => {
                const target = bills.find((b) => b.id === billId);
                await deleteBillDocument(billId);
                logActivity(
                  'bill',
                  `Deleted ${target?.billNumber || 'bill'}`,
                  target?.customerName,
                  target?.totalAmount
                );
              }}
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
                logActivity(
                  'stock',
                  `${payload.existingId ? 'Updated' : 'Added'} stock ${payload.name} (${payload.quantity} ${payload.unit})`,
                  payload.name
                );
              }}
              onDeleteItem={async (itemId) => {
                const stk = stockItems.find((s) => s.id === itemId);
                await deleteStockItem(itemId);
                logActivity('stock', `Deleted stock item ${stk?.name || ''}`, stk?.name);
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Sticky 4-Tab Bottom Navigation (Ledger | Collection | Bills | More) */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--surface)] border-t border-[var(--surface-border)] grid grid-cols-4 h-16">
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
                active ? 'text-[var(--brand)]' : 'text-slate-500 dark:text-slate-400'
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

      {/* Business Switcher Modal */}
      {bizSwitcherOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4">
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
                        : 'border-[var(--surface-border)]'
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

            <div className="pt-2 border-t border-[var(--surface-border)] space-y-2">
              <p className="text-xs font-bold uppercase text-slate-500">Create New Business</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="e.g. Sharma Wholesale"
                  className="flex-1 min-h-[44px] rounded-xl border border-[var(--surface-border)] bg-transparent px-3 text-sm font-bold outline-none"
                />
                <button
                  type="button"
                  disabled={creatingBiz || !newBizName.trim()}
                  onClick={handleCreateExtraBusiness}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
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
          if (target === 'scan-parchi') {
            setParchiScannerOpen(true);
            return;
          }
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
        onToggleFav={(id) => updateNotifPref(id, { fav: !notifPrefs[id]?.fav })}
        onTriggerAction={(target) => {
          if (target === 'collection') {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('collection');
          } else if (target === 'galla') {
            setSelectedAccountId(null);
            setSecondaryRoute('galla');
          } else if (target === 'parchi') {
            setParchiScannerOpen(true);
          } else if (target === 'theme' || target === 'upi') {
            setSelectedAccountId(null);
            setSecondaryRoute('settings');
          } else if (target === 'voice') {
            setVoicePrefillName('');
            setVoiceCounterMode(false);
            setVoiceModalOpen(true);
          }
        }}
      />

      {/* Floating Undo + Instant WhatsApp Receipt Snackbar */}
      {actionToast && (
        <div className="no-print fixed bottom-20 md:bottom-6 inset-x-3 md:left-72 md:right-6 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-[#161514] text-[#F6F2EC] shadow-xl border border-[#2A2824] px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-extrabold truncate">
                {actionToast.kind === 'added'
                  ? `Saved ${formatINR(actionToast.tx.amount)} · ${actionToast.account.name}`
                  : `Deleted ${formatINR(actionToast.tx.amount)} · ${actionToast.account.name}`}
              </p>
              <p className="text-[11px] text-[#B8B0A4] truncate">
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
                className="min-h-[36px] px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#161514] text-[11px] font-extrabold inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={dismissActionToast}
                aria-label="Dismiss notification"
                className="min-w-[32px] min-h-[32px] rounded-lg text-[#B8B0A4] hover:text-white flex items-center justify-center"
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
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--surface-border)] p-6 space-y-4 shadow-2xl">
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
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[var(--surface-border)] p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Given Today</p>
                <p className="text-base font-extrabold text-red-600 font-tabular mt-0.5">
                  {formatINR(dailyStats.givenToday)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Vasooli Today</p>
                <p className="text-base font-extrabold text-emerald-600 font-tabular mt-0.5">
                  {formatINR(dailyStats.receivedToday)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] p-3 text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Galla Cash</p>
                <p className="text-base font-extrabold text-[var(--brand)] font-tabular mt-0.5">
                  {formatINR(gallaPulse.cashDrawerBalance)}
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
                className="min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2"
              >
                <Volume2 className="w-4 h-4" />
                <span>Replay Audio</span>
              </button>
              <button
                type="button"
                onClick={stopSpeaking}
                className="min-h-[48px] rounded-2xl border border-[var(--surface-border)] text-sm font-bold flex items-center justify-center gap-2"
              >
                <VolumeX className="w-4 h-4" />
                <span>Stop Voice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice & Hands-Free Counter Modal */}
      <VoiceEntryModal
        open={voiceModalOpen}
        language={language}
        accounts={accounts}
        stockNames={stockItems.map((s) => s.name)}
        business={currentBusiness}
        prefillCustomerName={voicePrefillName}
        initialCounterMode={voiceCounterMode}
        onClose={() => {
          setVoiceModalOpen(false);
          setVoiceCounterMode(false);
        }}
        onOpenAccount={(acc) => {
          setSecondaryRoute(null);
          setMainTab('ledger');
          setSelectedAccountId(acc.id);
        }}
        onOpenDailySummary={openDailyMunimSummary}
        onSaveEntry={handleVoiceSave}
        onUndoQueueItem={handleUndoVoiceQueueItem}
        onCreateBillFromVoice={(draft) => {
          setVoiceModalOpen(false);
          setVoiceCounterMode(false);
          setBillPrefill(null);
          setBillDraft({
            customerName: draft.customerName,
            items: draft.items,
            paymentStatus: draft.paymentStatus,
          });
          setSecondaryRoute(null);
          setSelectedAccountId(null);
          setMainTab('bills');
        }}
      />

      {/* AI Parchi & Receipt Scanner Modal */}
      <ParchiScannerModal
        open={parchiScannerOpen}
        onClose={() => setParchiScannerOpen(false)}
        accounts={accounts}
        onPostToKhata={async (payload) => {
          const match = accounts.find(
            (a) =>
              a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
              (payload.phone && a.phone === payload.phone)
          );
          const res = await addTransactionAtomic({
            ownerId: user.uid,
            businessId: currentBusiness.id,
            existingAccount: match || null,
            customerName: payload.customerName,
            kind: match?.kind || 'customer',
            direction: payload.direction,
            amount: payload.amount,
            note: payload.note || 'AI Parchi Scan',
            billDate: payload.billDate,
            billImage: payload.billImage,
            createdByName: activeOperator.name,
            createdByRole: activeOperator.role,
          });
          if (!match && payload.phone) {
            await updateAccountMeta(res.accountId, { phone: payload.phone }).catch(() => {});
          }
          const accSnapshot: LedgerAccount = match
            ? { ...match, balance: res.newBalance }
            : {
                id: res.accountId,
                ownerId: user.uid,
                businessId: currentBusiness.id,
                kind: 'customer',
                name: payload.customerName,
                phone: payload.phone || '',
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
          logActivity(
            'ledger',
            `Scanned Parchi ₹${payload.amount} for ${payload.customerName}`,
            payload.customerName,
            payload.amount
          );
          setParchiScannerOpen(false);
          setSecondaryRoute(null);
          setMainTab('ledger');
          setSelectedAccountId(res.accountId);
        }}
        onCreateBillFromScan={(draft) => {
          setParchiScannerOpen(false);
          setBillPrefill(null);
          setBillDraft({
            customerName: draft.customerName,
            customerPhone: draft.customerPhone,
            items: draft.items,
            paymentStatus: draft.paymentStatus,
            notes: draft.notes,
          });
          setSecondaryRoute(null);
          setSelectedAccountId(null);
          setMainTab('bills');
        }}
      />
    </div>
  );
}

export const BolBahiApp: React.FC = () => (
  <ErrorBoundary>
    <BolBahiAppInner />
  </ErrorBoundary>
);
