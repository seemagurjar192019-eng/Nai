'use client';

import { useCallback, useEffect, useState } from 'react';

const QUEUE_STORAGE_KEY = 'ucred_offline_pending_ops_v1';

export interface OfflineQueuedOp {
  id: string;
  businessId: string;
  label: string;
  createdAt: string;
}

export function readOfflineQueue(): OfflineQueuedOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(items: OfflineQueuedOp[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Pure helper to enqueue or flush queued offline write metadata.
 */
export function appendOfflineQueuedOp(
  queue: OfflineQueuedOp[],
  businessId: string,
  label: string
): OfflineQueuedOp[] {
  const next: OfflineQueuedOp = {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    businessId,
    label: label.slice(0, 80),
    createdAt: new Date().toISOString(),
  };
  return [next, ...queue].slice(0, 200);
}

/**
 * Tracks browser/WebView online status and pending cloud sync operations queued while offline.
 */
export function useOfflineSyncQueue(businessId: string) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [queue, setQueue] = useState<OfflineQueuedOp[]>(() => readOfflineQueue());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const enqueueOp = useCallback(
    (label: string) => {
      setQueue((prev) => {
        const next = appendOfflineQueuedOp(prev, businessId, label);
        writeOfflineQueue(next);
        return next;
      });
    },
    [businessId]
  );

  const clearBusinessQueue = useCallback(() => {
    setQueue((prev) => {
      const remaining = prev.filter((item) => item.businessId !== businessId);
      writeOfflineQueue(remaining);
      return remaining;
    });
  }, [businessId]);

  const pendingCount = queue.filter((q) => q.businessId === businessId).length;

  return {
    isOnline,
    pendingCount,
    enqueueOp,
    clearBusinessQueue,
  };
}
