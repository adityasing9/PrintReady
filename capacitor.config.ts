import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.adityasing9.printready',
  appName: 'PrintReady',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
