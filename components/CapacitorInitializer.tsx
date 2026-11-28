'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export function CapacitorInitializer() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncStatusBar = () => {
      const isDark = document.documentElement.classList.contains('dark');
      try {
        void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        void StatusBar.setBackgroundColor({ color: isDark ? '#000000' : '#FFFFFF' });
      } catch {
        // Ignore on unsupported devices
      }
    };

    syncStatusBar();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          syncStatusBar();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
      const evt = new CustomEvent('ucred:hardware-back', { cancelable: true });
      const notCancelled = window.dispatchEvent(evt);
      if (!notCancelled) {
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        void App.minimizeApp();
      }
    });

    // Auto-scroll focused inputs into view above on-screen keyboard
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.getAttribute('contenteditable') === 'true') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 280);
      }
    };
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      observer.disconnect();
      window.removeEventListener('focusin', handleFocusIn);
      void backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
