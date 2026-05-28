import { createClient } from '@usermaven/react';

const key = import.meta.env.VITE_USERMAVEN_KEY;
const trackingHost = import.meta.env.VITE_USERMAVEN_HOST || 'https://events.usermaven.com';

// TEMP debug — remove once verified
console.log('[usermaven] key present:', !!key, 'len:', key?.length || 0, 'host:', trackingHost);

export const usermavenClient = key
  ? createClient({
      key,
      trackingHost,
      autocapture: true,
      autoPageview: true,
    })
  : null;

if (typeof window !== 'undefined') window.__um = usermavenClient;
