export const APP_CONFIG = {
  name: 'MAKS LEAD HUB',
  version: '1.0.0',
  colors: {
    background: '#ffffff',
    text: '#000000',
    accent: '#E4FF00',
    secondary: '#ffffff',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
};

export const MONETIZATION_DEFAULTS = {
  subscriptionDays: 30,
  minTopup: 100,
};
