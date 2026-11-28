'use client';

import { useEffect, useRef } from 'react';

type BackHandler = () => boolean | void;

interface StackEntry {
  id: number;
  handler: BackHandler;
}

const backStack: StackEntry[] = [];
let nextId = 1;
let listenerAttached = false;

function handleBackDispatch(e: Event) {
  if (backStack.length === 0) return;
  const top = backStack[backStack.length - 1];
  const handled = top.handler();
  if (handled !== false) {
    e.preventDefault();
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || backStack.length === 0) return;
  const top = backStack[backStack.length - 1];
  const handled = top.handler();
  if (handled !== false) {
    e.preventDefault();
  }
}

function ensureGlobalListeners() {
  if (typeof window === 'undefined' || listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('ucred:hardware-back', handleBackDispatch);
  window.addEventListener('keydown', handleKeyDown);
}

/**
 * Registers an active modal, sheet, or sub-view onto a global LIFO back stack so Android hardware
 * back button and desktop Escape key close one overlay layer cleanly instead of minimizing the app.
 */
export function useBackStack(isActive: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    ensureGlobalListeners();

    const id = nextId++;
    const entry: StackEntry = {
      id,
      handler: () => {
        onBackRef.current();
        return true;
      },
    };
    backStack.push(entry);

    return () => {
      const idx = backStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        backStack.splice(idx, 1);
      }
    };
  }, [isActive]);
}
