# Ucred Capacitor & Mobile App Guide (Android & iOS)

This guide documents the native Capacitor packaging, configuration, build workflow, permissions, and mobile viewport rules for **Ucred**.

---

## 1. Capacitor Configuration (`capacitor.config.ts`)

The project uses `@capacitor/cli` and `@capacitor/core` targeting local static web output (`dist` / `out`) packaged into native Android and iOS containers.

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ucred.app',
  appName: 'Ucred',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

---

## 2. Android Permissions (Microphone & Camera)

For voice khata commands and parchi/receipt scanning to work seamlessly on Android devices, the following permissions must be present in `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Required for Voice Munim / Voice Ledger entries -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Required for Parchi / Receipt Scanner and Barcode / QR capture -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="hardware.camera" android:required="false" />

<!-- Required for local encrypted storage and cloud sync -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 3. Mobile Viewport & Safe Area Rules

To ensure a native app feel without status bar overlap or notch clipping:
1. **Viewport Meta & SafeArea (`app/layout.tsx` & `globals.css`):**
   - `viewportFit: 'cover'` ensures edge-to-edge display under the system status bar and navigation pill.
   - `.pb-safe` and `.pt-safe` utilities apply `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` so floating bottom docks never collide with the system home indicator.
2. **Capacitor Initializer (`components/CapacitorInitializer.tsx`):**
   - Automatically syncs the native status bar theme (`Style.Dark` / `Style.Light` and background color `#000000` / `#FFFFFF`) with the active app theme.
   - Handles the native hardware back button to trigger standard history pop / navigation or minimize the app gracefully.

---

## 4. Build & Sync Workflow

1. **Build Static Bundle:**
   ```bash
   npm run build
   ```
2. **Sync Native Platforms:**
   ```bash
   npx cap sync
   ```
3. **Open Native IDEs:**
   - Android: `npx cap open android`
   - iOS (macOS Xcode): `npx cap open ios`
