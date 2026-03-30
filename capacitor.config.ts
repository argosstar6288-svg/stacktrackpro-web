import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stacktrackpro.app',
  appName: 'StackTrack Pro',
  webDir: 'mobile-shell',
  server: {
    url: 'https://stacktrackpro.web.app',
    cleartext: false,
  },
};

export default config;
