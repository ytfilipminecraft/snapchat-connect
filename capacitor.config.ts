import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f3f902f6664f4f9d9ae9561dc5148978',
  appName: 'PulseChat',
  webDir: 'dist',
  server: {
    url: 'https://f3f902f6-664f-4f9d-9ae9-561dc5148978.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0f0f1a',
  },
};

export default config;
