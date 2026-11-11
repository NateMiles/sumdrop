import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.natemiles.sumdrop',
  appName: 'Sum Drop',
  webDir: 'dist',
  backgroundColor: '#101c26',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#101c26' },
};

export default config;
