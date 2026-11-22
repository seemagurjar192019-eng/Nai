'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  deleteUser,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  PhoneAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  RecaptchaVerifier,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudUpload,
  Edit2,
  KeyRound,
  Mail,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { indianMobileSchema, otpCodeSchema } from '@/lib/design-system';
import { auth, testConnection } from '@/lib/firebase';
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
  GUEST_OWNER_ID,
  applyAddCashbookEntry,
  applyAddTransactionAtomic,
  applyClearBusinessData,
  applyConvertQuoteToBill,
  applyCreateAccount,
  applyCreateBusiness,
  applyDeleteAccountWithTransactions,
  applyDeleteBillDocument,
  applyDeleteBusinessCascade,
  applyDeleteCashbookEntry,
  applyDeleteStaffMember,
  applyDeleteStockItem,
  applyDeleteTransactionAtomic,
  applyRecordActivityLog,
  applyRestoreBusinessBackup,
  applyRestoreTransactionAtomic,
  applySaveBillDocument,
  applySaveStaffMember,
  applySaveStockItem,
  applyUpdateAccountMeta,
  applyUpdateBusiness,
  applyUpdateTransactionAtomic,
  clearGuestVault,
  hasGuestRecordsToSync,
  loadGuestVault,
  saveGuestVault,
  type GuestVaultState,
} from '@/lib/guest-store';
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
import {
  computeCustomerTrustScore,
  computeDailyGallaPulse,
  computeNetCashflowSummary,
} from '@/lib/ucred-intelligence';
import type {
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
import type { MainTab } from '@/types';
import { usePersonaGate } from '@/hooks/usePersonaGate';
import { useSpatialMotion } from '@/hooks/useSpatialMotion';
import { haptics } from '@/utils/haptics';
import {
  getPersonaCapabilities,
  loadPersonaPrefs,
  savePersonaPrefs,
  type PersonaCategoryId,
  type PersonaPrefs,
} from '@/lib/persona';
import { BillsView, getNextSequenceNumber, type BillExternalDraft } from './BillsView';
import { CashKhataFeed } from './cockpit/CashKhataFeed';
import { CollectionView } from './CollectionView';
import { ErrorBoundary } from './ErrorBoundary';
import { GallaCashbookView } from './GallaCashbookView';
import { BottomSpatialDock, type DockDestination } from './layout/BottomSpatialDock';
import { DynamicIslandHeader, type DynamicIslandToast } from './layout/DynamicIslandHeader';
import { PartyStatementView } from './ledger/PartyStatementView';
import { ParchiScannerModal } from './ParchiScannerModal';
import { PersonaOnboardingSheet } from './PersonaOnboardingSheet';
import { OfflineIndicator } from './PwaControls';
import {
  AccountSummaryView,
  BusinessProfileView,
  HelpSupportView,
  MultiDeviceView,
  NotificationsDrawer,
  PinLockOverlay,
  SettingsView,
  type SecondaryRoute,
  type ThemeAccentId,
} from './SecondaryViews';
import { StaffAuditView } from './StaffAuditView';
import { StockView } from './StockView';
import { VoiceMunimSheet } from './voice/VoiceMunimSheet';

type NotifPrefsMap = Record<string, { read?: boolean; fav?: boolean }>;

function readPreloginPrefs(): {
  language?: LanguageCode;
  appearance?: AppearanceMode;
  mobileNumber?: string;
} {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      localStorage.getItem('ucred_prelogin_prefs') ||
      localStorage.getItem('bolbahi_prelogin_prefs');
    if (!raw) return {};
    return JSON.parse(raw) as {
      language?: LanguageCode;
      appearance?: AppearanceMode;
      mobileNumber?: string;
    };
  } catch {
    return {};
  }
}

function needsRecentSignIn(lastSignInTime?: string): boolean {
  const lastSignInMs = lastSignInTime ? Date.parse(lastSignInTime) : 0;
  return !lastSignInMs || Date.now() - lastSignInMs > 4 * 60 * 1000;
}

