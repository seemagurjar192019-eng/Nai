'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { bytesToBase64, getOrCreateDeviceDekBytes } from '@/lib/e2ee';
import {
  clearDeviceSecurityPrefs,
  getAutoLockSeconds,
  getPrivacyCurtainEnabled,
  getStoredPasskeyId,
  isWebAuthnSupported,
  registerDevicePasskey,
  setAutoLockSeconds as persistAutoLockSeconds,
  setPrivacyCurtainEnabled as persistPrivacyCurtainEnabled,
  setStoredPasskeyId,
  verifyDevicePasskey,
  type AutoLockSeconds,
} from '@/lib/security';

interface UseVaultSecurityOptions {
  appLockPin: string;
  activeLabel: string;
  cloudDekBytesRef: React.MutableRefObject<Uint8Array | null>;
  isGuestMode: boolean;
}

export function useVaultSecurity({
  appLockPin,
  activeLabel,
  cloudDekBytesRef,
  isGuestMode,
}: UseVaultSecurityOptions) {
  const [pinUnlocked, setPinUnlocked] = useState(true);
  const [autoLockSeconds, setAutoLockSecondsState] = useState<AutoLockSeconds>(() =>
    getAutoLockSeconds()
  );
  const [privacyCurtainEnabled, setPrivacyCurtainEnabledState] = useState<boolean>(() =>
    getPrivacyCurtainEnabled()
  );
  const [privacyCurtainVisible, setPrivacyCurtainVisible] = useState(false);
  const [passkeyEnabled, setPasskeyEnabledState] = useState<boolean>(() =>
    Boolean(getStoredPasskeyId())
  );
  const webAuthnSupported = isWebAuthnSupported();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changeAutoLockSeconds = useCallback((seconds: AutoLockSeconds) => {
    const safe = persistAutoLockSeconds(seconds);
    setAutoLockSecondsState(safe);
  }, []);

  const togglePrivacyCurtain = useCallback((enabled: boolean) => {
    const safe = persistPrivacyCurtainEnabled(enabled);
    setPrivacyCurtainEnabledState(safe);
    if (!safe) setPrivacyCurtainVisible(false);
  }, []);

  const dismissPrivacyCurtain = useCallback(() => {
    setPrivacyCurtainVisible(false);
  }, []);

  const togglePasskey = useCallback(
    async (enable: boolean): Promise<boolean> => {
      if (!enable) {
        setStoredPasskeyId('');
        setPasskeyEnabledState(false);
        return false;
      }
      await registerDevicePasskey(activeLabel || 'Ucred Shop Owner');
      setPasskeyEnabledState(true);
      return true;
    },
    [activeLabel]
  );

  const verifyPasskeyUnlock = useCallback(async (): Promise<boolean> => {
    const ok = await verifyDevicePasskey();
    if (ok) {
      setPinUnlocked(true);
      setPrivacyCurtainVisible(false);
    }
    return ok;
  }, []);

  const getRecoveryKeyBase64 = useCallback(async (): Promise<string> => {
    if (!isGuestMode && cloudDekBytesRef.current) {
      return bytesToBase64(cloudDekBytesRef.current);
    }
    const guestBytes = await getOrCreateDeviceDekBytes('guest');
    return bytesToBase64(guestBytes);
  }, [isGuestMode, cloudDekBytesRef]);

  const resetDeviceSecurityState = useCallback(() => {
    clearDeviceSecurityPrefs();
    setAutoLockSecondsState(0);
    setPrivacyCurtainEnabledState(false);
    setPrivacyCurtainVisible(false);
    setPasskeyEnabledState(false);
  }, []);

  // Idle auto-lock watchdog (only when App Lock PIN is active and autoLockSeconds > 0)
  useEffect(() => {
    if (!appLockPin || autoLockSeconds <= 0 || !pinUnlocked) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const scheduleLock = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setPinUnlocked(false);
      }, autoLockSeconds * 1000);
    };

    const handleActivity = () => {
      scheduleLock();
    };

    scheduleLock();
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [appLockPin, autoLockSeconds, pinUnlocked]);

  // Tab Privacy Curtain (shields numbers when switching tabs or minimizing window)
  useEffect(() => {
    if (!privacyCurtainEnabled) {
      return;
    }

    const showCurtain = () => setPrivacyCurtainVisible(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        showCurtain();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', showCurtain);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', showCurtain);
    };
  }, [privacyCurtainEnabled]);

  // Cross-tab security preference & vault lock synchronization
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === 'ucred_auto_lock_sec_v1') {
        setAutoLockSecondsState(getAutoLockSeconds());
      } else if (e.key === 'ucred_privacy_curtain_v1') {
        const next = getPrivacyCurtainEnabled();
        setPrivacyCurtainEnabledState(next);
        if (!next) setPrivacyCurtainVisible(false);
      } else if (e.key === 'ucred_passkey_cred_v1') {
        setPasskeyEnabledState(Boolean(getStoredPasskeyId()));
      } else if (e.key === 'ucred_guest_vault_enc_v1' || e.key === 'ucred_guest_vault_v1') {
        if (e.newValue === null && appLockPin) {
          setPinUnlocked(false);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [appLockPin]);

  return {
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
  };
}
