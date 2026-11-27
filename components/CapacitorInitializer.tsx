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
        void StatusBar.setBackgroundColor({ color: isDark ? '#06070A' : '#F5F5F8' });
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
      if (canGoBack) {
        window.history.back();
      } else {
        void App.minimizeApp();
      }
    });

    return () => {
      observer.disconnect();
      void backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