function BolBahiAppInner() {
  // Instant Guest Vault loaded synchronously on client mount (zero forced login wall)
  const [guestVault, setGuestVault] = useState<GuestVaultState>(() =>
    loadGuestVault(readPreloginPrefs())
  );
  const guestVaultRef = useRef<GuestVaultState>(guestVault);

  const updateGuestVault = (updater: (prev: GuestVaultState) => GuestVaultState): GuestVaultState => {
    const next = saveGuestVault(updater(guestVaultRef.current));
    guestVaultRef.current = next;
    setGuestVault(next);
    return next;
  };

  // Firebase Auth & Cloud state (completely optional)
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoadedForUid, setBusinessesLoadedForUid] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [bills, setBills] = useState<BillDocument[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Optional Multi-Auth Cloud Sync Bottom Sheet state (Google + Email Link + Mobile OTP)
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const [syncPhoneInput, setSyncPhoneInput] = useState(
    () => guestVault.profile.mobileNumber || ''
  );
  const [syncEmailInput, setSyncEmailInput] = useState('');
  const [emailLinkSentTo, setEmailLinkSentTo] = useState('');
  const [showPhoneOtpInSync, setShowPhoneOtpInSync] = useState(false);
  const [emailConfirmPrompt, setEmailConfirmPrompt] = useState(false);
  const [emailConfirmInput, setEmailConfirmInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // PIN lock & OTP re-auth state
  const [pinUnlocked, setPinUnlocked] = useState(true);
  const [reauthOtpTarget, setReauthOtpTarget] = useState<'delete-account' | 'forgot-pin' | null>(
    null
  );
  const [reauthOtpCode, setReauthOtpCode] = useState('');
  const [reauthOtpSent, setReauthOtpSent] = useState(false);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState('');
  const authFlowBusyRef = useRef(false);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefsMap>({});
  const [bizSwitcherOpen, setBizSwitcherOpen] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [creatingBiz, setCreatingBiz] = useState(false);

  // Multi-Select Persona Mode & First-Launch Onboarding (Zero Forced Login)
  const [personaPrefs, setPersonaPrefs] = useState<PersonaPrefs>(() => loadPersonaPrefs());
  const [personaOnboardingOpen, setPersonaOnboardingOpen] = useState<boolean>(
    () => !loadPersonaPrefs().onboarded
  );
  const [personaOnboardingStep, setPersonaOnboardingStep] = useState<1 | 2 | 3>(1);
  const [showAllModes, setShowAllModes] = useState(false);

  // Voice, Counter Mode, AI Parchi Scanner & Bill Drafts
  const [hideBalance, setHideBalance] = useState(false);
  const [accentTheme, setAccentTheme] = useState<ThemeAccentId>(() => {
    if (typeof window === 'undefined') return 'sapphire';
    try {
      const saved = localStorage.getItem('ucred_accent_theme_v1');
      if (saved === 'rose' || saved === 'onyx' || saved === 'sapphire') return saved;
    } catch {
      // Ignore storage read errors
    }
    return 'sapphire';
  });
  const [recentlyUpdatedAccountId, setRecentlyUpdatedAccountId] = useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceCounterMode, setVoiceCounterMode] = useState(false);
  const [voicePrefillName, setVoicePrefillName] = useState('');
  const [parchiScannerOpen, setParchiScannerOpen] = useState(false);
  const [billPrefill, setBillPrefill] = useState<{ name: string; phone: string } | null>(null);
  const [billDraft, setBillDraft] = useState<BillExternalDraft | null>(null);
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);

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
  const recentHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLaunchRef = useRef<{ action?: string | null; tab?: string | null } | null>(null);

  // Determine whether app is currently running in Instant Guest Mode or Cloud Synced Mode
  const isCloudReady = Boolean(user && businessesLoadedForUid === user.uid && businesses.length > 0);
  const isGuestMode = !isCloudReady;

  const language: LanguageCode = isGuestMode
    ? guestVault.profile.language
    : profile?.language || guestVault.profile.language;
  const appearance: AppearanceMode = isGuestMode
    ? guestVault.profile.appearance
    : profile?.appearance === 'dark'
      ? 'dark'
      : 'light';
  const mobileNumber: string = isGuestMode
    ? guestVault.profile.mobileNumber
    : profile?.mobileNumber || guestVault.profile.mobileNumber;
  const appLockPin: string = isGuestMode
    ? guestVault.profile.appLockPin
    : profile?.appLockPin || '';

  const activeBusinesses = useMemo(
    () => (isGuestMode ? guestVault.businesses : businesses),
    [isGuestMode, guestVault.businesses, businesses]
  );

  const currentBusiness: Business = useMemo(() => {
    const targetId = isGuestMode
      ? guestVault.profile.activeBusinessId
      : profile?.activeBusinessId;
    return activeBusinesses.find((b) => b.id === targetId) || activeBusinesses[0];
  }, [isGuestMode, guestVault.profile.activeBusinessId, profile?.activeBusinessId, activeBusinesses]);

  const activeAccounts = useMemo(
    () =>
      isGuestMode
        ? guestVault.accounts.filter((a) => a.businessId === currentBusiness.id)
        : accounts,
    [isGuestMode, guestVault.accounts, currentBusiness.id, accounts]
  );

  const activeTransactions = useMemo(
    () =>
      isGuestMode
        ? guestVault.transactions.filter((t) => t.businessId === currentBusiness.id)
        : transactions,
    [isGuestMode, guestVault.transactions, currentBusiness.id, transactions]
  );

  const activeBills = useMemo(
    () =>
      isGuestMode
        ? guestVault.bills.filter((b) => b.businessId === currentBusiness.id)
        : bills,
    [isGuestMode, guestVault.bills, currentBusiness.id, bills]
  );

  const activeStockItems = useMemo(
    () =>
      isGuestMode
        ? guestVault.stockItems.filter((s) => s.businessId === currentBusiness.id)
        : stockItems,
    [isGuestMode, guestVault.stockItems, currentBusiness.id, stockItems]
  );

  const activeCashbookEntries = useMemo(
    () =>
      isGuestMode
        ? guestVault.cashbookEntries.filter((c) => c.businessId === currentBusiness.id)
        : cashbookEntries,
    [isGuestMode, guestVault.cashbookEntries, currentBusiness.id, cashbookEntries]
  );

  const activeStaffMembers = useMemo(
    () =>
      isGuestMode
        ? guestVault.staffMembers.filter((s) => s.businessId === currentBusiness.id)
        : staffMembers,
    [isGuestMode, guestVault.staffMembers, currentBusiness.id, staffMembers]
  );

  const activeActivityLogs = useMemo(
    () =>
      isGuestMode
        ? guestVault.activityLogs.filter((l) => l.businessId === currentBusiness.id)
        : activityLogs,
    [isGuestMode, guestVault.activityLogs, currentBusiness.id, activityLogs]
  );

  // Strict Persona Feature Gating + Unified Mode-Scoped Records + 60fps Spatial Scroll Physics
  const {
    adaptation: personaAdaptation,
    capabilities,
    scopedAccounts,
    scopedTransactions,
  } = usePersonaGate(personaPrefs, activeAccounts, activeTransactions, showAllModes);

  const spatialMotion = useSpatialMotion(mainScrollRef);
  const scopedCashflow = useMemo(() => computeNetCashflowSummary(scopedAccounts), [scopedAccounts]);

  useEffect(() => {
    guestVaultRef.current = guestVault;
  }, [guestVault]);

  useEffect(() => {
    if (guestVault.profile.appLockPin) {
      Promise.resolve().then(() => setPinUnlocked(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (recentHighlightTimerRef.current) clearTimeout(recentHighlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = setInterval(() => {
      setOtpResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [otpResendCooldown]);

  useEffect(() => {
    return () => {
      try {
        recaptchaVerifierRef.current?.clear();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Merge local guest records into Firestore when authenticating
  const mergeGuestVaultIntoFirestore = async (
    uid: string,
    phoneDigits: string,
    existingProfile: UserProfile | null
  ): Promise<UserProfile> => {
    const localSnapshot = loadGuestVault();
    const hasRecords = hasGuestRecordsToSync(localSnapshot);
    let mergedActiveBizId = existingProfile?.activeBusinessId || '';

    if (hasRecords || !existingProfile?.onboardingDone) {
      for (const guestBiz of localSnapshot.businesses) {
        const bizAccs = localSnapshot.accounts.filter((a) => a.businessId === guestBiz.id);
        const bizTxs = localSnapshot.transactions.filter((t) => t.businessId === guestBiz.id);
        const bizBills = localSnapshot.bills.filter((b) => b.businessId === guestBiz.id);
        const bizStock = localSnapshot.stockItems.filter((s) => s.businessId === guestBiz.id);
        const bizCb = localSnapshot.cashbookEntries.filter((c) => c.businessId === guestBiz.id);
        const bizStaff = localSnapshot.staffMembers.filter((s) => s.businessId === guestBiz.id);

        const isUntouchedStarter =
          existingProfile?.onboardingDone &&
          guestBiz.name === 'My Store' &&
          !guestBiz.upiId &&
          !guestBiz.gstNumber &&
          !guestBiz.address &&
          bizAccs.length === 0 &&
          bizTxs.length === 0 &&
          bizBills.length === 0 &&
          bizStock.length === 0 &&
          bizCb.length === 0 &&
          bizStaff.length === 0;

        if (isUntouchedStarter) continue;

        const createdBiz = await createBusiness(uid, {
          name: guestBiz.name || 'My Store',
          phone: guestBiz.phone || phoneDigits,
          upiId: guestBiz.upiId,
        });

        if (
          guestBiz.gstNumber ||
          guestBiz.businessType ||
          guestBiz.category ||
          guestBiz.address ||
          guestBiz.email ||
          guestBiz.about
        ) {
          await updateBusiness(createdBiz.id, {
            gstNumber: guestBiz.gstNumber,
            businessType: guestBiz.businessType,
            category: guestBiz.category,
            address: guestBiz.address,
            email: guestBiz.email,
            about: guestBiz.about,
          });
        }

        if (
          bizAccs.length > 0 ||
          bizTxs.length > 0 ||
          bizBills.length > 0 ||
          bizStock.length > 0 ||
          bizCb.length > 0
        ) {
          await restoreBusinessBackup(uid, createdBiz.id, {
            accounts: bizAccs,
            transactions: bizTxs,
            bills: bizBills,
            stockItems: bizStock,
            cashbookEntries: bizCb,
          });
        }

        for (const st of bizStaff) {
          await saveStaffMember({
            ownerId: uid,
            businessId: createdBiz.id,
            name: st.name,
            role: st.role,
            phone: st.phone,
            pinHash: st.pinHash,
            active: st.active,
          });
        }

        if (guestBiz.id === localSnapshot.profile.activeBusinessId || !mergedActiveBizId) {
          mergedActiveBizId = createdBiz.id;
        }
      }
    }

    const saved = await upsertUserProfile(uid, {
      mobileNumber: phoneDigits || existingProfile?.mobileNumber || localSnapshot.profile.mobileNumber || '',
      language: localSnapshot.profile.language || existingProfile?.language || 'en',
      appearance: localSnapshot.profile.appearance || existingProfile?.appearance || 'light',
      ...(mergedActiveBizId ? { activeBusinessId: mergedActiveBizId } : {}),
      onboardingDone: true,
    });

    clearGuestVault();
    const freshGuest = loadGuestVault({
      language: saved.language,
      appearance: saved.appearance,
      mobileNumber: saved.mobileNumber,
    });
    guestVaultRef.current = freshGuest;
    setGuestVault(freshGuest);
    return saved;
  };

  // Register Service Worker, hydrate notification prefs, and capture PWA shortcut params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => reg.update().catch(() => {}))
          .catch(() => {});
      }
      const params = new URLSearchParams(window.location.search);
      const actionParam = params.get('action');
      const tabParam = params.get('tab');
      const autostartParam = params.get('autostart');
      if (actionParam || tabParam) {
        pendingLaunchRef.current = { action: actionParam, tab: tabParam };
      }
      if (autostartParam === '1') {
        Promise.resolve().then(() => {
          const saved = savePersonaPrefs({ ...loadPersonaPrefs(), onboarded: true });
          setPersonaPrefs(saved);
          setPersonaOnboardingOpen(false);
        });
      }

      Promise.resolve().then(() => {
        try {
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

      // Handle Passwordless Email Verification Link return
      if (isSignInWithEmailLink(auth, window.location.href)) {
        const pendingEmail = (() => {
          try {
            return localStorage.getItem('ucred_email_link_pending') || '';
          } catch {
            return '';
          }
        })();
        if (pendingEmail) {
          authFlowBusyRef.current = true;
          signInWithEmailLink(auth, pendingEmail, window.location.href)
            .then(async (cred) => {
              try {
                localStorage.removeItem('ucred_email_link_pending');
              } catch {
                // Ignore storage cleanup error
              }
              window.history.replaceState(null, '', '/');
              const existing = await getUserProfile(cred.user.uid);
              const saved = await mergeGuestVaultIntoFirestore(
                cred.user.uid,
                mobileNumber,
                existing
              );
              setProfile(saved);
              if (!saved.appLockPin) setPinUnlocked(true);
              setPersonaOnboardingStep((prev) => (prev === 2 ? 3 : prev));
            })
            .catch((err) => {
              setAuthError(
                err instanceof Error ? err.message : 'Email verification link expired or invalid.'
              );
            })
            .finally(() => {
              authFlowBusyRef.current = false;
            });
        } else {
          Promise.resolve().then(() => setEmailConfirmPrompt(true));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply Light / Dark mode + Accent Theme on documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (accentTheme === 'rose') {
      root.setAttribute('data-accent', 'rose');
    } else {
      root.removeAttribute('data-accent');
    }
    root.classList.toggle('dark', appearance === 'dark');
  }, [appearance, accentTheme]);

  // Background Firebase Auth listener (never blocks Guest Mode entry)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setBusinesses([]);
        setBusinessesLoadedForUid(null);
        setAccounts([]);
        setTransactions([]);
        setBills([]);
        setStockItems([]);
        setCashbookEntries([]);
        setStaffMembers([]);
        setActivityLogs([]);
        setOtpSentTo(null);
        confirmationResultRef.current = null;
        return;
      }

      testConnection().catch(() => {});
      if (authFlowBusyRef.current) return;

      const authPhoneDigits = (fbUser.phoneNumber || '')
        .replace(/^\+91/, '')
        .replace(/\D/g, '')
        .slice(-10);

      try {
        setAuthError('');
        const existing = await getUserProfile(fbUser.uid);
        if (existing && existing.onboardingDone) {
          setProfile(existing);
          if (!existing.appLockPin) setPinUnlocked(true);
          else setPinUnlocked(false);
        } else {
          const merged = await mergeGuestVaultIntoFirestore(
            fbUser.uid,
            authPhoneDigits,
            existing
          );
          setProfile(merged);
          setPinUnlocked(!merged.appLockPin);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to sync cloud profile.');
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to user's Firestore businesses when signed in
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeBusinesses(user.uid, async (rows) => {
      if (rows.length === 0) {
        try {
          const created = await createBusiness(user.uid, {
            name: guestVaultRef.current.businesses[0]?.name || 'My Store',
            phone: mobileNumber,
          });
          const updated = await upsertUserProfile(user.uid, {
            activeBusinessId: created.id,
            onboardingDone: true,
          });
          setProfile(updated);
          return;
        } catch {
          // Wait for retry
        }
      }
      setBusinesses(rows);
      setBusinessesLoadedForUid(user.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const cloudActiveBusiness: Business | null = useMemo(() => {
    if (!isCloudReady) return null;
    const matched = businesses.find((b) => b.id === profile?.activeBusinessId);
    return matched || businesses[0] || null;
  }, [isCloudReady, businesses, profile?.activeBusinessId]);

  // Subscribe to active Firestore business collections when Cloud Ready
  useEffect(() => {
    if (!user || !cloudActiveBusiness?.id) return;
    const bizId = cloudActiveBusiness.id;
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
  }, [user, cloudActiveBusiness?.id]);

  // Deterministic Intelligence Computations
  const trustScoresByAccount = useMemo<Record<string, CustomerTrustScore>>(() => {
    const todayStr = getLocalDateKey();
    const txByAcc = new Map<string, LedgerTransaction[]>();
    for (const tx of activeTransactions) {
      const arr = txByAcc.get(tx.accountId);
      if (arr) arr.push(tx);
      else txByAcc.set(tx.accountId, [tx]);
    }
    const map: Record<string, CustomerTrustScore> = {};
    for (const acc of activeAccounts) {
      map[acc.id] = computeCustomerTrustScore(acc, txByAcc.get(acc.id) || [], todayStr);
    }
    return map;
  }, [activeAccounts, activeTransactions]);

  const gallaPulse = useMemo(
    () =>
      computeDailyGallaPulse({
        todayStr: getLocalDateKey(),
        cashbookEntries: activeCashbookEntries,
        transactions: activeTransactions,
        bills: activeBills,
        stockItems: activeStockItems,
      }),
    [activeCashbookEntries, activeTransactions, activeBills, activeStockItems]
  );

  const persistPrelogin = (next: {
    language?: LanguageCode;
    appearance?: AppearanceMode;
    mobileNumber?: string;
  }) => {
    try {
      const merged = {
        language,
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
    if (isGuestMode) {
      updateGuestVault((prev) =>
        applyRecordActivityLog(prev, {
          businessId: currentBusiness.id,
          actorName: activeOperator.name,
          actorRole: activeOperator.role,
          actionType,
          summary,
          targetName,
          amount,
        })
      );
      return;
    }
    if (!user || !currentBusiness) return;
    recordActivityLog({
      ownerId: user.uid,
      businessId: currentBusiness.id,
      actorName: activeOperator.name,
      actorRole: activeOperator.role,
      actionType,
      summary,
      targetName,
      amount,
    }).catch(() => {});
  };

  const handleSelectLanguage = async (lang: LanguageCode) => {
    persistPrelogin({ language: lang });
    if (isGuestMode) {
      updateGuestVault((prev) => ({
        ...prev,
        profile: { ...prev.profile, language: lang },
      }));
      return;
    }
    if (user) {
      try {
        const updated = await upsertUserProfile(user.uid, { language: lang });
        setProfile(updated);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to save language preference.');
      }
    }
  };

  const handleSetAppearance = async (nextMode: AppearanceMode) => {
    persistPrelogin({ appearance: nextMode });
    if (isGuestMode) {
      updateGuestVault((prev) => ({
        ...prev,
        profile: { ...prev.profile, appearance: nextMode },
      }));
      return;
    }
    if (user) {
      try {
        const updated = await upsertUserProfile(user.uid, { appearance: nextMode });
        setProfile(updated);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to save theme preference.');
      }
    }
  };

  const handleToggleAppearance = async () => {
    const nextMode: AppearanceMode = appearance === 'dark' ? 'light' : 'dark';
    const nextAccent: ThemeAccentId =
      nextMode === 'dark' ? 'onyx' : accentTheme === 'onyx' ? 'sapphire' : accentTheme;
    setAccentTheme(nextAccent);
    try {
      localStorage.setItem('ucred_accent_theme_v1', nextAccent);
    } catch {
      // Ignore storage write errors
    }
    await handleSetAppearance(nextMode);
  };

  const handleSelectAccentTheme = async (next: ThemeAccentId) => {
    setAccentTheme(next);
    try {
      localStorage.setItem('ucred_accent_theme_v1', next);
    } catch {
      // Ignore storage write errors
    }
    await handleSetAppearance(next === 'onyx' ? 'dark' : 'light');
  };

  const triggerAccountHighlight = (accountId: string) => {
    if (recentHighlightTimerRef.current) clearTimeout(recentHighlightTimerRef.current);
    setRecentlyUpdatedAccountId(accountId);
    recentHighlightTimerRef.current = setTimeout(() => {
      setRecentlyUpdatedAccountId(null);
    }, 1800);
  };

  const formatFirebasePhoneError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (msg.includes('operation-not-allowed')) {
      return 'Phone OTP sign-in is disabled in Firebase Console. Enable Phone under Authentication → Sign-in method.';
    }
    if (msg.includes('invalid-phone-number')) {
      return 'Please enter a valid 10-digit Indian mobile number.';
    }
    if (msg.includes('too-many-requests')) {
      return 'Too many OTP requests. Please wait a minute before trying again.';
    }
    if (msg.includes('captcha-check-failed') || msg.includes('missing-client-identifier')) {
      return 'Verification token expired. Please tap Send OTP again.';
    }
    if (msg.includes('invalid-verification-code')) {
      return 'Incorrect 6-digit OTP. Check the SMS and try again.';
    }
    if (msg.includes('code-expired')) {
      return 'OTP expired. Tap Resend OTP for a fresh 6-digit code.';
    }
    return msg || 'Phone verification failed. Please try again.';
  };

  const getOrResetRecaptchaVerifier = (): RecaptchaVerifier => {
    if (typeof document === 'undefined') {
      throw new Error('Verification is only supported in the browser.');
    }
    const container = document.getElementById('ucred-recaptcha-container');
    if (!container) {
      throw new Error('Security check container missing. Please refresh the page.');
    }
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {
      // Ignore prior clear error
    }
    container.innerHTML = '';
    const verifier = new RecaptchaVerifier(auth, 'ucred-recaptcha-container', {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendOtp = async (phoneDigits: string) => {
    setAuthError('');
    setSyncSuccessMsg('');
    const check = indianMobileSchema.safeParse(phoneDigits.replace(/\D/g, ''));
    if (!check.success) {
      setAuthError(check.error.issues[0]?.message || 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setAuthBusy(true);
    try {
      const e164 = `+91${check.data}`;
      const verifier = getOrResetRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, e164, verifier);
      confirmationResultRef.current = confirmation;
      setSyncPhoneInput(check.data);
      persistPrelogin({ mobileNumber: check.data });
      updateGuestVault((prev) => ({
        ...prev,
        profile: { ...prev.profile, mobileNumber: check.data },
      }));
      setOtpInput('');
      setOtpSentTo(e164);
      setOtpResendCooldown(30);
    } catch (err) {
      try {
        recaptchaVerifierRef.current?.clear();
      } catch {
        // Ignore clear error
      }
      setAuthError(formatFirebasePhoneError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (!confirmationResultRef.current) {
      setAuthError('OTP session expired. Please request a fresh OTP.');
      return;
    }
    const cleanOtp = code.replace(/\D/g, '').slice(0, 6);
    const otpCheck = otpCodeSchema.safeParse(cleanOtp);
    if (!otpCheck.success) {
      setAuthError(otpCheck.error.issues[0]?.message || 'Enter the 6-digit SMS OTP.');
      return;
    }
    setAuthError('');
    setAuthBusy(true);
    authFlowBusyRef.current = true;
    try {
      const cred = await confirmationResultRef.current.confirm(cleanOtp);
      const fbUser = cred.user;
      const phoneDigits =
        (fbUser.phoneNumber || '').replace(/^\+91/, '').replace(/\D/g, '').slice(-10) ||
        syncPhoneInput ||
        mobileNumber;
      const existing = await getUserProfile(fbUser.uid);
      const saved = await mergeGuestVaultIntoFirestore(fbUser.uid, phoneDigits, existing);
      setProfile(saved);
      setOtpSentTo(null);
      setOtpInput('');
      confirmationResultRef.current = null;
      if (!saved.appLockPin) setPinUnlocked(true);
      setSyncSuccessMsg('Cloud Synced! All local entries safely backed up.');
      setTimeout(() => {
        setSyncSheetOpen(false);
        setSyncSuccessMsg('');
        setPersonaOnboardingStep((prev) => (prev === 2 ? 3 : prev));
      }, 1300);
    } catch (err) {
      setAuthError(formatFirebasePhoneError(err));
    } finally {
      authFlowBusyRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleResetOtp = () => {
    confirmationResultRef.current = null;
    setOtpSentTo(null);
    setOtpInput('');
    setOtpResendCooldown(0);
    setAuthError('');
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setSyncSuccessMsg('');
    setAuthBusy(true);
    authFlowBusyRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const fbUser = cred.user;
      const phoneDigits =
        (fbUser.phoneNumber || '').replace(/^\+91/, '').replace(/\D/g, '').slice(-10) ||
        syncPhoneInput ||
        mobileNumber;
      const existing = await getUserProfile(fbUser.uid);
      const saved = await mergeGuestVaultIntoFirestore(fbUser.uid, phoneDigits, existing);
      setProfile(saved);
      if (!saved.appLockPin) setPinUnlocked(true);
      setSyncSuccessMsg('Google Cloud Sync connected!');
      setTimeout(() => {
        setSyncSheetOpen(false);
        setSyncSuccessMsg('');
        setPersonaOnboardingStep((prev) => (prev === 2 ? 3 : prev));
      }, 1100);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err || '');
      if (code.includes('popup-closed-by-user')) {
        setAuthError('Google sign-in cancelled.');
      } else if (code.includes('popup-blocked')) {
        setAuthError('Browser blocked pop-up. Allow pop-ups or use Email Verification Link below.');
      } else if (code.includes('operation-not-allowed')) {
        setAuthError('Google sign-in is disabled in Firebase Console. Enable Google under Authentication.');
      } else {
        setAuthError(code || 'Google sign-in failed. Please try again.');
      }
    } finally {
      authFlowBusyRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleSendEmailLink = async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('Enter a valid email address.');
      return;
    }
    setAuthError('');
    setSyncSuccessMsg('');
    setAuthBusy(true);
    try {
      const actionCodeSettings = {
        url: typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://ucred.app/',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      try {
        localStorage.setItem('ucred_email_link_pending', cleanEmail);
      } catch {
        // Ignore storage write errors
      }
      setSyncEmailInput(cleanEmail);
      setEmailLinkSentTo(cleanEmail);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err || '');
      if (code.includes('operation-not-allowed')) {
        setAuthError('Email link sign-in is disabled in Firebase Console. Enable Email Link under Authentication.');
      } else {
        setAuthError(code || 'Could not send verification link.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleConfirmCrossBrowserEmailLink = async () => {
    const cleanEmail = emailConfirmInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('Enter the exact email address where you received the sign-in link.');
      return;
    }
    setAuthError('');
    setAuthBusy(true);
    authFlowBusyRef.current = true;
    try {
      const cred = await signInWithEmailLink(auth, cleanEmail, window.location.href);
      window.history.replaceState(null, '', '/');
      const existing = await getUserProfile(cred.user.uid);
      const saved = await mergeGuestVaultIntoFirestore(cred.user.uid, mobileNumber, existing);
      setProfile(saved);
      if (!saved.appLockPin) setPinUnlocked(true);
      setEmailConfirmPrompt(false);
      setEmailConfirmInput('');
      setPersonaOnboardingStep((prev) => (prev === 2 ? 3 : prev));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Email link verification failed.');
    } finally {
      authFlowBusyRef.current = false;
      setAuthBusy(false);
    }
  };

  const startOtpReauthFlow = async (target: 'delete-account' | 'forgot-pin') => {
    if (!user?.phoneNumber) {
      throw new Error('Verified mobile number not found on session. Please log in again.');
    }
    setReauthError('');
    setReauthOtpCode('');
    setReauthOtpSent(false);
    setReauthOtpTarget(target);
    setReauthBusy(true);
    try {
      const verifier = getOrResetRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, user.phoneNumber, verifier);
      confirmationResultRef.current = confirmation;
      setReauthOtpSent(true);
    } catch (err) {
      setReauthError(formatFirebasePhoneError(err));
    } finally {
      setReauthBusy(false);
    }
  };

  const handleConfirmOtpReauth = async () => {
    if (!user || !confirmationResultRef.current) {
      setReauthError('OTP session expired. Request a new code.');
      return;
    }
    if (!/^\d{6}$/.test(reauthOtpCode.trim())) {
      setReauthError('Enter the 6-digit OTP sent to your mobile.');
      return;
    }
    setReauthError('');
    setReauthBusy(true);
    try {
      const credential = PhoneAuthProvider.credential(
        confirmationResultRef.current.verificationId,
        reauthOtpCode.trim()
      );
      await reauthenticateWithCredential(user, credential);
      const target = reauthOtpTarget;
      confirmationResultRef.current = null;

      if (target === 'forgot-pin') {
        const updated = await upsertUserProfile(user.uid, { appLockPin: '' });
        setProfile(updated);
        setPinUnlocked(true);
        setReauthOtpTarget(null);
        return;
      }

      if (target === 'delete-account') {
        await deleteUserAccountCascade(user.uid);
        await deleteUser(user);
        clearGuestVault();
        try {
          localStorage.removeItem('ucred_prelogin_prefs');
          localStorage.removeItem('ucred_notif_prefs');
        } catch {
          // Ignore storage removal errors
        }
        setReauthOtpTarget(null);
        setSecondaryRoute(null);
        setSelectedAccountId(null);
      }
    } catch (err) {
      setReauthError(formatFirebasePhoneError(err));
    } finally {
      setReauthBusy(false);
    }
  };

  const handleSwitchBusiness = async (bizId: string) => {
    setSelectedAccountId(null);
    setActiveOperator({ staffId: 'owner', name: 'Shop Owner', role: 'owner' });
    if (isGuestMode) {
      updateGuestVault((prev) => ({
        ...prev,
        profile: { ...prev.profile, activeBusinessId: bizId },
      }));
      setBizSwitcherOpen(false);
      return;
    }
    if (!user) return;
    const updated = await upsertUserProfile(user.uid, { activeBusinessId: bizId });
    setProfile(updated);
    setBizSwitcherOpen(false);
  };

  const handleCreateExtraBusiness = async () => {
    if (!newBizName.trim()) return;
    setCreatingBiz(true);
    try {
      if (isGuestMode) {
        updateGuestVault(
          (prev) =>
            applyCreateBusiness(prev, {
              name: newBizName.trim(),
              phone: mobileNumber,
            }).vault
        );
        setNewBizName('');
        setSelectedAccountId(null);
        setBizSwitcherOpen(false);
        return;
      }
      if (!user) return;
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
        activeAccounts.find((a) => a.id === current.account.id) || current.account;
      if (current.kind === 'added') {
        const remaining = activeTransactions.filter(
          (item) => item.accountId === liveAccount.id && item.id !== current.tx.id
        );
        if (isGuestMode) {
          if (current.accountCreated && remaining.length === 0) {
            updateGuestVault((prev) =>
              applyDeleteAccountWithTransactions(prev, liveAccount.id)
            );
            if (selectedAccountId === liveAccount.id) setSelectedAccountId(null);
          } else {
            updateGuestVault((prev) =>
              applyDeleteTransactionAtomic(prev, { tx: current.tx, account: liveAccount })
            );
          }
        } else {
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
        }
        logActivity(
          'ledger',
          `Undid ₹${current.tx.amount} entry for ${liveAccount.name}`,
          liveAccount.name,
          current.tx.amount
        );
      } else {
        if (isGuestMode) {
          updateGuestVault((prev) =>
            applyRestoreTransactionAtomic(prev, { tx: current.tx, account: liveAccount })
          );
        } else {
          const existing = activeTransactions.filter((item) => item.accountId === liveAccount.id);
          await restoreTransactionAtomic({
            tx: current.tx,
            account: liveAccount,
            existingForAccount: existing,
          });
        }
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
    for (const tx of scopedTransactions) {
      if ((tx.billDate || '').startsWith(todayKey)) {
        if (tx.direction === 'given') givenToday += tx.amount;
        else receivedToday += tx.amount;
      }
    }
    const overdueCount = scopedAccounts.filter(
      (a) => a.kind === 'customer' && a.balance > 0 && a.dueDate && a.dueDate <= todayKey
    ).length;
    const lowStockCount = capabilities.showStock
      ? activeStockItems.filter((s) => s.quantity <= (s.lowStockThreshold ?? 5)).length
      : 0;
    return {
      todayKey,
      givenToday,
      receivedToday,
      netToday: receivedToday - givenToday,
      overdueCount,
      lowStockCount,
    };
  }, [scopedAccounts, scopedTransactions, activeStockItems, capabilities.showStock]);

  const notifications: AppNotificationItem[] = useMemo(() => {
    const items: AppNotificationItem[] = [];
    const overdueAccs = scopedAccounts.filter(
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
          'Send a 1-Click WhatsApp reminder now.',
        ],
        actionLabel: capabilities.focus === 'personal' ? 'Open Notes' : 'Open Collection',
        targetAction: 'collection',
        read: Boolean(notifPrefs['live-overdue']?.read),
        fav: Boolean(notifPrefs['live-overdue']?.fav),
        timeLabel: 'Action needed',
      });
    }

    const highRiskAccs = scopedAccounts.filter(
      (a) =>
        a.kind === 'customer' &&
        a.balance > 0 &&
        (trustScoresByAccount[a.id]?.score ?? 100) < 50
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

    if (!currentBusiness?.upiId) {
      items.push({
        id: 'live-upi-setup',
        title: 'Add Shop UPI ID for Instant QR',
        bullets: [
          'Embed live UPI payment QR codes in WhatsApp reminders and payment slips.',
        ],
        actionLabel: 'Set UPI ID',
        targetAction: 'upi',
        read: Boolean(notifPrefs['live-upi-setup']?.read),
        fav: Boolean(notifPrefs['live-upi-setup']?.fav),
        timeLabel: 'Setup tip',
      });
    }

    if (capabilities.focus !== 'personal') {
      items.push({
        id: 'tip-parchi-scanner',
        title: 'Scan Handwritten Receipt with AI',
        bullets: [
          'Snap any handwritten slip or supplier bill to auto-extract party, items & ₹ total.',
        ],
        actionLabel: 'Open Scanner',
        targetAction: 'parchi',
        read: Boolean(notifPrefs['tip-parchi-scanner']?.read),
        fav: Boolean(notifPrefs['tip-parchi-scanner']?.fav),
        timeLabel: 'Ucred AI',
      });
    }

    items.push({
      id: 'tip-voice-entry',
      title:
        capabilities.focus === 'personal'
          ? 'Voice Munim · Hands-Free Voice'
          : 'Hands-Free Counter Mode & AI Voice Bills',
      bullets: [
        capabilities.focus === 'personal'
          ? 'Say "Rahul 500 udhaar aur Amit 300 mila" to record instantly.'
          : 'Say "Ramesh 500 udhaar aur Suresh 300 mila" or "Ramesh ka bill 2kg chini 90".',
      ],
      actionLabel: 'Try Voice Entry',
      targetAction: 'voice',
      read: Boolean(notifPrefs['tip-voice-entry']?.read),
      fav: Boolean(notifPrefs['tip-voice-entry']?.fav),
      timeLabel: 'Voice Munim',
    });

    return items;
  }, [
    scopedAccounts,
    currentBusiness?.upiId,
    dailyStats.todayKey,
    notifPrefs,
    trustScoresByAccount,
    capabilities.focus,
  ]);

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

  // Apply deep-linked PWA shortcuts (?action=voice|parchi|counter or ?tab=bills|galla|...) immediately
  const shellReady = Boolean(currentBusiness) && (!appLockPin || pinUnlocked);

  useEffect(() => {
    if (!shellReady || !pendingLaunchRef.current) return;
    const { action, tab } = pendingLaunchRef.current;
    pendingLaunchRef.current = null;
    const timer = setTimeout(() => {
      if (tab === 'galla' && capabilities.showGalla) {
        setSelectedAccountId(null);
        setSecondaryRoute('galla');
      } else if (
        (tab === 'bills' && capabilities.showGstBills) ||
        (tab === 'stock' && capabilities.showStock) ||
        tab === 'collection' ||
        tab === 'ledger'
      ) {
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
      } else if (action === 'parchi' && capabilities.focus !== 'personal') {
        setParchiScannerOpen(true);
      }
      if (typeof window !== 'undefined' && window.location.search) {
        window.history.replaceState(null, '', '/');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [shellReady, capabilities.showGalla, capabilities.showGstBills, capabilities.showStock, capabilities.focus]);

  const openDailyMunimSummary = () => {
    const shopName = currentBusiness?.name || 'My Store';
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
      if (syncSheetOpen && !authBusy) setSyncSheetOpen(false);
      else if (dailySummaryOpen) closeDailyMunimSummary();
      else if (bizSwitcherOpen) setBizSwitcherOpen(false);
      else if (notifOpen) setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncSheetOpen, authBusy, dailySummaryOpen, bizSwitcherOpen, notifOpen]);

  // Android hardware Back / browser popstate handling for nested views
  const hasNestedLayer = Boolean(
    voiceModalOpen ||
      parchiScannerOpen ||
      dailySummaryOpen ||
      bizSwitcherOpen ||
      notifOpen ||
      syncSheetOpen ||
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
      else if (syncSheetOpen) setSyncSheetOpen(false);
      else if (dailySummaryOpen) closeDailyMunimSummary();
      else if (bizSwitcherOpen) setBizSwitcherOpen(false);
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
    syncSheetOpen,
    dailySummaryOpen,
    bizSwitcherOpen,
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
    const match =
      scopedAccounts.find(
        (a) => a.name.toLowerCase() === entry.customerName.trim().toLowerCase()
      ) ||
      activeAccounts.find(
        (a) =>
          (!a.personaContext || a.personaContext === personaAdaptation.activeFocus) &&
          a.name.toLowerCase() === entry.customerName.trim().toLowerCase()
      );
    const resolvedKind: AccountKind = capabilities.showSuppliers
      ? match?.kind || entry.kind
      : 'customer';
    const composedNote = entry.note
      ? entry.note
      : entry.voiceRaw
        ? `Voice: ${entry.voiceRaw}`
        : '';

    if (isGuestMode) {
      const res = applyAddTransactionAtomic(guestVaultRef.current, {
        businessId: currentBusiness.id,
        existingAccount: match || null,
        customerName: entry.customerName,
        kind: resolvedKind,
        personaContext: personaAdaptation.activeFocus,
        direction: entry.direction,
        amount: entry.amount,
        note: composedNote,
        voiceRaw: entry.voiceRaw,
        createdByName: activeOperator.name,
        createdByRole: activeOperator.role,
      });
      const finalVault = applyRecordActivityLog(res.vault, {
        businessId: currentBusiness.id,
        actorName: activeOperator.name,
        actorRole: activeOperator.role,
        actionType: 'ledger',
        summary: `Voice ${entry.direction === 'given' ? 'Credit' : 'Received'} ₹${entry.amount} for ${entry.customerName}`,
        targetName: entry.customerName,
        amount: entry.amount,
      });
      guestVaultRef.current = saveGuestVault(finalVault);
      setGuestVault(guestVaultRef.current);
      haptics.success();
      triggerAccountHighlight(res.accountId);
      showActionToast({
        kind: 'added',
        tx: res.tx,
        account: res.account,
        newBalance: res.newBalance,
        accountCreated: res.accountCreated,
      });
      return { txId: res.txId, accountId: res.accountId };
    }

    if (!user) return;
    const res = await addTransactionAtomic({
      ownerId: user.uid,
      businessId: currentBusiness.id,
      existingAccount: match || null,
      customerName: entry.customerName,
      kind: resolvedKind,
      personaContext: personaAdaptation.activeFocus,
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
          businessId: currentBusiness.id,
          kind: resolvedKind,
          personaContext: personaAdaptation.activeFocus,
          name: entry.customerName,
          phone: '',
          dueDate: '',
          balance: res.newBalance,
          lastNote: res.tx.note,
          lastActivityAt: res.tx.billDate,
        };
    haptics.success();
    triggerAccountHighlight(res.accountId);
    showActionToast({
      kind: 'added',
      tx: res.tx,
      account: accSnapshot,
      newBalance: res.newBalance,
      accountCreated: res.accountCreated,
    });
    logActivity(
      'ledger',
      `Voice ${entry.direction === 'given' ? 'Credit' : 'Received'} ₹${entry.amount} for ${entry.customerName}`,
      entry.customerName,
      entry.amount
    );
    return { txId: res.txId, accountId: res.accountId };
  };

  const handleUndoVoiceQueueItem = async (item: { txId: string; accountId: string }) => {
    const liveAcc = activeAccounts.find((a) => a.id === item.accountId);
    const liveTx = activeTransactions.find((t) => t.id === item.txId);
    if (!liveAcc || !liveTx) return;
    if (isGuestMode) {
      updateGuestVault((prev) =>
        applyDeleteTransactionAtomic(prev, { tx: liveTx, account: liveAcc })
      );
      logActivity(
        'ledger',
        `Queue Undo ₹${liveTx.amount} for ${liveAcc.name}`,
        liveAcc.name,
        liveTx.amount
      );
      return;
    }
    const remaining = activeTransactions.filter(
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

  const handleQuickTransaction = async (
    account: LedgerAccount,
    payload: {
      direction: TxDirection;
      amount: number;
      note: string;
      syncToGalla?: { mode: CashbookMode } | null;
    }
  ) => {
    if (isGuestMode) {
      const res = applyAddTransactionAtomic(guestVaultRef.current, {
        businessId: currentBusiness.id,
        existingAccount: account,
        customerName: account.name,
        kind: account.kind,
        personaContext: account.personaContext || personaAdaptation.activeFocus,
        direction: payload.direction,
        amount: payload.amount,
        note: payload.note,
        createdByName: activeOperator.name,
        createdByRole: activeOperator.role,
        syncToGalla: capabilities.showGalla ? payload.syncToGalla : null,
      });
      const finalVault = applyRecordActivityLog(res.vault, {
        businessId: currentBusiness.id,
        actorName: activeOperator.name,
        actorRole: activeOperator.role,
        actionType: 'ledger',
        summary: `Quick ${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${account.name}`,
        targetName: account.name,
        amount: payload.amount,
      });
      guestVaultRef.current = saveGuestVault(finalVault);
      setGuestVault(guestVaultRef.current);
      haptics.success();
      triggerAccountHighlight(account.id);
      showActionToast({
        kind: 'added',
        tx: res.tx,
        account: res.account,
        newBalance: res.newBalance,
        accountCreated: false,
      });
      return;
    }

    if (!user) return;
    const res = await addTransactionAtomic({
      ownerId: user.uid,
      businessId: currentBusiness.id,
      existingAccount: account,
      customerName: account.name,
      kind: account.kind,
      personaContext: account.personaContext || personaAdaptation.activeFocus,
      direction: payload.direction,
      amount: payload.amount,
      note: payload.note,
      createdByName: activeOperator.name,
      createdByRole: activeOperator.role,
      syncToGalla: capabilities.showGalla ? payload.syncToGalla : null,
    });
    haptics.success();
    triggerAccountHighlight(account.id);
    showActionToast({
      kind: 'added',
      tx: res.tx,
      account: { ...account, balance: res.newBalance },
      newBalance: res.newBalance,
      accountCreated: false,
    });
    logActivity(
      'ledger',
      `Quick ${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${account.name}`,
      account.name,
      payload.amount
    );
  };

  const handleExportCsv = () => {
    if (!currentBusiness) return;
    const rows: string[] = [
      ['Type', 'Account Name', 'Phone', 'Direction', 'Amount (INR)', 'Date', 'Note', 'Operator'].join(
        ','
      ),
    ];
    const accMap = new Map(activeAccounts.map((a) => [a.id, a]));
    for (const tx of activeTransactions) {
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
    a.download = `${currentBusiness.name.replace(/\s+/g, '_')}_ucred_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!currentBusiness) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Ucred',
      business: currentBusiness,
      accounts: activeAccounts,
      transactions: activeTransactions,
      bills: activeBills,
      stockItems: activeStockItems,
      cashbookEntries: activeCashbookEntries,
      staffMembers: activeStaffMembers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBusiness.name.replace(/\s+/g, '_')}_ucred_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJson = async (file: File) => {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    if (isGuestMode) {
      updateGuestVault(
        (prev) => applyRestoreBusinessBackup(prev, currentBusiness.id, parsed).vault
      );
      logActivity('account', 'Restored JSON local backup');
      return;
    }
    if (!user) return;
    await restoreBusinessBackup(user.uid, currentBusiness.id, parsed);
    logActivity('account', 'Restored JSON cloud backup');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
    if (needsRecentSignIn(user.metadata.lastSignInTime)) {
      if (hasGoogle) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else if (user.phoneNumber) {
        await startOtpReauthFlow('delete-account');
        return;
      } else {
        throw new Error(
          'For security, please Sign Out and sign in again with your Email Link, then tap Delete Forever.'
        );
      }
    }
    await deleteUserAccountCascade(user.uid);
    try {
      await deleteUser(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('requires-recent-login')) {
        if (hasGoogle) {
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
          await deleteUser(user);
        } else if (user.phoneNumber) {
          await startOtpReauthFlow('delete-account');
          return;
        } else {
          throw new Error(
            'For security, please Sign Out and sign in again with your Email Link, then tap Delete Forever.'
          );
        }
      } else {
        throw err;
      }
    }
    clearGuestVault();
    try {
      localStorage.removeItem('ucred_prelogin_prefs');
      localStorage.removeItem('ucred_notif_prefs');
    } catch {
      // Ignore storage removal errors
    }
    setSecondaryRoute(null);
    setSelectedAccountId(null);
  };

  const t = getUIStrings(language);
  const activeOwnerUid = isGuestMode ? GUEST_OWNER_ID : user!.uid;

  const subNavigationTabs = useMemo(() => {
    const tabs: Array<{ id: 'bills' | 'stock' | 'activity' | 'more'; label: string }> = [];
    if (capabilities.showGstBills) tabs.push({ id: 'bills', label: 'Bills' });
    if (capabilities.showStock) tabs.push({ id: 'stock', label: 'Stock' });
    if (capabilities.focus === 'personal') tabs.push({ id: 'activity', label: 'Activity' });
    tabs.push({ id: 'more', label: 'Tools' });
    return tabs;
  }, [capabilities.showGstBills, capabilities.showStock, capabilities.focus]);

  // Optional 4-Digit PIN Lock Gate (when configured)
  if (appLockPin && !pinUnlocked) {
    return (
      <>
        <PinLockOverlay
          expectedPin={appLockPin}
          uid={activeOwnerUid}
          onUnlock={() => setPinUnlocked(true)}
          onForgotPin={async () => {
            if (isGuestMode) {
              updateGuestVault((prev) => ({
                ...prev,
                profile: { ...prev.profile, appLockPin: '' },
              }));
              setPinUnlocked(true);
              return;
            }
            await startOtpReauthFlow('forgot-pin');
          }}
        />
        <div
          id="ucred-recaptcha-container"
          className="fixed bottom-0 left-0 opacity-0 pointer-events-none"
          aria-hidden="true"
        />
      </>
    );
  }

  const selectedAccount = activeAccounts.find((a) => a.id === selectedAccountId) || null;
  const effectiveMainTab: MainTab =
    mainTab === 'bills' && !capabilities.showGstBills
      ? 'ledger'
      : mainTab === 'stock' && !capabilities.showStock
        ? 'ledger'
        : mainTab;
  const effectiveSecondaryRoute: SecondaryRoute | null =
    secondaryRoute === 'galla' && !capabilities.showGalla ? null : secondaryRoute;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const verifiedPhoneDisplay = isGuestMode
    ? 'Guest Mode'
    : user?.email || user?.phoneNumber || (mobileNumber ? `+91 ${mobileNumber}` : 'Cloud Verified');

  const openCloudSyncSheet = () => {
    setAuthError('');
    setSyncSuccessMsg('');
    setEmailLinkSentTo('');
    setShowPhoneOtpInSync(false);
    if (mobileNumber && !syncPhoneInput) setSyncPhoneInput(mobileNumber);
    setSyncSheetOpen(true);
  };

  const handleSwitchPersonaFocus = (catId: PersonaCategoryId) => {
    const updated = savePersonaPrefs({
      ...personaPrefs,
      activeFocus: catId,
    });
    setPersonaPrefs(updated);
    const nextCaps = getPersonaCapabilities(updated.activeFocus);
    if (!nextCaps.showGstBills && mainTab === 'bills') setMainTab('ledger');
    if (!nextCaps.showStock && mainTab === 'stock') setMainTab('ledger');
    if (!nextCaps.showGalla && secondaryRoute === 'galla') setSecondaryRoute(null);
    setSelectedAccountId(null);
  };

  const handleBackToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const islandToast: DynamicIslandToast | null = actionToast
    ? {
        id: actionToast.tx.id,
        kind: actionToast.kind,
        title:
          actionToast.kind === 'added'
            ? `Saved ${formatINR(actionToast.tx.amount)}`
            : `Removed ${formatINR(actionToast.tx.amount)}`,
        subtitle:
          actionToast.kind === 'added'
            ? `${actionToast.account.name} · Bal ${formatINR(Math.abs(actionToast.newBalance))}`
            : `${actionToast.account.name} · Entry removed`,
        whatsappUrl:
          actionToast.kind === 'added'
            ? buildWhatsAppUrl(
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
              )
            : undefined,
        onUndo: () => void handleUndoToast(),
        onDismiss: dismissActionToast,
      }
    : null;

  const activeDockDestination: DockDestination =
    effectiveMainTab === 'more' || effectiveSecondaryRoute === 'settings'
      ? 'settings'
      : effectiveSecondaryRoute === 'account-summary' && !capabilities.showGstBills
        ? 'bills'
        : effectiveMainTab === 'bills' || effectiveMainTab === 'stock'
          ? 'bills'
          : effectiveMainTab === 'collection'
            ? 'overdue'
            : 'home';

  const showSubNavStrip =
    !selectedAccount &&
    !effectiveSecondaryRoute &&
    effectiveMainTab !== 'ledger' &&
    effectiveMainTab !== 'more';
  const hasForegroundOverlay = Boolean(selectedAccount || effectiveSecondaryRoute);

  return (
    <div className="w-full max-w-[460px] lg:max-w-[1040px] mx-auto h-dvh overflow-hidden relative shadow-2xl flex flex-col select-none spatial-shell-bg native-app-shell text-[var(--ink)]">
      <OfflineIndicator />

      {/* Scroll-Linked Living Matte Dynamic Island Header */}
      {!hasForegroundOverlay && !personaOnboardingOpen && (
        <DynamicIslandHeader
          business={currentBusiness}
          isGuestMode={isGuestMode}
          hideBalance={hideBalance}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          unreadCount={unreadCount}
          netBalance={scopedCashflow.netCashflow}
          totalReceivable={scopedCashflow.totalReceivable}
          totalPayable={scopedCashflow.totalPayable}
          gallaBalance={gallaPulse.cashDrawerBalance}
          capabilities={capabilities}
          personaPrefs={personaPrefs}
          isHeroDocked={spatialMotion.isHeroDocked}
          dockedPillOpacity={spatialMotion.dockedPillOpacity}
          dockedPillScale={spatialMotion.dockedPillScale}
          dockedPillY={spatialMotion.dockedPillY}
          voiceModalOpen={voiceModalOpen}
          islandToast={islandToast}
          undoBusy={undoBusy}
          onOpenBusinessSwitcher={() => setBizSwitcherOpen(true)}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          onChangeSearch={setSearchQuery}
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenProfileTools={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('more');
          }}
          onSwitchPersonaFocus={handleSwitchPersonaFocus}
          onEditPersonaModes={() => {
            setPersonaOnboardingStep(3);
            setPersonaOnboardingOpen(true);
          }}
          onBackToTop={handleBackToTop}
        />
      )}

      {/* Cockpit Main Canvas (Recesses Smoothly along Z-Axis when Statement or Secondary Overlay Opens) */}
      <main
        ref={mainScrollRef}
        className={`flex-1 min-h-0 w-full overflow-y-auto no-scrollbar px-4 lg:px-6 py-3 pb-32 origin-top transition-[transform,opacity,border-radius,filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hasForegroundOverlay
            ? 'scale-[0.92] -translate-y-2.5 rounded-[34px] opacity-45 brightness-90 pointer-events-none will-change-transform'
            : ''
        }`}
      >
        {/* Single Unified Home Return + Sub-Tool Switcher Bar (Zero Double Back Buttons) */}
        {showSubNavStrip && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <motion.button
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: 'spring', stiffness: 460, damping: 24 }}
              type="button"
              onClick={() => {
                haptics.tap();
                setSecondaryRoute(null);
                setMainTab('ledger');
              }}
              className="min-h-[38px] px-3 rounded-full bg-[var(--surface)] shadow-[var(--spatial-shadow)] text-xs font-extrabold text-[var(--ink)] inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{capabilities.feedTitle}</span>
            </motion.button>

            {(effectiveMainTab === 'bills' ||
              effectiveMainTab === 'stock') && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--surface-subtle)] p-1">
                {subNavigationTabs.map((sub) => {
                  const subActive =
                    sub.id === 'activity' ? false : effectiveMainTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        if (sub.id === 'activity') {
                          setSecondaryRoute('account-summary');
                        } else {
                          setSecondaryRoute(null);
                          setMainTab(sub.id);
                        }
                      }}
                      className={`min-h-[30px] px-2.5 rounded-full text-[11px] font-extrabold transition ${
                        subActive
                          ? 'bg-[var(--surface)] text-[var(--brand-accent)] shadow-xs'
                          : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Home Cockpit: Cash & Khata Feed (Always mounted behind overlays when on ledger or foreground overlay) */}
        {(effectiveMainTab === 'ledger' || Boolean(effectiveSecondaryRoute)) && (
          <CashKhataFeed
            accounts={scopedAccounts}
            transactions={scopedTransactions}
            stockItems={activeStockItems}
            cashbookEntries={capabilities.showGalla ? activeCashbookEntries : []}
            language={language}
            searchQuery={searchQuery}
            gallaPulse={gallaPulse}
            trustScoresByAccount={trustScoresByAccount}
            selectedAccountId={selectedAccountId}
            recentlyUpdatedAccountId={recentlyUpdatedAccountId}
            hideBalance={hideBalance}
            personaAdaptation={personaAdaptation}
            capabilities={capabilities}
            showAllModes={showAllModes}
            scrollContainerRef={mainScrollRef}
            heroOpacity={spatialMotion.heroOpacity}
            heroScale={spatialMotion.heroScale}
            heroY={spatialMotion.heroY}
            largeTitleOpacity={spatialMotion.largeTitleOpacity}
            largeTitleScale={spatialMotion.largeTitleScale}
            largeTitleY={spatialMotion.largeTitleY}
            jellySkew={spatialMotion.jellySkew}
            onToggleHideBalance={() => setHideBalance((v) => !v)}
            onToggleShowAllModes={() => setShowAllModes((v) => !v)}
            onSelectAccount={(acc) => setSelectedAccountId(acc.id)}
            onSwipeRemind={(acc) => setSelectedAccountId(acc.id)}
            onCreateAccount={async (payload) => {
              const safeKind: AccountKind = capabilities.showSuppliers ? payload.kind : 'customer';
              if (isGuestMode) {
                const res = applyCreateAccount(guestVaultRef.current, {
                  businessId: currentBusiness.id,
                  kind: safeKind,
                  personaContext: personaAdaptation.activeFocus,
                  name: payload.name,
                  phone: payload.phone,
                  dueDate: payload.dueDate,
                  creditLimit: payload.creditLimit,
                });
                const finalVault = applyRecordActivityLog(res.vault, {
                  businessId: currentBusiness.id,
                  actorName: activeOperator.name,
                  actorRole: activeOperator.role,
                  actionType: 'account',
                  summary: `Added ${safeKind} ${payload.name}`,
                  targetName: payload.name,
                });
                guestVaultRef.current = saveGuestVault(finalVault);
                setGuestVault(guestVaultRef.current);
                triggerAccountHighlight(res.created.id);
                setSelectedAccountId(res.created.id);
                return;
              }
              if (!user) return;
              const created = await createAccount({
                ownerId: user.uid,
                businessId: currentBusiness.id,
                kind: safeKind,
                personaContext: personaAdaptation.activeFocus,
                name: payload.name,
                phone: payload.phone,
                dueDate: payload.dueDate,
                creditLimit: payload.creditLimit,
              });
              logActivity('account', `Added ${safeKind} ${payload.name}`, payload.name);
              triggerAccountHighlight(created.id);
              setSelectedAccountId(created.id);
            }}
            onQuickTransaction={handleQuickTransaction}
            onOpenCollection={() => setMainTab('collection')}
            onOpenVoiceEntry={() => {
              setVoicePrefillName('');
              setVoiceCounterMode(false);
              setVoiceModalOpen(true);
            }}
            onRunVoiceDemo={() => {
              void handleVoiceSave({
                customerName: 'Ramesh',
                direction: 'given',
                amount: 500,
                note: 'Voice Demo Entry',
                voiceRaw: 'Ramesh 500 credit',
                kind: 'customer',
              });
            }}
            onOpenCounterMode={() => {
              setVoicePrefillName('');
              setVoiceCounterMode(true);
              setVoiceModalOpen(true);
            }}
            onOpenParchiScanner={() => setParchiScannerOpen(true)}
            onOpenGalla={() => {
              if (!capabilities.showGalla) return;
              setSelectedAccountId(null);
              setSecondaryRoute('galla');
            }}
            onOpenDailySummary={openDailyMunimSummary}
          />
        )}

        {!effectiveSecondaryRoute && effectiveMainTab === 'collection' && (
          <CollectionView
            key={`${currentBusiness.id}_${currentBusiness.upiId || ''}`}
            accounts={scopedAccounts}
            business={currentBusiness}
            language={language}
            trustScoresByAccount={trustScoresByAccount}
            capabilities={capabilities}
            onUpdateAccountDue={async (accountId, dueDate) => {
              if (isGuestMode) {
                updateGuestVault((prev) => applyUpdateAccountMeta(prev, accountId, { dueDate }));
              } else {
                await updateAccountMeta(accountId, { dueDate });
              }
              const target = activeAccounts.find((a) => a.id === accountId);
              logActivity(
                'account',
                `Set due date ${dueDate} for ${target?.name || 'Party'}`,
                target?.name
              );
            }}
            onSaveUpiId={async (upiId) => {
              if (isGuestMode) {
                updateGuestVault((prev) => applyUpdateBusiness(prev, currentBusiness.id, { upiId }));
                return;
              }
              await updateBusiness(currentBusiness.id, { upiId });
            }}
            onOpenAccount={(acc) => {
              setSelectedAccountId(acc.id);
              setMainTab('ledger');
            }}
          />
        )}

        {!effectiveSecondaryRoute && effectiveMainTab === 'bills' && capabilities.showGstBills && (
          <BillsView
            key={`${currentBusiness.id}_${billDraft?.customerName || billPrefill?.name || 'none'}_${
              billDraft ? billDraft.items?.length || 0 : 0
            }`}
            bills={activeBills}
            stockItems={activeStockItems}
            business={currentBusiness}
            prefillCustomer={billPrefill}
            externalDraft={billDraft}
            onOpenVoiceBill={() => {
              setVoicePrefillName('');
              setVoiceCounterMode(false);
              setVoiceModalOpen(true);
            }}
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
                  ((Number(it.qty) || 0) * (Number(it.rate) || 0) * (Number(it.gstRate) || 0)) / 100,
                0
              );
              const netBill = Math.max(
                0,
                Math.round((sub + gst - (payload.discountAmount || 0)) * 100) / 100
              );

              if (isGuestMode) {
                let nextVault = guestVaultRef.current;
                if (payload.docType === 'bill' && payload.paymentStatus === 'unpaid' && netBill > 0) {
                  const matched =
                    scopedAccounts.find(
                      (a) =>
                        a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                        (payload.customerPhone && a.phone === payload.customerPhone)
                    ) ||
                    activeAccounts.find(
                      (a) =>
                        a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                        (payload.customerPhone && a.phone === payload.customerPhone)
                    );
                  const txRes = applyAddTransactionAtomic(nextVault, {
                    businessId: currentBusiness.id,
                    existingAccount: matched || null,
                    customerName: payload.customerName,
                    kind: matched?.kind || 'customer',
                    personaContext: matched?.personaContext || personaAdaptation.activeFocus,
                    direction: 'given',
                    amount: netBill,
                    note: `Bill ${payload.billNumber}`,
                    billDate: payload.billDate,
                    createdByName: activeOperator.name,
                    createdByRole: activeOperator.role,
                  });
                  nextVault = txRes.vault;
                  linkedTxId = txRes.txId;
                }
                const billRes = applySaveBillDocument(nextVault, {
                  businessId: currentBusiness.id,
                  linkedTxId,
                  createdByName: activeOperator.name,
                  ...payload,
                });
                const loggedVault = applyRecordActivityLog(billRes.vault, {
                  businessId: currentBusiness.id,
                  actorName: activeOperator.name,
                  actorRole: activeOperator.role,
                  actionType: 'bill',
                  summary: `Created ${payload.docType} ${payload.billNumber} for ${payload.customerName}`,
                  targetName: payload.customerName,
                  amount: netBill,
                });
                guestVaultRef.current = saveGuestVault(loggedVault);
                setGuestVault(guestVaultRef.current);
                return { deductedCount: billRes.deductedCount };
              }

              if (!user) return { deductedCount: 0 };
              if (payload.docType === 'bill' && payload.paymentStatus === 'unpaid' && netBill > 0) {
                const matched =
                  scopedAccounts.find(
                    (a) =>
                      a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                      (payload.customerPhone && a.phone === payload.customerPhone)
                  ) ||
                  activeAccounts.find(
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
                  personaContext: matched?.personaContext || personaAdaptation.activeFocus,
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
                stockItems: activeStockItems,
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
              const newBillNumber = getNextSequenceNumber(activeBills, 'bill');
              if (isGuestMode) {
                const conv = applyConvertQuoteToBill(guestVaultRef.current, {
                  quote,
                  newBillNumber,
                });
                const loggedVault = applyRecordActivityLog(conv.vault, {
                  businessId: currentBusiness.id,
                  actorName: activeOperator.name,
                  actorRole: activeOperator.role,
                  actionType: 'bill',
                  summary: `Converted ${quote.billNumber} -> ${newBillNumber}`,
                  targetName: quote.customerName,
                  amount: quote.totalAmount,
                });
                guestVaultRef.current = saveGuestVault(loggedVault);
                setGuestVault(guestVaultRef.current);
                return { billNumber: newBillNumber, deductedCount: conv.deductedCount };
              }
              const deductedCount = await convertQuoteToBill({
                quote,
                newBillNumber,
                stockItems: activeStockItems,
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
              const target = activeBills.find((b) => b.id === billId);
              if (isGuestMode) {
                updateGuestVault((prev) => applyDeleteBillDocument(prev, billId));
              } else {
                await deleteBillDocument(billId);
              }
              logActivity(
                'bill',
                `Deleted ${target?.billNumber || 'bill'}`,
                target?.customerName,
                target?.totalAmount
              );
            }}
          />
        )}

        {!effectiveSecondaryRoute && effectiveMainTab === 'stock' && capabilities.showStock && (
          <StockView
            items={activeStockItems}
            onSaveItem={async (payload) => {
              if (isGuestMode) {
                updateGuestVault(
                  (prev) =>
                    applySaveStockItem(prev, {
                      businessId: currentBusiness.id,
                      ...payload,
                    }).vault
                );
              } else if (user) {
                await saveStockItem({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  ...payload,
                });
              }
              logActivity(
                'stock',
                `${payload.existingId ? 'Updated' : 'Added'} stock ${payload.name} (${payload.quantity} ${payload.unit})`,
                payload.name
              );
            }}
            onDeleteItem={async (itemId) => {
              const stk = activeStockItems.find((s) => s.id === itemId);
              if (isGuestMode) {
                updateGuestVault((prev) => applyDeleteStockItem(prev, itemId));
              } else {
                await deleteStockItem(itemId);
              }
              logActivity('stock', `Deleted stock item ${stk?.name || ''}`, stk?.name);
            }}
          />
        )}

        {!effectiveSecondaryRoute && effectiveMainTab === 'more' && (
          <SettingsView
            key={currentBusiness.id}
            appearance={appearance}
            accentTheme={accentTheme}
            mobileNumber={mobileNumber}
            verifiedPhone={verifiedPhoneDisplay}
            activeOperatorName={activeOperator.name}
            workspaceBadge={personaAdaptation.focusBadge}
            business={currentBusiness}
            appLockPin={appLockPin}
            isGuestMode={isGuestMode}
            showBackButton={false}
            capabilities={capabilities}
            onOpenCloudSync={openCloudSyncSheet}
            onOpenWorkspaces={() => {
              setPersonaOnboardingStep(3);
              setPersonaOnboardingOpen(true);
            }}
            onOpenBusinessProfile={() => setSecondaryRoute('business-profile')}
            onOpenStaffAudit={() => setSecondaryRoute('staff-audit')}
            onOpenGalla={
              capabilities.showGalla ? () => setSecondaryRoute('galla') : undefined
            }
            onOpenStock={
              capabilities.showStock
                ? () => {
                    setSecondaryRoute(null);
                    setMainTab('stock');
                  }
                : undefined
            }
            onOpenHelp={() => setSecondaryRoute('help-support')}
            onChangeAppearance={handleSetAppearance}
            onSelectAccentTheme={(theme) => void handleSelectAccentTheme(theme)}
            onSaveMobile={async (phone) => {
              persistPrelogin({ mobileNumber: phone });
              if (isGuestMode) {
                updateGuestVault((prev) =>
                  applyUpdateBusiness(
                    { ...prev, profile: { ...prev.profile, mobileNumber: phone } },
                    currentBusiness.id,
                    { phone }
                  )
                );
                return;
              }
              if (!user) return;
              const updated = await upsertUserProfile(user.uid, { mobileNumber: phone });
              setProfile(updated);
              await updateBusiness(currentBusiness.id, { phone });
            }}
            onSaveUpiId={async (upiId) => {
              if (isGuestMode) {
                updateGuestVault((prev) =>
                  applyUpdateBusiness(prev, currentBusiness.id, { upiId })
                );
                return;
              }
              await updateBusiness(currentBusiness.id, { upiId });
            }}
            onSavePin={async (pin) => {
              if (isGuestMode) {
                const hashedPin = pin ? await hashPinForUid(pin, GUEST_OWNER_ID) : '';
                updateGuestVault((prev) => ({
                  ...prev,
                  profile: { ...prev.profile, appLockPin: hashedPin },
                }));
                setPinUnlocked(true);
                return;
              }
              if (!user) return;
              const hashedPin = pin ? await hashPinForUid(pin, user.uid) : '';
              const updated = await upsertUserProfile(user.uid, { appLockPin: hashedPin });
              setProfile(updated);
              setPinUnlocked(true);
            }}
            onExportCsv={handleExportCsv}
            onExportJson={handleExportJson}
            onRestoreJson={handleRestoreJson}
            onClearAll={async () => {
              if (isGuestMode) {
                updateGuestVault((prev) => applyClearBusinessData(prev, currentBusiness.id));
                setSelectedAccountId(null);
                return;
              }
              if (!user) return;
              await clearBusinessData(user.uid, currentBusiness.id);
              setSelectedAccountId(null);
            }}
            onDeleteAccount={handleDeleteAccount}
            onLogout={async () => {
              await signOut(auth);
              setSecondaryRoute(null);
              setSelectedAccountId(null);
              setMainTab('ledger');
            }}
          />
        )}
      </main>

      {/* Z-Axis Foreground Party Statement Sheet (Shared layoutId Morph from PartyLedgerCard) */}
      <AnimatePresence>
        {selectedAccount && (
          <div className="absolute inset-0 z-30 p-3 pt-4 pb-3 flex flex-col items-center">
            <div className="w-full max-w-[560px] flex-1 min-h-0 flex flex-col">
              <PartyStatementView
              key={selectedAccount.id}
              account={selectedAccount}
              business={currentBusiness}
              language={language}
              capabilities={capabilities}
              hideBalance={hideBalance}
              onToggleHideBalance={() => setHideBalance((v) => !v)}
              transactions={activeTransactions.filter((tx) => tx.accountId === selectedAccount.id)}
              trustScore={trustScoresByAccount[selectedAccount.id]}
              onBack={() => setSelectedAccountId(null)}
              onOpenParchiScanner={
                capabilities.focus === 'personal' ? undefined : () => setParchiScannerOpen(true)
              }
              onAddTransaction={async (payload) => {
                if (isGuestMode) {
                  const res = applyAddTransactionAtomic(guestVaultRef.current, {
                    businessId: currentBusiness.id,
                    existingAccount: selectedAccount,
                    customerName: selectedAccount.name,
                    kind: selectedAccount.kind,
                    personaContext: selectedAccount.personaContext || personaAdaptation.activeFocus,
                    direction: payload.direction,
                    amount: payload.amount,
                    note: payload.note,
                    billDate: payload.billDate,
                    billImage: payload.billImage,
                    createdByName: activeOperator.name,
                    createdByRole: activeOperator.role,
                    syncToGalla: capabilities.showGalla ? payload.syncToGalla : null,
                  });
                  const finalVault = applyRecordActivityLog(res.vault, {
                    businessId: currentBusiness.id,
                    actorName: activeOperator.name,
                    actorRole: activeOperator.role,
                    actionType: 'ledger',
                    summary: `${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${selectedAccount.name}`,
                    targetName: selectedAccount.name,
                    amount: payload.amount,
                  });
                  guestVaultRef.current = saveGuestVault(finalVault);
                  setGuestVault(guestVaultRef.current);
                  showActionToast({
                    kind: 'added',
                    tx: res.tx,
                    account: res.account,
                    newBalance: res.newBalance,
                    accountCreated: false,
                  });
                  return;
                }
                if (!user) return;
                const res = await addTransactionAtomic({
                  ownerId: user.uid,
                  businessId: currentBusiness.id,
                  existingAccount: selectedAccount,
                  customerName: selectedAccount.name,
                  kind: selectedAccount.kind,
                  personaContext: selectedAccount.personaContext || personaAdaptation.activeFocus,
                  direction: payload.direction,
                  amount: payload.amount,
                  note: payload.note,
                  billDate: payload.billDate,
                  billImage: payload.billImage,
                  createdByName: activeOperator.name,
                  createdByRole: activeOperator.role,
                  syncToGalla: capabilities.showGalla ? payload.syncToGalla : null,
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
                  `${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${selectedAccount.name}`,
                  selectedAccount.name,
                  payload.amount
                );
              }}
              onUpdateTransaction={async (tx, patch) => {
                if (isGuestMode) {
                  updateGuestVault((prev) =>
                    applyUpdateTransactionAtomic(prev, { tx, account: selectedAccount, patch })
                  );
                } else {
                  await updateTransactionAtomic({
                    tx,
                    account: selectedAccount,
                    allForAccount: activeTransactions.filter(
                      (item) => item.accountId === selectedAccount.id
                    ),
                    patch,
                  });
                }
                logActivity(
                  'ledger',
                  `Edited ₹${patch.amount} entry for ${selectedAccount.name}`,
                  selectedAccount.name,
                  patch.amount
                );
              }}
              onDeleteTransaction={async (tx) => {
                if (isGuestMode) {
                  updateGuestVault((prev) =>
                    applyDeleteTransactionAtomic(prev, { tx, account: selectedAccount })
                  );
                } else {
                  const remaining = activeTransactions.filter(
                    (item) => item.accountId === selectedAccount.id && item.id !== tx.id
                  );
                  await deleteTransactionAtomic({
                    tx,
                    account: selectedAccount,
                    remainingForAccount: remaining,
                  });
                }
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
                if (isGuestMode) {
                  updateGuestVault((prev) => applyUpdateAccountMeta(prev, selectedAccount.id, patch));
                } else {
                  await updateAccountMeta(selectedAccount.id, patch);
                }
                logActivity(
                  'account',
                  `Updated party details for ${selectedAccount.name}`,
                  selectedAccount.name
                );
              }}
              onDeleteAccount={async () => {
                if (isGuestMode) {
                  updateGuestVault((prev) =>
                    applyDeleteAccountWithTransactions(prev, selectedAccount.id)
                  );
                } else {
                  const accTxs = activeTransactions.filter(
                    (tx) => tx.accountId === selectedAccount.id
                  );
                  await deleteAccountWithTransactions(selectedAccount.id, accTxs);
                }
                logActivity('account', `Deleted party ${selectedAccount.name}`, selectedAccount.name);
                setSelectedAccountId(null);
              }}
              onOpenVoiceForCustomer={(name) => {
                setVoicePrefillName(name);
                setVoiceCounterMode(false);
                setVoiceModalOpen(true);
              }}
              onOpenCreateBill={(customerName, customerPhone) => {
                if (!capabilities.showGstBills) return;
                setBillDraft(null);
                setBillPrefill({ name: customerName, phone: customerPhone });
                setSelectedAccountId(null);
                setMainTab('bills');
              }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Z-Axis In-Place Overlay Sheet for Secondary Routes (Single Header · Zero Double Back Buttons) */}
      <AnimatePresence>
        {!selectedAccount && effectiveSecondaryRoute && (
          <motion.div
            key={`secondary-overlay-${effectiveSecondaryRoute}`}
            initial={{ opacity: 0, y: 26, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.98, transition: { duration: 0.18, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="absolute inset-0 z-30 p-3 pt-4 pb-3 flex flex-col items-center"
          >
            <div className="w-full max-w-[680px] flex-1 min-h-0 rounded-[34px] spatial-card bg-[var(--app-bg)] overflow-y-auto no-scrollbar px-4 pt-3 pb-8">
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto mb-3" />

              {effectiveSecondaryRoute === 'galla' && capabilities.showGalla && (
                <GallaCashbookView
                  cashbookEntries={activeCashbookEntries}
                  transactions={activeTransactions}
                  bills={activeBills}
                  stockItems={activeStockItems}
                  activeOperatorName={activeOperator.name}
                  hideBalance={hideBalance}
                  onToggleHideBalance={() => setHideBalance((v) => !v)}
                  onAddEntry={async (payload) => {
                    if (isGuestMode) {
                      updateGuestVault(
                        (prev) =>
                          applyAddCashbookEntry(prev, {
                            businessId: currentBusiness.id,
                            entryType: payload.entryType,
                            mode: payload.mode,
                            category: payload.category,
                            amount: payload.amount,
                            note: payload.note,
                            entryDate: payload.entryDate,
                            actorName: activeOperator.name,
                          }).vault
                      );
                    } else if (user) {
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
                    }
                    logActivity(
                      'galla',
                      `Galla ${payload.entryType} ₹${payload.amount} (${payload.category})`,
                      payload.category,
                      payload.amount
                    );
                  }}
                  onDeleteEntry={async (entryId) => {
                    if (isGuestMode) {
                      updateGuestVault((prev) => applyDeleteCashbookEntry(prev, entryId));
                    } else {
                      await deleteCashbookEntry(entryId);
                    }
                    logActivity('galla', 'Deleted Galla cashbook entry');
                  }}
                  onBack={() => setSecondaryRoute(null)}
                />
              )}

              {effectiveSecondaryRoute === 'staff-audit' && (
                <StaffAuditView
                  uid={activeOwnerUid}
                  staffMembers={activeStaffMembers}
                  activityLogs={activeActivityLogs}
                  activeOperator={activeOperator}
                  onSwitchOperator={(op) => {
                    setActiveOperator(op);
                    logActivity('staff', `Counter switched to ${op.name} (${op.role})`, op.name);
                  }}
                  onSaveStaff={async (payload) => {
                    if (isGuestMode) {
                      updateGuestVault(
                        (prev) =>
                          applySaveStaffMember(prev, {
                            businessId: currentBusiness.id,
                            ...payload,
                          }).vault
                      );
                    } else if (user) {
                      await saveStaffMember({
                        ownerId: user.uid,
                        businessId: currentBusiness.id,
                        ...payload,
                      });
                    }
                    logActivity(
                      'staff',
                      `${payload.existingId ? 'Updated' : 'Added'} staff ${payload.name} (${payload.role})`,
                      payload.name
                    );
                  }}
                  onDeleteStaff={async (staffId) => {
                    const st = activeStaffMembers.find((s) => s.id === staffId);
                    if (isGuestMode) {
                      updateGuestVault((prev) => applyDeleteStaffMember(prev, staffId));
                    } else {
                      await deleteStaffMember(staffId);
                    }
                    if (activeOperator.staffId === staffId) {
                      setActiveOperator({ staffId: 'owner', name: 'Shop Owner', role: 'owner' });
                    }
                    logActivity('staff', `Removed staff ${st?.name || ''}`, st?.name);
                  }}
                  onBack={() => setSecondaryRoute(null)}
                />
              )}

              {effectiveSecondaryRoute === 'settings' && (
                <SettingsView
                  key={currentBusiness.id}
                  appearance={appearance}
                  accentTheme={accentTheme}
                  mobileNumber={mobileNumber}
                  verifiedPhone={verifiedPhoneDisplay}
                  activeOperatorName={activeOperator.name}
                  workspaceBadge={personaAdaptation.focusBadge}
                  business={currentBusiness}
                  appLockPin={appLockPin}
                  isGuestMode={isGuestMode}
                  showBackButton
                  capabilities={capabilities}
                  onOpenCloudSync={openCloudSyncSheet}
                  onOpenWorkspaces={() => {
                    setSecondaryRoute(null);
                    setPersonaOnboardingStep(3);
                    setPersonaOnboardingOpen(true);
                  }}
                  onOpenBusinessProfile={() => setSecondaryRoute('business-profile')}
                  onOpenStaffAudit={() => setSecondaryRoute('staff-audit')}
                  onOpenGalla={
                    capabilities.showGalla ? () => setSecondaryRoute('galla') : undefined
                  }
                  onOpenHelp={() => setSecondaryRoute('help-support')}
                  onBack={() => setSecondaryRoute(null)}
                  onChangeAppearance={handleSetAppearance}
                  onSelectAccentTheme={(theme) => void handleSelectAccentTheme(theme)}
                  onSaveMobile={async (phone) => {
                    persistPrelogin({ mobileNumber: phone });
                    if (isGuestMode) {
                      updateGuestVault((prev) =>
                        applyUpdateBusiness(
                          { ...prev, profile: { ...prev.profile, mobileNumber: phone } },
                          currentBusiness.id,
                          { phone }
                        )
                      );
                      return;
                    }
                    if (!user) return;
                    const updated = await upsertUserProfile(user.uid, { mobileNumber: phone });
                    setProfile(updated);
                    await updateBusiness(currentBusiness.id, { phone });
                  }}
                  onSaveUpiId={async (upiId) => {
                    if (isGuestMode) {
                      updateGuestVault((prev) =>
                        applyUpdateBusiness(prev, currentBusiness.id, { upiId })
                      );
                      return;
                    }
                    await updateBusiness(currentBusiness.id, { upiId });
                  }}
                  onSavePin={async (pin) => {
                    if (isGuestMode) {
                      const hashedPin = pin ? await hashPinForUid(pin, GUEST_OWNER_ID) : '';
                      updateGuestVault((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, appLockPin: hashedPin },
                      }));
                      setPinUnlocked(true);
                      return;
                    }
                    if (!user) return;
                    const hashedPin = pin ? await hashPinForUid(pin, user.uid) : '';
                    const updated = await upsertUserProfile(user.uid, { appLockPin: hashedPin });
                    setProfile(updated);
                    setPinUnlocked(true);
                  }}
                  onExportCsv={handleExportCsv}
                  onExportJson={handleExportJson}
                  onRestoreJson={handleRestoreJson}
                  onClearAll={async () => {
                    if (isGuestMode) {
                      updateGuestVault((prev) => applyClearBusinessData(prev, currentBusiness.id));
                      setSelectedAccountId(null);
                      return;
                    }
                    if (!user) return;
                    await clearBusinessData(user.uid, currentBusiness.id);
                    setSelectedAccountId(null);
                  }}
                  onDeleteAccount={handleDeleteAccount}
                  onLogout={async () => {
                    await signOut(auth);
                    setSecondaryRoute(null);
                    setSelectedAccountId(null);
                  }}
                />
              )}

              {effectiveSecondaryRoute === 'business-profile' && (
                <BusinessProfileView
                  key={currentBusiness.id}
                  business={currentBusiness}
                  canDeleteBusiness={activeBusinesses.length > 1}
                  onBack={() => setSecondaryRoute(null)}
                  onSave={async (patch) => {
                    if (isGuestMode) {
                      updateGuestVault((prev) =>
                        applyUpdateBusiness(prev, currentBusiness.id, patch)
                      );
                    } else {
                      await updateBusiness(currentBusiness.id, patch);
                    }
                    logActivity(
                      'account',
                      'Updated business profile',
                      patch.name || currentBusiness.name
                    );
                  }}
                  onDeleteBusiness={async () => {
                    if (isGuestMode) {
                      updateGuestVault((prev) => applyDeleteBusinessCascade(prev, currentBusiness.id));
                      setSelectedAccountId(null);
                      setSecondaryRoute(null);
                      return;
                    }
                    if (!user) return;
                    const fallback = activeBusinesses.find((b) => b.id !== currentBusiness.id);
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

              {effectiveSecondaryRoute === 'account-summary' && (
                <AccountSummaryView
                  accounts={scopedAccounts}
                  transactions={scopedTransactions}
                  onBack={() => setSecondaryRoute(null)}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                />
              )}

              {effectiveSecondaryRoute === 'multi-device' && (
                <MultiDeviceView
                  verifiedPhone={verifiedPhoneDisplay}
                  mobileNumber={mobileNumber}
                  isGuestMode={isGuestMode}
                  onOpenCloudSync={openCloudSyncSheet}
                  onBack={() => setSecondaryRoute(null)}
                />
              )}

              {effectiveSecondaryRoute === 'help-support' && (
                <HelpSupportView onBack={() => setSecondaryRoute(null)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solid Matte iOS 27 Floating Capsule Dock */}
      {!hasForegroundOverlay && !personaOnboardingOpen && (
        <BottomSpatialDock
          activeDestination={activeDockDestination}
          voiceModalOpen={voiceModalOpen}
          capabilities={capabilities}
          onSelectHome={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('ledger');
          }}
          onSelectBills={() => {
            setSelectedAccountId(null);
            if (!capabilities.showGstBills) {
              setSecondaryRoute('account-summary');
              return;
            }
            setSecondaryRoute(null);
            setMainTab('bills');
          }}
          onOpenVoice={() => {
            setVoicePrefillName('');
            setVoiceCounterMode(false);
            setVoiceModalOpen(true);
          }}
          onSelectOverdue={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('collection');
          }}
          onSelectSettings={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('more');
          }}
        />
      )}

      {/* Optional Multi-Auth Cloud Sync Bottom Sheet (Google + Email Link + Mobile OTP) */}
      <AnimatePresence>
        {syncSheetOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cloud Backup and Sync"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            onClick={() => {
              if (!authBusy) setSyncSheetOpen(false);
            }}
            className="fixed inset-0 z-50 bg-black/55 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 && !authBusy) setSyncSheetOpen(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[34px] spatial-sheet p-6 space-y-4 pb-safe max-h-[92dvh] overflow-y-auto no-scrollbar"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ background: 'var(--munim-gradient)' }}
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-inner shrink-0"
                  >
                    <CloudUpload className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                      Cloud Backup &amp; Sync
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] font-semibold">
                      Free Google, Email Link, or +91 OTP · Auto-merges local ledger
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => setSyncSheetOpen(false)}
                  aria-label="Close sync sheet"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {hasGuestRecordsToSync(guestVault) && !syncSuccessMsg && (
                <div className="rounded-2xl bg-[var(--brand-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--brand-accent)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {activeAccounts.length} parties, {activeTransactions.length} entries &amp;{' '}
                    {activeBills.length} bills ready to merge seamlessly.
                  </span>
                </div>
              )}

              {syncSuccessMsg ? (
                <div className="rounded-2xl bg-[var(--debit-tint)] p-4 text-center space-y-2">
                  <Check className="w-7 h-7 mx-auto text-[var(--debit-green)]" />
                  <p className="text-sm font-extrabold text-[var(--debit-green)]">
                    {syncSuccessMsg}
                  </p>
                </div>
              ) : otpSentTo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
                    <span>
                      OTP sent to <strong className="font-tabular text-[var(--ink)]">{otpSentTo}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleResetOtp}
                      className="inline-flex items-center gap-1 font-bold text-[var(--brand-accent)] hover:underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !authBusy && otpInput.length === 6) {
                        void handleVerifyOtp(otpInput);
                      }
                    }}
                    placeholder="● ● ● ● ● ●"
                    className="w-full min-h-[54px] rounded-2xl bg-[var(--app-bg)] ring-2 ring-[var(--brand)] text-center text-2xl font-extrabold font-tabular tracking-[0.35em] outline-none"
                  />

                  {authError && (
                    <p
                      role="alert"
                      className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)]"
                    >
                      {authError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={authBusy || otpResendCooldown > 0}
                      onClick={() => void handleSendOtp(syncPhoneInput)}
                      className="min-h-[48px] rounded-2xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink)] inline-flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{otpResendCooldown > 0 ? `Resend (${otpResendCooldown}s)` : 'Resend OTP'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={authBusy || otpInput.length !== 6}
                      onClick={() => void handleVerifyOtp(otpInput)}
                      className="min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 active:scale-95 transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{authBusy ? 'Syncing...' : 'Verify & Sync'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 1. Primary Zero-Cost Google (Gmail) Sign-In */}
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => {
                      haptics.tap();
                      void handleGoogleSignIn();
                    }}
                    className="tactile-key-primary w-full min-h-[50px] px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-fg)] font-display font-extrabold text-sm flex items-center justify-center gap-2.5 disabled:opacity-60 active:scale-[0.98] transition"
                  >
                    <span className="w-5 h-5 rounded-full bg-white text-[#4F46E5] font-black text-xs flex items-center justify-center">
                      G
                    </span>
                    <span>{authBusy ? 'Connecting...' : 'Continue with Google (Gmail)'}</span>
                  </button>

                  {/* 2. Passwordless Email Verification Link */}
                  <div className="rounded-2xl bg-[var(--app-bg)] p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                      <span className="text-xs font-extrabold text-[var(--ink)]">
                        Or Email Verification Link (No Password)
                      </span>
                    </div>

                    {emailLinkSentTo ? (
                      <p className="rounded-xl bg-[var(--debit-tint)] p-3 text-xs font-bold text-[var(--debit-green)]">
                        Verification link sent to <span className="underline">{emailLinkSentTo}</span>. Open that email on this browser to finish syncing!
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={syncEmailInput}
                          onChange={(e) => setSyncEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !authBusy) {
                              void handleSendEmailLink(syncEmailInput);
                            }
                          }}
                          placeholder="you@gmail.com"
                          className="flex-1 min-h-[42px] rounded-xl bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                        />
                        <button
                          type="button"
                          disabled={authBusy}
                          onClick={() => {
                            haptics.tap();
                            void handleSendEmailLink(syncEmailInput);
                          }}
                          className="min-h-[42px] px-4 rounded-xl bg-[var(--surface)] ring-1 ring-[var(--surface-border)] text-xs font-extrabold text-[var(--ink)] hover:bg-[var(--brand-tint)] disabled:opacity-60"
                        >
                          Send Link
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. Collapsible +91 Mobile OTP */}
                  {!showPhoneOtpInSync ? (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        setShowPhoneOtpInSync(true);
                      }}
                      className="w-full min-h-[42px] rounded-xl bg-[var(--surface-subtle)] text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Use +91 Mobile SMS OTP instead</span>
                    </button>
                  ) : (
                    <div className="rounded-2xl bg-[var(--app-bg)] p-3.5 space-y-2.5">
                      <label
                        htmlFor="sync-mobile-input"
                        className="block text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                      >
                        10-Digit Mobile Number
                      </label>
                      <div className="flex items-center gap-2 rounded-xl bg-[var(--surface)] ring-1 ring-[var(--brand)] px-3 min-h-[46px]">
                        <Smartphone className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />
                        <span className="font-tabular font-bold text-sm text-[var(--ink-muted)]">+91</span>
                        <input
                          id="sync-mobile-input"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={syncPhoneInput}
                          onChange={(e) =>
                            setSyncPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !authBusy) {
                              void handleSendOtp(syncPhoneInput);
                            }
                          }}
                          placeholder="9876543210"
                          className="w-full bg-transparent text-base font-extrabold font-tabular text-[var(--ink)] outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={() => void handleSendOtp(syncPhoneInput)}
                        className="w-full min-h-[44px] rounded-xl bg-[var(--surface)] ring-1 ring-[var(--brand)] text-[var(--brand-accent)] font-extrabold text-xs disabled:opacity-60 active:scale-95 transition"
                      >
                        {authBusy ? 'Sending SMS OTP...' : 'Send SMS OTP'}
                      </button>
                    </div>
                  )}

                  {authError && (
                    <p
                      role="alert"
                      className="rounded-2xl bg-[var(--credit-tint)] px-3.5 py-2.5 text-xs font-bold text-[var(--credit-red)]"
                    >
                      {authError}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cross-Browser Email Link Confirmation Modal (zero window.prompt) */}
      {emailConfirmPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Email Address"
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-[28px] spatial-sheet p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                Confirm Your Email
              </h3>
              <button
                type="button"
                onClick={() => setEmailConfirmPrompt(false)}
                aria-label="Cancel email confirmation"
                className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[var(--ink-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Enter the email address you used to request your sign-in link to complete cloud backup sync.
            </p>
            <input
              type="email"
              value={emailConfirmInput}
              onChange={(e) => setEmailConfirmInput(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full min-h-[46px] rounded-xl bg-[var(--app-bg)] px-3.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
            {authError && (
              <p className="text-xs font-bold text-[var(--credit-red)]">{authError}</p>
            )}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleConfirmCrossBrowserEmailLink()}
              className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-white text-sm font-extrabold disabled:opacity-60"
            >
              {authBusy ? 'Verifying...' : 'Complete Sign-In'}
            </button>
          </div>
        </div>
      )}

      {/* Business Switcher Bottom Sheet */}
      <AnimatePresence>
        {bizSwitcherOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBizSwitcherOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90) setBizSwitcherOpen(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[34px] spatial-sheet p-6 space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold">Switch Business</h3>
                <button
                  type="button"
                  onClick={() => setBizSwitcherOpen(false)}
                  aria-label="Close switcher"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                {activeBusinesses.map((biz) => {
                  const active = biz.id === currentBusiness.id;
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => void handleSwitchBusiness(biz.id)}
                      className={`w-full min-h-[54px] px-4 rounded-[20px] flex items-center justify-between gap-3 active:scale-95 transition ${
                        active
                          ? 'bg-[var(--brand-tint)] ring-1 ring-[var(--brand-accent)]'
                          : 'bg-[var(--app-bg)] hover:bg-[var(--surface-subtle)]'
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
                      {active && <Check className="w-4 h-4 text-[var(--brand-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold uppercase text-[var(--ink-muted)]">
                  Create New Business
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBizName}
                    onChange={(e) => setNewBizName(e.target.value)}
                    placeholder="e.g. Sharma Wholesale"
                    className="flex-1 min-h-[46px] rounded-2xl bg-[var(--app-bg)] px-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                  />
                  <button
                    type="button"
                    disabled={creatingBiz || !newBizName.trim()}
                    onClick={() => void handleCreateExtraBusiness()}
                    className="min-h-[46px] px-4 rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setBizSwitcherOpen(false);
                    setPersonaOnboardingStep(3);
                    setPersonaOnboardingOpen(true);
                  }}
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] text-xs font-extrabold inline-flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Change Business Mode ({personaAdaptation.focusBadge})</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          } else if (target === 'galla' && capabilities.showGalla) {
            setSelectedAccountId(null);
            setSecondaryRoute('galla');
          } else if (target === 'parchi' && capabilities.focus !== 'personal') {
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

      {/* Today's Business Audio Summary Modal */}
      <AnimatePresence>
        {dailySummaryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDailyMunimSummary}
            className="no-print fixed inset-0 z-50 bg-black/55 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90) closeDailyMunimSummary();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[34px] spatial-sheet p-6 space-y-4 pb-safe"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--surface-subtle)] mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ background: 'var(--munim-gradient)' }}
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-inner"
                  >
                    <Volume2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">Today&apos;s Business Summary</h3>
                    <p className="text-xs text-[var(--ink-muted)] font-semibold">
                      {currentBusiness.name} · {dailyStats.todayKey}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDailyMunimSummary}
                  aria-label="Close Daily Summary"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] active:scale-95 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[20px] bg-[var(--credit-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">Given Today</p>
                  <p className="text-base font-extrabold text-[var(--credit-red)] font-tabular mt-0.5">
                    {formatINR(dailyStats.givenToday)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--debit-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">Collected</p>
                  <p className="text-base font-extrabold text-[var(--debit-green)] font-tabular mt-0.5">
                    {formatINR(dailyStats.receivedToday)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--brand-tint)] p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">Cash Drawer</p>
                  <p className="text-base font-extrabold text-[var(--brand-accent)] font-tabular mt-0.5">
                    {formatINR(gallaPulse.cashDrawerBalance)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--brand-tint)] p-3.5 text-xs font-semibold text-[var(--ink)] leading-relaxed">
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
                      className="min-h-[44px] rounded-xl bg-[var(--credit-tint)] px-3 text-xs font-extrabold text-[var(--credit-red)] flex items-center justify-center gap-1.5 active:scale-95 transition"
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
                      className="min-h-[44px] rounded-xl bg-[var(--alert-tint)] px-3 text-xs font-extrabold text-[var(--alert-amber)] flex items-center justify-center gap-1.5 active:scale-95 transition"
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
                  className="min-h-[48px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Replay Audio</span>
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="min-h-[48px] rounded-xl bg-[var(--surface-subtle)] text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Stop Voice</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aperture Iris Spatial Voice & Hands-Free Counter Modal */}
      <VoiceMunimSheet
        open={voiceModalOpen}
        language={language}
        accounts={scopedAccounts}
        stockNames={capabilities.showStock ? activeStockItems.map((s) => s.name) : []}
        business={currentBusiness}
        prefillCustomerName={voicePrefillName}
        initialCounterMode={voiceCounterMode}
        personaAdaptation={personaAdaptation}
        allowBills={capabilities.showGstBills}
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
          if (!capabilities.showGstBills) return;
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

      {/* First-Time Greeting, Optional Multi-Auth & Workspace Setup (Zero Forced Login) */}
      {personaOnboardingOpen && (
        <PersonaOnboardingSheet
          initialPrefs={personaPrefs}
          initialStep={personaOnboardingStep}
          isSignedIn={!isGuestMode}
          verifiedIdentity={verifiedPhoneDisplay}
          authBusy={authBusy}
          authError={authError}
          emailLinkSentTo={emailLinkSentTo}
          onGoogleSignIn={handleGoogleSignIn}
          onSendEmailLink={handleSendEmailLink}
          onOpenPhoneSignIn={() => {
            openCloudSyncSheet();
            setShowPhoneOtpInSync(true);
          }}
          onComplete={(nextPrefs) => {
            const saved = savePersonaPrefs(nextPrefs);
            setPersonaPrefs(saved);
            setPersonaOnboardingOpen(false);
            const nextCaps = getPersonaCapabilities(saved.activeFocus);
            if (!nextCaps.showGstBills && mainTab === 'bills') setMainTab('ledger');
            if (!nextCaps.showStock && mainTab === 'stock') setMainTab('ledger');
            if (!nextCaps.showGalla && secondaryRoute === 'galla') setSecondaryRoute(null);
            setSelectedAccountId(null);
          }}
        />
      )}

      {/* AI Parchi & Receipt Scanner Modal */}
      <ParchiScannerModal
        open={parchiScannerOpen}
        onClose={() => setParchiScannerOpen(false)}
        accounts={scopedAccounts}
        onPostToKhata={async (payload) => {
          const match =
            scopedAccounts.find(
              (a) =>
                a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                (payload.phone && a.phone === payload.phone)
            ) ||
            activeAccounts.find(
              (a) =>
                a.name.trim().toLowerCase() === payload.customerName.trim().toLowerCase() ||
                (payload.phone && a.phone === payload.phone)
            );
          if (isGuestMode) {
            const res = applyAddTransactionAtomic(guestVaultRef.current, {
              businessId: currentBusiness.id,
              existingAccount: match || null,
              customerName: payload.customerName,
              kind: match?.kind || 'customer',
              personaContext: match?.personaContext || personaAdaptation.activeFocus,
              direction: payload.direction,
              amount: payload.amount,
              note: payload.note || 'AI Receipt Scan',
              billDate: payload.billDate,
              billImage: payload.billImage,
              createdByName: activeOperator.name,
              createdByRole: activeOperator.role,
            });
            let nextVault = res.vault;
            if (!match && payload.phone) {
              nextVault = applyUpdateAccountMeta(nextVault, res.accountId, {
                phone: payload.phone,
              });
            }
            const logged = applyRecordActivityLog(nextVault, {
              businessId: currentBusiness.id,
              actorName: activeOperator.name,
              actorRole: activeOperator.role,
              actionType: 'ledger',
              summary: `Scanned Receipt ₹${payload.amount} for ${payload.customerName}`,
              targetName: payload.customerName,
              amount: payload.amount,
            });
            guestVaultRef.current = saveGuestVault(logged);
            setGuestVault(guestVaultRef.current);
            showActionToast({
              kind: 'added',
              tx: res.tx,
              account: res.account,
              newBalance: res.newBalance,
              accountCreated: res.accountCreated,
            });
            setParchiScannerOpen(false);
            setSecondaryRoute(null);
            setMainTab('ledger');
            setSelectedAccountId(res.accountId);
            return;
          }

          if (!user) return;
          const res = await addTransactionAtomic({
            ownerId: user.uid,
            businessId: currentBusiness.id,
            existingAccount: match || null,
            customerName: payload.customerName,
            kind: match?.kind || 'customer',
            personaContext: match?.personaContext || personaAdaptation.activeFocus,
            direction: payload.direction,
            amount: payload.amount,
            note: payload.note || 'AI Receipt Scan',
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
                personaContext: personaAdaptation.activeFocus,
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
            `Scanned Receipt ₹${payload.amount} for ${payload.customerName}`,
            payload.customerName,
            payload.amount
          );
          setParchiScannerOpen(false);
          setSecondaryRoute(null);
          setMainTab('ledger');
          setSelectedAccountId(res.accountId);
        }}
        onCreateBillFromScan={(draft) => {
          if (!capabilities.showGstBills) return;
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

      {/* Single Persistent reCAPTCHA Anchor */}
      <div
        id="ucred-recaptcha-container"
        className="fixed bottom-0 left-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* OTP Re-Verification Modal for Sensitive Actions (Forgot PIN / Permanent Deletion) */}
      {reauthOtpTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile OTP Verification"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-[28px] spatial-sheet p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/20 shadow-inner text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </span>
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {reauthOtpTarget === 'forgot-pin'
                    ? 'Verify Mobile to Reset PIN'
                    : 'Verify Mobile to Delete Account'}
                </h3>
              </div>
              <button
                type="button"
                disabled={reauthBusy}
                onClick={() => setReauthOtpTarget(null)}
                aria-label="Close OTP verification"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--ink-muted)] active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              {reauthOtpSent
                ? `Enter the 6-digit SMS OTP sent to ${user?.phoneNumber || 'your mobile number'}.`
                : `Sending SMS verification code to ${user?.phoneNumber || 'your mobile number'}...`}
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={reauthOtpCode}
              onChange={(e) => setReauthOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="● ● ● ● ● ●"
              className="w-full min-h-[52px] rounded-2xl bg-[var(--surface-subtle)] ring-2 ring-transparent focus:ring-[var(--brand-accent)] text-center text-xl font-extrabold font-tabular tracking-[0.3em] outline-none transition"
            />

            {reauthError && (
              <p role="alert" className="text-xs font-bold text-[var(--credit-red)]">
                {reauthError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={reauthBusy}
                onClick={() => void startOtpReauthFlow(reauthOtpTarget)}
                className="min-h-[46px] rounded-xl bg-[var(--surface-subtle)] text-[var(--ink)] text-xs font-bold active:scale-95 transition"
              >
                Resend OTP
              </button>
              <button
                type="button"
                disabled={reauthBusy || !reauthOtpSent || reauthOtpCode.length !== 6}
                onClick={() => void handleConfirmOtpReauth()}
                className="min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] text-xs font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{reauthBusy ? 'Verifying...' : 'Confirm OTP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const emptySubscribe = () => () => {};

export const BolBahiApp: React.FC = () => {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return (
      <div
        suppressHydrationWarning
        className="w-full max-w-[460px] lg:max-w-[1040px] mx-auto h-dvh overflow-hidden shadow-2xl spatial-shell-bg native-app-shell"
      />
    );
  }

  return (
    <ErrorBoundary>
      <BolBahiAppInner />
    </ErrorBoundary>
  );
};
