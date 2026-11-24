'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export function CapacitorInitializer() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Configure Status Bar for Royal Indigo dark theme
    try {
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#0F172A' });
    } catch (e) {
      console.warn('StatusBar configuration not supported', e);
    }

    // Handle Android hardware back button gracefully
    const backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // Confirm exit or minimize app on root
        App.minimizeApp();
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
