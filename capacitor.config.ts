import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ucred.app',
  appName: 'Ucred',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
