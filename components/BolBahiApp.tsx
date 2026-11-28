'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
  Lock,
  X,
} from 'lucide-react';
import { indianMobileSchema, otpCodeSchema } from '@/lib/design-system';
import {
  base64ToBytes,
  bytesToBase64,
  clearDeviceDekBytes,
  generateDekBytes,
  getOrCreateDeviceDekBytes,
  importDekKey,
  persistDeviceDekBytes,
  unwrapDekAutoForUid,
  unwrapDekWithPin,
  wrapDekAutoForUid,
  wrapDekWithPin,
  type VaultKeyEnvelope,
} from '@/lib/e2ee';
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
  getVaultKeyEnvelope,
  mergeAccountsInCloud,
  recordActivityLog,
  restoreBusinessBackup,
  restoreTransactionAtomic,
  saveBillDocument,
  saveStaffMember,
  saveStockItem,
  saveVaultKeyEnvelope,
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
  GUEST_VAULT_STORAGE_KEY,
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
  applyMergeAccounts,
  applyRecordActivityLog,
  applyRestoreTransactionAtomic,
  applySaveBillDocument,
  applySaveStaffMember,
  applySaveStockItem,
  applyUpdateAccountMeta,
  applyUpdateBusiness,
  applyUpdateTransactionAtomic,
  clearGuestVault,
  createInitialGuestVault,
  hasGuestRecordsToSync,
  loadEncryptedGuestVault,
  loadGuestVault,
  saveEncryptedGuestVault,
  type GuestVaultState,
} from '@/lib/guest-store';
import {
  buildDailyMunimScript,
  buildTransactionSlipMessage,
  buildWhatsAppUrl,
  formatINR,
  getLocalDateKey,
  getUIStrings,
  hashPinForUid,
  speakHinglish,
  stopSpeaking,
} from '@/lib/i18n';
import {
  isWeeklyBackupRecommended,
  subscribeStorageWarnings,
  type StorageWarningEvent,
} from '@/lib/idb-vault';
import {
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
  LanguageCode,
  LedgerAccount,
  LedgerTransaction,
  StaffMember,
  StockItem,
  TxDirection,
  UserProfile,
} from '@/lib/types';
import type { MainTab } from '@/types';
import { useBackStack } from '@/hooks/useBackStack';
import { useLedgerBackup } from '@/hooks/useLedgerBackup';
import { useOfflineSyncQueue } from '@/hooks/useOfflineSyncQueue';
import { usePersonaGate } from '@/hooks/usePersonaGate';
import { useSpatialMotion } from '@/hooks/useSpatialMotion';
import { useVaultSecurity } from '@/hooks/useVaultSecurity';
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
import { CloudSyncModal } from './modals/CloudSyncModal';
import { SecondaryModals } from './modals/SecondaryModals';
import { LegalConsentGate } from './LegalConsentGate';
import { TermsAndPrivacyModal } from './TermsAndPrivacyModal';
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
const APPEARANCE_PREF_KEY = 'ucred_appearance_pref_v1';

function normalizeAppearancePref(val: unknown): AppearanceMode {
  if (val === 'light' || val === 'dark' || val === 'system') return val;
  return 'system';
}

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
  // Instant Guest Vault loaded synchronously (migrating into AES-256-GCM encrypted vault on mount)
  const [guestVault, setGuestVault] = useState<GuestVaultState>(() => {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem(GUEST_VAULT_STORAGE_KEY)) {
          return loadGuestVault(readPreloginPrefs());
        }
      } catch {
        // Ignore storage inspection error
      }
    }
    return createInitialGuestVault(readPreloginPrefs());
  });
  const guestVaultRef = useRef<GuestVaultState>(guestVault);
  const guestDekRef = useRef<CryptoKey | null>(null);
  const guestDekPromiseRef = useRef<Promise<CryptoKey | null> | null>(null);

  const ensureGuestDek = useCallback(async (): Promise<CryptoKey | null> => {
    if (guestDekRef.current) return guestDekRef.current;
    if (!guestDekPromiseRef.current) {
      guestDekPromiseRef.current = (async () => {
        try {
          const bytes = await getOrCreateDeviceDekBytes('guest');
          const key = await importDekKey(bytes);
          guestDekRef.current = key;
          return key;
        } catch {
          return null;
        }
      })();
    }
    return guestDekPromiseRef.current;
  }, []);

  const commitGuestVault = useCallback(
    (next: GuestVaultState): GuestVaultState => {
      guestVaultRef.current = next;
      setGuestVault(next);
      void ensureGuestDek().then((dek) => saveEncryptedGuestVault(dek, next));
      return next;
    },
    [ensureGuestDek]
  );

  const updateGuestVault = useCallback(
    (updater: (prev: GuestVaultState) => GuestVaultState): GuestVaultState => {
      const next = updater(guestVaultRef.current);
      return commitGuestVault(next);
    },
    [commitGuestVault]
  );

  // Firebase Auth & E2EE Cloud Vault state (completely optional)
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cloudDek, setCloudDek] = useState<CryptoKey | null>(null);
  const cloudDekBytesRef = useRef<Uint8Array | null>(null);
  const [vaultEnvelope, setVaultEnvelope] = useState<VaultKeyEnvelope | null>(null);
  const [vaultMode, setVaultMode] = useState<'auto' | 'pin'>('auto');
  const [dekResolvedForUid, setDekResolvedForUid] = useState<string | null>(null);
  const [cloudVaultUnlockOpen, setCloudVaultUnlockOpen] = useState(false);
  const [vaultUnlockPin, setVaultUnlockPin] = useState('');
  const [vaultUnlockError, setVaultUnlockError] = useState('');
  const [vaultUnlockBusy, setVaultUnlockBusy] = useState(false);
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

  // OTP re-auth state
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

  // Voice, Counter Mode, Receipt Scanner & Bill Drafts
  const [hideBalance, setHideBalance] = useState(false);
  const [appearancePref, setAppearancePref] = useState<AppearanceMode>(() => {
    if (typeof window === 'undefined') return 'system';
    try {
      const explicit = localStorage.getItem(APPEARANCE_PREF_KEY);
      if (explicit === 'system' || explicit === 'light' || explicit === 'dark') {
        return explicit;
      }
      const pre = readPreloginPrefs();
      if (pre.appearance === 'light' || pre.appearance === 'dark' || pre.appearance === 'system') {
        return pre.appearance;
      }
    } catch {
      // Ignore storage read errors
    }
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
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
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');
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
  const appearance: AppearanceMode = appearancePref;
  const resolvedAppearance: 'light' | 'dark' =
    appearancePref === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : appearancePref;
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

  const {
    pinUnlocked,
    setPinUnlocked,
    autoLockSeconds,
    changeAutoLockSeconds,
    privacyCurtainEnabled,
    privacyCurtainVisible,
    togglePrivacyCurtain,
    dismissPrivacyCurtain,
    webAuthnSupported,
    passkeyEnabled,
    togglePasskey,
    verifyPasskeyUnlock,
    getRecoveryKeyBase64,
    resetDeviceSecurityState,
  } = useVaultSecurity({
    appLockPin,
    activeLabel: currentBusiness?.name || 'Ucred Shop Owner',
    cloudDekBytesRef,
    isGuestMode,
  });

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
  const offlineSync = useOfflineSyncQueue(currentBusiness.id);
  const [storageWarning, setStorageWarning] = useState<StorageWarningEvent | null>(null);
  const [backupTick, setBackupTick] = useState(0);

  useEffect(() => subscribeStorageWarnings((evt) => setStorageWarning(evt)), []);

  useEffect(() => {
    if (offlineSync.isOnline && offlineSync.pendingCount > 0 && isCloudReady) {
      const id = window.setTimeout(() => offlineSync.clearBusinessQueue(), 1200);
      return () => clearTimeout(id);
    }
  }, [offlineSync, isCloudReady]);

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

  // Hydrate encrypted Guest Vault on mount (migrating legacy plaintext vaults transparently)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dek = await ensureGuestDek();
      const hydrated = await loadEncryptedGuestVault(dek, readPreloginPrefs());
      if (cancelled) return;
      guestVaultRef.current = hydrated;
      setGuestVault(hydrated);
      if (hydrated.profile.appLockPin) {
        setPinUnlocked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureGuestDek, setPinUnlocked]);

  // Resolve or bootstrap zero-knowledge E2EE Data Encryption Key (DEK) for signed-in users
  const resolveCloudDekForUid = async (
    uid: string
  ): Promise<{ dek: CryptoKey | null; needsPin: boolean }> => {
    const env = await getVaultKeyEnvelope(uid);
    if (!env) {
      const bytes = await generateDekBytes();
      const autoEnv = await wrapDekAutoForUid(bytes, uid);
      await saveVaultKeyEnvelope(uid, autoEnv);
      await persistDeviceDekBytes(uid, bytes);
      const key = await importDekKey(bytes);
      cloudDekBytesRef.current = bytes;
      setCloudDek(key);
      setVaultEnvelope(autoEnv);
      setVaultMode('auto');
      setDekResolvedForUid(uid);
      setCloudVaultUnlockOpen(false);
      return { dek: key, needsPin: false };
    }

    if (env.mode === 'auto') {
      const bytes = await unwrapDekAutoForUid(env, uid);
      await persistDeviceDekBytes(uid, bytes);
      const key = await importDekKey(bytes);
      cloudDekBytesRef.current = bytes;
      setCloudDek(key);
      setVaultEnvelope(env);
      setVaultMode('auto');
      setDekResolvedForUid(uid);
      setCloudVaultUnlockOpen(false);
      return { dek: key, needsPin: false };
    }

    // Custom Cloud Sync Vault PIN mode: check active browser tab session cache first
    if (typeof window !== 'undefined') {
      try {
        const cachedB64 = window.sessionStorage.getItem(`ucred_vault_session_${uid}`);
        if (cachedB64) {
          const bytes = base64ToBytes(cachedB64);
          if (bytes.byteLength === 32) {
            const key = await importDekKey(bytes);
            cloudDekBytesRef.current = bytes;
            setCloudDek(key);
            setVaultEnvelope(env);
            setVaultMode('pin');
            setDekResolvedForUid(uid);
            setCloudVaultUnlockOpen(false);
            return { dek: key, needsPin: false };
          }
        }
      } catch {
        // Ignore invalid cached key
      }
    }

    cloudDekBytesRef.current = null;
    setCloudDek(null);
    setVaultEnvelope(env);
    setVaultMode('pin');
    setDekResolvedForUid(null);
    setVaultUnlockPin('');
    setVaultUnlockError('');
    setCloudVaultUnlockOpen(true);
    return { dek: null, needsPin: true };
  };

  // Merge local guest records into Firestore when authenticating (encrypting with user DEK)
  const mergeGuestVaultIntoFirestore = async (
    uid: string,
    phoneDigits: string,
    existingProfile: UserProfile | null,
    dek: CryptoKey | null
  ): Promise<UserProfile> => {
    const gDek = await ensureGuestDek();
    const localSnapshot =
      guestVaultRef.current.accounts.length > 0 || guestVaultRef.current.transactions.length > 0
        ? guestVaultRef.current
        : await loadEncryptedGuestVault(gDek, readPreloginPrefs());
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

        const createdBiz = await createBusiness(
          uid,
          {
            name: guestBiz.name || 'My Store',
            phone: guestBiz.phone || phoneDigits,
            upiId: guestBiz.upiId,
          },
          dek
        );

        if (
          guestBiz.gstNumber ||
          guestBiz.businessType ||
          guestBiz.category ||
          guestBiz.address ||
          guestBiz.email ||
          guestBiz.about
        ) {
          await updateBusiness(
            createdBiz.id,
            {
              gstNumber: guestBiz.gstNumber,
              businessType: guestBiz.businessType,
              category: guestBiz.category,
              address: guestBiz.address,
              email: guestBiz.email,
              about: guestBiz.about,
            },
            dek
          );
        }

        if (
          bizAccs.length > 0 ||
          bizTxs.length > 0 ||
          bizBills.length > 0 ||
          bizStock.length > 0 ||
          bizCb.length > 0
        ) {
          await restoreBusinessBackup(
            uid,
            createdBiz.id,
            {
              accounts: bizAccs,
              transactions: bizTxs,
              bills: bizBills,
              stockItems: bizStock,
              cashbookEntries: bizCb,
            },
            dek
          );
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
            dek,
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
      appearance: resolvedAppearance,
      ...(mergedActiveBizId ? { activeBusinessId: mergedActiveBizId } : {}),
      onboardingDone: true,
    });

    clearGuestVault();
    const freshGuest = createInitialGuestVault({
      language: saved.language,
      appearance: appearancePref,
      mobileNumber: saved.mobileNumber,
    });
    commitGuestVault(freshGuest);
    return saved;
  };

  const handleUnlockCloudVault = async () => {
    if (!user || !vaultEnvelope) return;
    const cleanPin = vaultUnlockPin.trim();
    if (cleanPin.length < 4) {
      setVaultUnlockError('Enter your 4+ character Vault PIN.');
      return;
    }
    setVaultUnlockError('');
    setVaultUnlockBusy(true);
    try {
      const bytes = await unwrapDekWithPin(vaultEnvelope, cleanPin);
      const key = await importDekKey(bytes);
      cloudDekBytesRef.current = bytes;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(`ucred_vault_session_${user.uid}`, bytesToBase64(bytes));
        } catch {
          // Ignore session storage errors
        }
      }
      setCloudDek(key);
      setDekResolvedForUid(user.uid);
      setCloudVaultUnlockOpen(false);
      setVaultUnlockPin('');
      if (hasGuestRecordsToSync(guestVaultRef.current)) {
        const existing = await getUserProfile(user.uid);
        const saved = await mergeGuestVaultIntoFirestore(user.uid, mobileNumber, existing, key);
        setProfile(saved);
      }
    } catch {
      setVaultUnlockError('Incorrect Vault PIN. Zero-knowledge encryption cannot be bypassed.');
    } finally {
      setVaultUnlockBusy(false);
    }
  };

  const handleConfigureVaultMode = async (mode: 'auto' | 'pin', vaultPin?: string) => {
    if (!user) {
      throw new Error('Sign in with free Cloud Backup first to manage Cloud Sync Vault PIN.');
    }
    const bytes = cloudDekBytesRef.current || (await generateDekBytes());
    if (mode === 'pin') {
      const env = await wrapDekWithPin(bytes, vaultPin || '');
      await saveVaultKeyEnvelope(user.uid, env);
      cloudDekBytesRef.current = bytes;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(`ucred_vault_session_${user.uid}`, bytesToBase64(bytes));
        } catch {
          // Ignore sessionStorage failures
        }
      }
      setVaultEnvelope(env);
      setVaultMode('pin');
      return;
    }

    const autoEnv = await wrapDekAutoForUid(bytes, user.uid);
    await saveVaultKeyEnvelope(user.uid, autoEnv);
    await persistDeviceDekBytes(user.uid, bytes);
    cloudDekBytesRef.current = bytes;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(`ucred_vault_session_${user.uid}`);
      } catch {
        // Ignore sessionStorage cleanup error
      }
    }
    setVaultEnvelope(autoEnv);
    setVaultMode('auto');
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
              const { dek, needsPin } = await resolveCloudDekForUid(cred.user.uid);
              if (!needsPin) {
                const saved = await mergeGuestVaultIntoFirestore(
                  cred.user.uid,
                  mobileNumber,
                  existing,
                  dek
                );
                setProfile(saved);
                if (!saved.appLockPin) setPinUnlocked(true);
              } else if (existing) {
                setProfile(existing);
                if (!existing.appLockPin) setPinUnlocked(true);
              }
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

  // Listen for OS prefers-color-scheme changes for Auto Appearance mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply resolved Light / Dark mode + Accent Theme + browser theme-color on documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (accentTheme === 'rose' || accentTheme === 'onyx') {
      root.setAttribute('data-accent', accentTheme);
    } else {
      root.removeAttribute('data-accent');
    }
    const isDark = resolvedAppearance === 'dark';
    root.classList.toggle('dark', isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#000000' : '#FFFFFF');
    }
  }, [resolvedAppearance, accentTheme]);

  // Background Firebase Auth listener (never blocks Guest Mode entry)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setCloudDek(null);
        cloudDekBytesRef.current = null;
        setVaultEnvelope(null);
        setVaultMode('auto');
        setDekResolvedForUid(null);
        setCloudVaultUnlockOpen(false);
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
        const { dek, needsPin } = await resolveCloudDekForUid(fbUser.uid);
        if (existing && existing.onboardingDone) {
          setProfile(existing);
          if (!existing.appLockPin) setPinUnlocked(true);
          else setPinUnlocked(false);
        } else if (!needsPin) {
          const merged = await mergeGuestVaultIntoFirestore(
            fbUser.uid,
            authPhoneDigits,
            existing,
            dek
          );
          setProfile(merged);
          setPinUnlocked(!merged.appLockPin);
        } else if (existing) {
          setProfile(existing);
          setPinUnlocked(!existing.appLockPin);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to sync cloud profile.');
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to user's Firestore businesses once E2EE DEK is unlocked
  useEffect(() => {
    if (!user || dekResolvedForUid !== user.uid) return;
    const unsub = subscribeBusinesses(
      user.uid,
      async (rows) => {
        if (rows.length === 0) {
          try {
            const created = await createBusiness(
              user.uid,
              {
                name: guestVaultRef.current.businesses[0]?.name || 'My Store',
                phone: mobileNumber,
              },
              cloudDek
            );
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
      },
      cloudDek
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dekResolvedForUid, cloudDek]);

  const cloudActiveBusiness: Business | null = useMemo(() => {
    if (!isCloudReady) return null;
    const matched = businesses.find((b) => b.id === profile?.activeBusinessId);
    return matched || businesses[0] || null;
  }, [isCloudReady, businesses, profile?.activeBusinessId]);

  // Subscribe to active Firestore business collections when Cloud Ready & DEK unlocked
  useEffect(() => {
    if (!user || !cloudActiveBusiness?.id || dekResolvedForUid !== user.uid) return;
    const bizId = cloudActiveBusiness.id;
    const u1 = subscribeAccounts(user.uid, bizId, setAccounts, cloudDek);
    const u2 = subscribeTransactions(user.uid, bizId, setTransactions, cloudDek);
    const u3 = subscribeBills(user.uid, bizId, setBills, cloudDek);
    const u4 = subscribeStockItems(user.uid, bizId, setStockItems, cloudDek);
    const u5 = subscribeCashbookEntries(user.uid, bizId, setCashbookEntries, cloudDek);
    const u6 = subscribeStaffMembers(user.uid, bizId, setStaffMembers, cloudDek);
    const u7 = subscribeActivityLogs(user.uid, bizId, setActivityLogs, cloudDek);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [user, cloudActiveBusiness?.id, dekResolvedForUid, cloudDek]);

  // Deterministic Intelligence Computations
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

  const logActivity = useCallback(
    (
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
        dek: cloudDek,
      }).catch(() => {});
    },
    [
      isGuestMode,
      currentBusiness,
      activeOperator.name,
      activeOperator.role,
      user,
      cloudDek,
      updateGuestVault,
    ]
  );

  const {
    handleExportCsv: rawExportCsv,
    handleExportJson: rawExportJson,
    handleRestoreJson,
  } = useLedgerBackup({
    currentBusiness,
    activeAccounts,
    activeTransactions,
    activeBills,
    activeStockItems,
    activeCashbookEntries,
    activeStaffMembers,
    isGuestMode,
    user,
    cloudDek,
    updateGuestVault,
    logActivity,
  });

  const handleExportCsv = useCallback(() => {
    rawExportCsv();
    setBackupTick((t) => t + 1);
  }, [rawExportCsv]);

  const handleExportJson = useCallback(() => {
    rawExportJson();
    setBackupTick((t) => t + 1);
  }, [rawExportJson]);

  const backupStatus = useMemo(() => {
    void backupTick;
    return isWeeklyBackupRecommended(activeTransactions.length);
  }, [activeTransactions.length, backupTick]);

  const triggerAccountHighlight = useCallback((accountId: string) => {
    if (recentHighlightTimerRef.current) clearTimeout(recentHighlightTimerRef.current);
    setRecentlyUpdatedAccountId(accountId);
    recentHighlightTimerRef.current = setTimeout(() => {
      setRecentlyUpdatedAccountId(null);
    }, 1800);
  }, []);

  const handleMergeAccount = useCallback(
    async (sourceAccountId: string, targetAccountId: string) => {
      if (sourceAccountId === targetAccountId) return;
      const source = activeAccounts.find((a) => a.id === sourceAccountId);
      const target = activeAccounts.find((a) => a.id === targetAccountId);
      if (!source || !target) return;
      if (isGuestMode) {
        updateGuestVault((prev) =>
          applyMergeAccounts(prev, { sourceAccountId, targetAccountId }).vault
        );
      } else {
        await mergeAccountsInCloud({
          sourceAccount: source,
          targetAccount: target,
          sourceTransactions: activeTransactions.filter((t) => t.accountId === source.id),
          targetTransactions: activeTransactions.filter((t) => t.accountId === target.id),
          dek: cloudDek,
        });
      }
      logActivity('account', `Merged ${source.name} into ${target.name}`, target.name);
      triggerAccountHighlight(target.id);
      setSelectedAccountId(target.id);
    },
    [
      activeAccounts,
      activeTransactions,
      cloudDek,
      isGuestMode,
      logActivity,
      triggerAccountHighlight,
      updateGuestVault,
    ]
  );

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
    const cleanMode = normalizeAppearancePref(nextMode);
    setAppearancePref(cleanMode);
    try {
      localStorage.setItem(APPEARANCE_PREF_KEY, cleanMode);
    } catch {
      // Ignore storage write errors
    }
    persistPrelogin({ appearance: cleanMode });
    if (isGuestMode) {
      updateGuestVault((prev) => ({
        ...prev,
        profile: { ...prev.profile, appearance: cleanMode },
      }));
      return;
    }
    if (user) {
      try {
        const firestoreSafeMode: 'light' | 'dark' =
          cleanMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : cleanMode;
        const updated = await upsertUserProfile(user.uid, { appearance: firestoreSafeMode });
        setProfile(updated);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to save theme preference.');
      }
    }
  };

  const handleSelectAccentTheme = async (next: ThemeAccentId) => {
    setAccentTheme(next);
    try {
      localStorage.setItem('ucred_accent_theme_v1', next);
    } catch {
      // Ignore storage write errors
    }
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
      const { dek, needsPin } = await resolveCloudDekForUid(fbUser.uid);
      if (!needsPin) {
        const saved = await mergeGuestVaultIntoFirestore(fbUser.uid, phoneDigits, existing, dek);
        setProfile(saved);
        if (!saved.appLockPin) setPinUnlocked(true);
      } else if (existing) {
        setProfile(existing);
        if (!existing.appLockPin) setPinUnlocked(true);
      }
      setOtpSentTo(null);
      setOtpInput('');
      confirmationResultRef.current = null;
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
      const { dek, needsPin } = await resolveCloudDekForUid(fbUser.uid);
      if (!needsPin) {
        const saved = await mergeGuestVaultIntoFirestore(fbUser.uid, phoneDigits, existing, dek);
        setProfile(saved);
        if (!saved.appLockPin) setPinUnlocked(true);
      } else if (existing) {
        setProfile(existing);
        if (!existing.appLockPin) setPinUnlocked(true);
      }
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
      const { dek, needsPin } = await resolveCloudDekForUid(cred.user.uid);
      if (!needsPin) {
        const saved = await mergeGuestVaultIntoFirestore(cred.user.uid, mobileNumber, existing, dek);
        setProfile(saved);
        if (!saved.appLockPin) setPinUnlocked(true);
      } else if (existing) {
        setProfile(existing);
        if (!existing.appLockPin) setPinUnlocked(true);
      }
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
        const deletedUid = user.uid;
        await deleteUserAccountCascade(deletedUid);
        await deleteUser(user);
        await clearDeviceDekBytes(deletedUid);
        clearGuestVault();
        resetDeviceSecurityState();
        try {
          window.sessionStorage.removeItem(`ucred_vault_session_${deletedUid}`);
          localStorage.removeItem('ucred_prelogin_prefs');
          localStorage.removeItem('ucred_notif_prefs');
        } catch {
          // Ignore storage removal errors
        }
        setCloudDek(null);
        cloudDekBytesRef.current = null;
        setDekResolvedForUid(null);
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
      const created = await createBusiness(
        user.uid,
        {
          name: newBizName.trim(),
          phone: mobileNumber,
        },
        cloudDek
      );
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
              dek: cloudDek,
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
            dek: cloudDek,
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
        title: 'Scan Handwritten Receipt',
        bullets: [
          'Snap any handwritten slip or supplier bill to auto-extract party, items & ₹ total.',
        ],
        actionLabel: 'Open Scanner',
        targetAction: 'parchi',
        read: Boolean(notifPrefs['tip-parchi-scanner']?.read),
        fav: Boolean(notifPrefs['tip-parchi-scanner']?.fav),
        timeLabel: 'Receipt Scanner',
      });
    }

    items.push({
      id: 'tip-voice-entry',
      title:
        capabilities.focus === 'personal'
          ? 'Speak to Save · Hands-Free Voice'
          : 'Hands-Free Counter Mode & Voice Bills',
      bullets: [
        capabilities.focus === 'personal'
          ? 'Say "Rahul 500 udhaar aur Amit 300 mila" to record instantly.'
          : 'Say "Ramesh 500 udhaar aur Suresh 300 mila" or "Ramesh ka bill 2kg chini 90".',
      ],
      actionLabel: 'Try Voice Entry',
      targetAction: 'voice',
      read: Boolean(notifPrefs['tip-voice-entry']?.read),
      fav: Boolean(notifPrefs['tip-voice-entry']?.fav),
      timeLabel: 'Speak to Save',
    });

    return items;
  }, [
    scopedAccounts,
    currentBusiness?.upiId,
    dailyStats.todayKey,
    notifPrefs,
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

  // Unified LIFO Hardware Back & Escape Navigation Stack
  useBackStack(
    shellReady && mainTab !== 'ledger' && !secondaryRoute && !selectedAccountId,
    () => setMainTab('ledger')
  );
  useBackStack(shellReady && Boolean(selectedAccountId), () => setSelectedAccountId(null));
  useBackStack(shellReady && Boolean(secondaryRoute), () => setSecondaryRoute(null));
  useBackStack(shellReady && notifOpen, () => setNotifOpen(false));

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
      commitGuestVault(finalVault);
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
      dek: cloudDek,
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
      dek: cloudDek,
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
      commitGuestVault(finalVault);
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
      dek: cloudDek,
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

  const handleInlineQuickAdd = async (payload: {
    customerName: string;
    direction: TxDirection;
    amount: number;
    kind: AccountKind;
    note?: string;
  }) => {
    const cleanName = payload.customerName.trim();
    const resolvedKind: AccountKind = capabilities.showSuppliers ? payload.kind : 'customer';
    const match =
      scopedAccounts.find((a) => a.name.toLowerCase() === cleanName.toLowerCase()) || null;

    if (isGuestMode) {
      const res = applyAddTransactionAtomic(guestVaultRef.current, {
        businessId: currentBusiness.id,
        existingAccount: match,
        customerName: cleanName,
        kind: match?.kind || resolvedKind,
        personaContext: match?.personaContext || personaAdaptation.activeFocus,
        direction: payload.direction,
        amount: payload.amount,
        note: payload.note || '',
        createdByName: activeOperator.name,
        createdByRole: activeOperator.role,
      });
      const finalVault = applyRecordActivityLog(res.vault, {
        businessId: currentBusiness.id,
        actorName: activeOperator.name,
        actorRole: activeOperator.role,
        actionType: 'ledger',
        summary: `Quick ${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${cleanName}`,
        targetName: cleanName,
        amount: payload.amount,
      });
      commitGuestVault(finalVault);
      haptics.success();
      triggerAccountHighlight(res.accountId);
      showActionToast({
        kind: 'added',
        tx: res.tx,
        account: res.account,
        newBalance: res.newBalance,
        accountCreated: res.accountCreated,
      });
      return;
    }

    if (!user) return;
    const res = await addTransactionAtomic({
      ownerId: user.uid,
      businessId: currentBusiness.id,
      existingAccount: match,
      customerName: cleanName,
      kind: match?.kind || resolvedKind,
      personaContext: match?.personaContext || personaAdaptation.activeFocus,
      direction: payload.direction,
      amount: payload.amount,
      note: payload.note || '',
      createdByName: activeOperator.name,
      createdByRole: activeOperator.role,
      dek: cloudDek,
    });
    const accSnapshot: LedgerAccount = match
      ? { ...match, balance: res.newBalance }
      : {
          id: res.accountId,
          ownerId: user.uid,
          businessId: currentBusiness.id,
          kind: resolvedKind,
          personaContext: personaAdaptation.activeFocus,
          name: cleanName,
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
      `Quick ${payload.direction === 'given' ? 'Credit' : 'Received'} ₹${payload.amount} for ${cleanName}`,
      cleanName,
      payload.amount
    );
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      await clearDeviceDekBytes(GUEST_OWNER_ID);
      clearGuestVault();
      resetDeviceSecurityState();
      try {
        localStorage.removeItem('ucred_prelogin_prefs');
        localStorage.removeItem('ucred_notif_prefs');
      } catch {
        // Ignore storage removal errors
      }
      const freshVault = createInitialGuestVault({
        language,
        appearance,
      });
      commitGuestVault(freshVault);
      setSecondaryRoute(null);
      setSelectedAccountId(null);
      setMainTab('ledger');
      return;
    }
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
    const deletedUid = user.uid;
    await deleteUserAccountCascade(deletedUid);
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
    await clearDeviceDekBytes(deletedUid);
    clearGuestVault();
    resetDeviceSecurityState();
    try {
      window.sessionStorage.removeItem(`ucred_vault_session_${deletedUid}`);
      localStorage.removeItem('ucred_prelogin_prefs');
      localStorage.removeItem('ucred_notif_prefs');
    } catch {
      // Ignore storage removal errors
    }
    setCloudDek(null);
    cloudDekBytesRef.current = null;
    setDekResolvedForUid(null);
    setSecondaryRoute(null);
    setSelectedAccountId(null);
  };

  const t = getUIStrings(language);
  const activeOwnerUid = isGuestMode ? GUEST_OWNER_ID : user!.uid;

  const subNavigationTabs = useMemo(() => {
    const tabs: Array<{ id: 'bills' | 'stock' | 'staff-audit' | 'activity'; label: string }> = [];
    if (capabilities.showGstBills) tabs.push({ id: 'bills', label: 'Bills' });
    if (capabilities.showStock) tabs.push({ id: 'stock', label: 'Stock' });
    if (capabilities.focus !== 'personal') tabs.push({ id: 'staff-audit', label: 'Staff' });
    if (capabilities.focus === 'personal') tabs.push({ id: 'activity', label: 'Activity' });
    return tabs;
  }, [capabilities.showGstBills, capabilities.showStock, capabilities.focus]);

  // Optional 4-Digit PIN Lock Gate (when configured)
  if (appLockPin && !pinUnlocked) {
    return (
      <>
        <PinLockOverlay
          expectedPin={appLockPin}
          uid={activeOwnerUid}
          hasPasskey={passkeyEnabled}
          onVerifyPasskey={verifyPasskeyUnlock}
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
            if (!user) return;
            const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
            if (hasGoogle) {
              await reauthenticateWithPopup(user, new GoogleAuthProvider());
              const updated = await upsertUserProfile(user.uid, { appLockPin: '' });
              setProfile(updated);
              setPinUnlocked(true);
              return;
            }
            if (user.phoneNumber) {
              await startOtpReauthFlow('forgot-pin');
              return;
            }
            throw new Error(
              'For security, please clear browser session or sign in again via Email Verification Link to reset App Lock PIN.'
            );
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
      : effectiveMainTab === 'bills' ||
          effectiveMainTab === 'stock' ||
          effectiveMainTab === 'account-summary'
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
    <div className="w-full max-w-[480px] mx-auto min-h-[100dvh] h-[100dvh] overflow-hidden relative shadow-2xl flex flex-col select-none spatial-shell-bg native-app-shell text-[var(--ink)]">
      <LegalConsentGate />
      <OfflineIndicator />

      {storageWarning && (
        <div
          role="alert"
          className="no-print fixed top-12 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)] rounded-2xl bg-[var(--credit-tint)] border border-[var(--credit-red)] px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-2 text-xs font-bold text-[var(--credit-red)]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{storageWarning.message}</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1 rounded-lg bg-[var(--credit-red)] text-white text-[11px] font-extrabold"
            >
              Backup
            </button>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              aria-label="Dismiss storage alert"
              className="p-1 rounded-full hover:bg-black/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Scroll-Linked Floating Liquid Glass Top Chrome */}
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
          isHeaderVisible={spatialMotion.isHeaderVisible}
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

      {/* Cockpit Full-Bleed Scroll Canvas (Glides Behind Frosted Top Chrome & Bottom Dock) */}
      <motion.main
        ref={mainScrollRef}
        animate={
          hasForegroundOverlay
            ? { scale: 0.92, y: -10, opacity: 0.45 }
            : { scale: 1, y: 0, opacity: 1 }
        }
        transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
        className={`h-full w-full overflow-y-auto overscroll-y-contain no-scrollbar px-4 lg:px-6 pb-44 origin-top will-change-transform ${
          !hasForegroundOverlay && !personaOnboardingOpen
            ? personaPrefs.categories.length > 1
              ? 'pt-[102px]'
              : 'pt-[68px]'
            : 'pt-4'
        } ${
          hasForegroundOverlay ? 'rounded-[34px] pointer-events-none' : ''
        }`}
      >
        <div className="w-full max-w-[1120px] mx-auto">
        {/* Single Unified Home Return + Sub-Tool Switcher Bar */}
        {showSubNavStrip && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.7 }}
              type="button"
              onClick={() => {
                haptics.tap();
                setSecondaryRoute(null);
                setMainTab('ledger');
              }}
              className="min-h-[44px] px-3.5 rounded-full liquid-glass text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{capabilities.feedTitle}</span>
            </motion.button>

            {(effectiveMainTab === 'bills' ||
              effectiveMainTab === 'stock') && (
              <div className="relative flex items-center gap-1 rounded-full bg-[var(--surface-subtle)] border border-[var(--glass-border)] p-1">
                {subNavigationTabs.map((sub) => {
                  const subActive =
                    sub.id === 'activity' || sub.id === 'staff-audit'
                      ? false
                      : effectiveMainTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        if (sub.id === 'activity') {
                          setSecondaryRoute(null);
                          setMainTab('account-summary');
                        } else if (sub.id === 'staff-audit') {
                          setSecondaryRoute('staff-audit');
                        } else {
                          setSecondaryRoute(null);
                          setMainTab(sub.id);
                        }
                      }}
                      className={`relative min-h-[36px] px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        subActive
                          ? 'text-[var(--ink)]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {subActive && (
                        <motion.span
                          layoutId="subNavigationActivePill"
                          transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.7 }}
                          className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-xs border border-[var(--glass-border)]"
                        />
                      )}
                      <span className="relative z-10">{sub.label}</span>
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
            backupNeeded={backupStatus.needed}
            isOffline={!offlineSync.isOnline}
            pendingSyncCount={offlineSync.pendingCount}
            onExportBackup={handleExportJson}
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
                commitGuestVault(finalVault);
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
                dek: cloudDek,
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
            onInlineQuickAdd={handleInlineQuickAdd}
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
            <motion.div
              key="tab-collection"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <CollectionView
            key={`${currentBusiness.id}_${currentBusiness.upiId || ''}`}
            accounts={scopedAccounts}
            business={currentBusiness}
            language={language}
            capabilities={capabilities}
            onUpdateAccountDue={async (accountId, dueDate) => {
              if (isGuestMode) {
                updateGuestVault((prev) => applyUpdateAccountMeta(prev, accountId, { dueDate }));
              } else {
                await updateAccountMeta(accountId, { dueDate }, cloudDek);
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
              await updateBusiness(currentBusiness.id, { upiId }, cloudDek);
            }}
            onOpenAccount={(acc) => {
              setSelectedAccountId(acc.id);
              setMainTab('ledger');
            }}
          />
            </motion.div>
          )}

          {!effectiveSecondaryRoute && effectiveMainTab === 'bills' && capabilities.showGstBills && (
            <motion.div
              key="tab-bills"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
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
                commitGuestVault(loggedVault);
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
                  dek: cloudDek,
                });
                linkedTxId = txRes.txId;
              }
              const res = await saveBillDocument({
                ownerId: user.uid,
                businessId: currentBusiness.id,
                stockItems: activeStockItems,
                linkedTxId,
                createdByName: activeOperator.name,
                dek: cloudDek,
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
                commitGuestVault(loggedVault);
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
            </motion.div>
          )}

          {!effectiveSecondaryRoute && effectiveMainTab === 'stock' && capabilities.showStock && (
            <motion.div
              key="tab-stock"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
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
                  dek: cloudDek,
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
            </motion.div>
          )}

          {!effectiveSecondaryRoute && effectiveMainTab === 'account-summary' && (
            <motion.div
              key="tab-account-summary"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <AccountSummaryView
                accounts={scopedAccounts}
                transactions={scopedTransactions}
                showBackButton={false}
                onBack={() => setMainTab('ledger')}
                onExportJson={handleExportJson}
                onExportCsv={handleExportCsv}
              />
            </motion.div>
          )}

          {!effectiveSecondaryRoute && effectiveMainTab === 'more' && (
            <motion.div
              key="tab-settings"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <SettingsView
            key={currentBusiness.id}
            appearance={appearance}
            resolvedAppearance={resolvedAppearance}
            accentTheme={accentTheme}
            mobileNumber={mobileNumber}
            verifiedPhone={verifiedPhoneDisplay}
            workspaceBadge={personaAdaptation.focusBadge}
            business={currentBusiness}
            appLockPin={appLockPin}
            vaultMode={vaultMode}
            isGuestMode={isGuestMode}
            showBackButton={false}
            showGalla={capabilities.showGalla}
            showStock={capabilities.showStock}
            showGstBills={capabilities.showGstBills}
            showStaffAudit={capabilities.focus !== 'personal'}
            autoLockSeconds={autoLockSeconds}
            privacyCurtainEnabled={privacyCurtainEnabled}
            webAuthnSupported={webAuthnSupported}
            passkeyEnabled={passkeyEnabled}
            onOpenCloudSync={openCloudSyncSheet}
            onOpenWorkspaces={() => {
              setPersonaOnboardingStep(3);
              setPersonaOnboardingOpen(true);
            }}
            onOpenBusinessProfile={() => setSecondaryRoute('business-profile')}
            onOpenGalla={() => {
              if (!capabilities.showGalla) return;
              setSecondaryRoute('galla');
            }}
            onOpenStock={() => {
              if (!capabilities.showStock) return;
              setSecondaryRoute(null);
              setMainTab('stock');
            }}
            onOpenBills={() => {
              if (!capabilities.showGstBills) return;
              setSecondaryRoute(null);
              setMainTab('bills');
            }}
            onOpenStaffAudit={() => setSecondaryRoute('staff-audit')}
            onOpenAccountSummary={() => {
              setSecondaryRoute(null);
              setMainTab('account-summary');
              mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
            }}
            onOpenMultiDevice={() => setSecondaryRoute('multi-device')}
            onOpenHelp={() => setSecondaryRoute('help-support')}
            onChangeAppearance={handleSetAppearance}
            onSelectAccentTheme={(theme) => void handleSelectAccentTheme(theme)}
            onChangeAutoLockSeconds={changeAutoLockSeconds}
            onTogglePrivacyCurtain={togglePrivacyCurtain}
            onTogglePasskey={togglePasskey}
            onGetRecoveryKey={getRecoveryKeyBase64}
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
              await updateBusiness(currentBusiness.id, { phone }, cloudDek);
            }}
            onSaveUpiId={async (upiId) => {
              if (isGuestMode) {
                updateGuestVault((prev) =>
                  applyUpdateBusiness(prev, currentBusiness.id, { upiId })
                );
                return;
              }
              await updateBusiness(currentBusiness.id, { upiId }, cloudDek);
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
            onConfigureVaultMode={handleConfigureVaultMode}
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
              const prevUid = user?.uid;
              await signOut(auth);
              if (prevUid && typeof window !== 'undefined') {
                try {
                  window.sessionStorage.removeItem(`ucred_vault_session_${prevUid}`);
                } catch {
                  // Ignore sessionStorage cleanup error
                }
              }
              setCloudDek(null);
              cloudDekBytesRef.current = null;
              setDekResolvedForUid(null);
              setSecondaryRoute(null);
              setSelectedAccountId(null);
              setMainTab('ledger');
            }}
          />
            </motion.div>
          )}
        </div>
      </motion.main>

      {/* Z-Axis Foreground Party Statement Sheet (Shared layoutId Morph from PartyLedgerCard) */}
      <AnimatePresence>
        {selectedAccount && (
          <div className="absolute inset-0 z-30 p-3 pt-4 pb-3 flex flex-col items-center">
            <div className="w-full max-w-[560px] flex-1 min-h-0 flex flex-col">
              <PartyStatementView
              key={selectedAccount.id}
              account={selectedAccount}
              allAccounts={scopedAccounts}
              business={currentBusiness}
              language={language}
              capabilities={capabilities}
              hideBalance={hideBalance}
              onToggleHideBalance={() => setHideBalance((v) => !v)}
              transactions={activeTransactions.filter((tx) => tx.accountId === selectedAccount.id)}
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
                  commitGuestVault(finalVault);
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
                  dek: cloudDek,
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
                    dek: cloudDek,
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
                    dek: cloudDek,
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
                  await updateAccountMeta(selectedAccount.id, patch, cloudDek);
                }
                logActivity(
                  'account',
                  `Updated party details for ${selectedAccount.name}`,
                  selectedAccount.name
                );
              }}
              onMergeAccount={async (targetAccountId) => {
                await handleMergeAccount(selectedAccount.id, targetAccountId);
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
            <div className="w-full max-w-[680px] flex-1 min-h-0 rounded-[32px] liquid-glass-elevated overflow-y-auto no-scrollbar px-4 pt-3 pb-8">
              <div className="w-10 h-1 rounded-full bg-[var(--ink-muted)]/30 mx-auto mb-3" />

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
                        dek: cloudDek,
                      });
                    }
                    logActivity(
                      'galla',
                      `Cashbook ${payload.entryType} ₹${payload.amount} (${payload.category})`,
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
                    logActivity('galla', 'Deleted cashbook entry');
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
                        dek: cloudDek,
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
                  resolvedAppearance={resolvedAppearance}
                  accentTheme={accentTheme}
                  mobileNumber={mobileNumber}
                  verifiedPhone={verifiedPhoneDisplay}
                  workspaceBadge={personaAdaptation.focusBadge}
                  business={currentBusiness}
                  appLockPin={appLockPin}
                  vaultMode={vaultMode}
                  isGuestMode={isGuestMode}
                  showBackButton
                  showGalla={capabilities.showGalla}
                  showStock={capabilities.showStock}
                  showGstBills={capabilities.showGstBills}
                  showStaffAudit={capabilities.focus !== 'personal'}
                  autoLockSeconds={autoLockSeconds}
                  privacyCurtainEnabled={privacyCurtainEnabled}
                  webAuthnSupported={webAuthnSupported}
                  passkeyEnabled={passkeyEnabled}
                  onOpenCloudSync={openCloudSyncSheet}
                  onOpenWorkspaces={() => {
                    setSecondaryRoute(null);
                    setPersonaOnboardingStep(3);
                    setPersonaOnboardingOpen(true);
                  }}
                  onOpenBusinessProfile={() => setSecondaryRoute('business-profile')}
                  onOpenGalla={() => {
                    if (!capabilities.showGalla) return;
                    setSecondaryRoute('galla');
                  }}
                  onOpenStock={() => {
                    if (!capabilities.showStock) return;
                    setSecondaryRoute(null);
                    setMainTab('stock');
                  }}
                  onOpenBills={() => {
                    if (!capabilities.showGstBills) return;
                    setSecondaryRoute(null);
                    setMainTab('bills');
                  }}
                  onOpenStaffAudit={() => setSecondaryRoute('staff-audit')}
                  onOpenAccountSummary={() => {
                    setSecondaryRoute(null);
                    setMainTab('account-summary');
                    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  onOpenMultiDevice={() => setSecondaryRoute('multi-device')}
                  onOpenHelp={() => setSecondaryRoute('help-support')}
                  onOpenLegal={(tab) => {
                    setLegalModalTab(tab || 'terms');
                    setLegalModalOpen(true);
                  }}
                  onBack={() => setSecondaryRoute(null)}
                  onChangeAppearance={handleSetAppearance}
                  onSelectAccentTheme={(theme) => void handleSelectAccentTheme(theme)}
                  onChangeAutoLockSeconds={changeAutoLockSeconds}
                  onTogglePrivacyCurtain={togglePrivacyCurtain}
                  onTogglePasskey={togglePasskey}
                  onGetRecoveryKey={getRecoveryKeyBase64}
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
                    await updateBusiness(currentBusiness.id, { phone }, cloudDek);
                  }}
                  onSaveUpiId={async (upiId) => {
                    if (isGuestMode) {
                      updateGuestVault((prev) =>
                        applyUpdateBusiness(prev, currentBusiness.id, { upiId })
                      );
                      return;
                    }
                    await updateBusiness(currentBusiness.id, { upiId }, cloudDek);
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
                  onConfigureVaultMode={handleConfigureVaultMode}
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
                    const prevUid = user?.uid;
                    await signOut(auth);
                    if (prevUid && typeof window !== 'undefined') {
                      try {
                        window.sessionStorage.removeItem(`ucred_vault_session_${prevUid}`);
                      } catch {
                        // Ignore sessionStorage cleanup error
                      }
                    }
                    setCloudDek(null);
                    cloudDekBytesRef.current = null;
                    setDekResolvedForUid(null);
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
                      await updateBusiness(currentBusiness.id, patch, cloudDek);
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

      {/* Liquid Glass iOS 27 Floating Capsule Dock */}
      {!hasForegroundOverlay && !personaOnboardingOpen && (
        <BottomSpatialDock
          activeDestination={activeDockDestination}
          voiceModalOpen={voiceModalOpen}
          isDockVisible={spatialMotion.isHeaderVisible}
          capabilities={capabilities}
          onSelectHome={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('ledger');
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
          }}
          onSelectBills={() => {
            setSelectedAccountId(null);
            setSecondaryRoute(null);
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
            if (!capabilities.showGstBills) {
              setMainTab('account-summary');
              return;
            }
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
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
          }}
          onSelectSettings={() => {
            setSecondaryRoute(null);
            setSelectedAccountId(null);
            setMainTab('more');
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
      )}

       {/* Optional Google & Gmail Sign-In Cloud Sync Modal */}
      <CloudSyncModal
        open={syncSheetOpen}
        onClose={() => setSyncSheetOpen(false)}
        authBusy={authBusy}
        authError={authError}
        syncSuccessMsg={syncSuccessMsg}
        hasGuestRecords={hasGuestRecordsToSync(guestVault)}
        activeAccountsCount={activeAccounts.length}
        activeTransactionsCount={activeTransactions.length}
        activeBillsCount={activeBills.length}
        syncEmailInput={syncEmailInput}
        onChangeSyncEmailInput={setSyncEmailInput}
        emailLinkSentTo={emailLinkSentTo}
        onGoogleSignIn={() => void handleGoogleSignIn()}
        onSendEmailLink={(email) => void handleSendEmailLink(email)}
        emailConfirmPrompt={emailConfirmPrompt}
        onCloseEmailConfirm={() => setEmailConfirmPrompt(false)}
        emailConfirmInput={emailConfirmInput}
        onChangeEmailConfirmInput={setEmailConfirmInput}
        onConfirmCrossBrowserEmailLink={() => void handleConfirmCrossBrowserEmailLink()}
        onOpenLegal={(tab) => {
          setLegalModalTab(tab || 'terms');
          setLegalModalOpen(true);
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

      {/* Business Switcher, Daily Summary, OTP Reauth & Cloud Vault Unlock */}
      <SecondaryModals
        bizSwitcherOpen={bizSwitcherOpen}
        onCloseBizSwitcher={() => setBizSwitcherOpen(false)}
        activeBusinesses={activeBusinesses}
        currentBusiness={currentBusiness}
        onSwitchBusiness={(id) => void handleSwitchBusiness(id)}
        newBizName={newBizName}
        onChangeNewBizName={setNewBizName}
        creatingBiz={creatingBiz}
        onCreateExtraBusiness={() => void handleCreateExtraBusiness()}
        focusBadge={personaAdaptation.focusBadge}
        onOpenBusinessModes={() => {
          setBizSwitcherOpen(false);
          setPersonaOnboardingStep(3);
          setPersonaOnboardingOpen(true);
        }}
        dailySummaryOpen={dailySummaryOpen}
        onCloseDailySummary={closeDailyMunimSummary}
        dailyStats={dailyStats}
        cashDrawerBalance={gallaPulse.cashDrawerBalance}
        language={language}
        onNavigateCollection={() => {
          closeDailyMunimSummary();
          setSecondaryRoute(null);
          setSelectedAccountId(null);
          setMainTab('collection');
        }}
        onNavigateStock={() => {
          closeDailyMunimSummary();
          setSecondaryRoute(null);
          setSelectedAccountId(null);
          setMainTab('stock');
        }}
        reauthOtpTarget={reauthOtpTarget}
        onCloseReauthOtp={() => setReauthOtpTarget(null)}
        reauthBusy={reauthBusy}
        reauthOtpSent={reauthOtpSent}
        phoneNumberDisplay={user?.phoneNumber || 'your mobile number'}
        reauthOtpCode={reauthOtpCode}
        onChangeReauthOtpCode={setReauthOtpCode}
        reauthError={reauthError}
        onResendOtpReauth={(target) => void startOtpReauthFlow(target)}
        onConfirmOtpReauth={() => void handleConfirmOtpReauth()}
        cloudVaultUnlockOpen={Boolean(user && cloudVaultUnlockOpen)}
        vaultUnlockBusy={vaultUnlockBusy}
        onCloseCloudVaultUnlock={() => setCloudVaultUnlockOpen(false)}
        vaultUnlockPin={vaultUnlockPin}
        onChangeVaultUnlockPin={setVaultUnlockPin}
        vaultUnlockError={vaultUnlockError}
        onUseGuestMode={async () => {
          await signOut(auth);
          setCloudVaultUnlockOpen(false);
        }}
        onUnlockCloudVault={() => void handleUnlockCloudVault()}
      />

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

      {/* Receipt Scanner Modal */}
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
              note: payload.note || 'Receipt Scan',
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
            commitGuestVault(logged);
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
            note: payload.note || 'Receipt Scan',
            billDate: payload.billDate,
            billImage: payload.billImage,
            createdByName: activeOperator.name,
            createdByRole: activeOperator.role,
            dek: cloudDek,
          });
          if (!match && payload.phone) {
            await updateAccountMeta(res.accountId, { phone: payload.phone }, cloudDek).catch(() => {});
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
        onRestockItems={
          capabilities.showStock
            ? async (scannedItems) => {
                if (scannedItems.length === 0) return;
                if (isGuestMode) {
                  updateGuestVault((prev) => {
                    let nextVault = prev;
                    for (const item of scannedItems) {
                      const existing = nextVault.stockItems.find(
                        (s) =>
                          s.businessId === currentBusiness.id &&
                          s.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                      );
                      nextVault = applySaveStockItem(nextVault, {
                        businessId: currentBusiness.id,
                        existingId: existing?.id,
                        name: existing?.name || item.name,
                        unit: existing?.unit || item.unit || 'pcs',
                        salePrice: existing?.salePrice || item.price,
                        purchasePrice: item.price > 0 ? item.price : existing?.purchasePrice || 0,
                        quantity: (existing?.quantity || 0) + item.quantity,
                        lowStockThreshold: existing?.lowStockThreshold ?? 5,
                      }).vault;
                    }
                    return applyRecordActivityLog(nextVault, {
                      businessId: currentBusiness.id,
                      actorName: activeOperator.name,
                      actorRole: activeOperator.role,
                      actionType: 'stock',
                      summary: `Restocked ${scannedItems.length} item${scannedItems.length === 1 ? '' : 's'} from scanned receipt`,
                      targetName: scannedItems[0]?.name || 'Stock',
                    });
                  });
                  return;
                }
                if (!user) return;
                for (const item of scannedItems) {
                  const existing = activeStockItems.find(
                    (s) => s.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                  );
                  await saveStockItem({
                    ownerId: user.uid,
                    businessId: currentBusiness.id,
                    existingId: existing?.id,
                    name: existing?.name || item.name,
                    unit: existing?.unit || item.unit || 'pcs',
                    salePrice: existing?.salePrice || item.price,
                    purchasePrice: item.price > 0 ? item.price : existing?.purchasePrice || 0,
                    quantity: (existing?.quantity || 0) + item.quantity,
                    lowStockThreshold: existing?.lowStockThreshold ?? 5,
                    dek: cloudDek,
                  });
                }
                logActivity(
                  'stock',
                  `Restocked ${scannedItems.length} item${scannedItems.length === 1 ? '' : 's'} from scanned receipt`,
                  scannedItems[0]?.name
                );
              }
            : undefined
        }
      />

      {/* Single Persistent reCAPTCHA Anchor */}
      <div
        id="ucred-recaptcha-container"
        className="fixed bottom-0 left-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Global Terms of Service & Privacy Policy Modal */}
      <TermsAndPrivacyModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      {/* Privacy Curtain Veil */}
      {privacyCurtainVisible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screen Protected"
          className="fixed inset-0 z-[70] spatial-shell-bg backdrop-blur-xl flex flex-col items-center justify-center p-6"
        >
          <div className="w-full max-w-xs rounded-[28px] liquid-glass-elevated p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-accent)] flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[var(--ink)]">
                Screen Protected
              </h2>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                {currentBusiness.name} ledger balances are hidden while tab is inactive.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                dismissPrivacyCurtain();
              }}
              className="w-full min-h-[48px] rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] text-sm font-extrabold tactile-key-primary active:scale-95 transition"
            >
              Tap to Resume
            </button>
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
        className="w-full max-w-[480px] mx-auto min-h-[100dvh] h-[100dvh] overflow-hidden shadow-2xl spatial-shell-bg native-app-shell"
      />
    );
  }

  return (
    <ErrorBoundary>
      <BolBahiAppInner />
    </ErrorBoundary>
  );
};
