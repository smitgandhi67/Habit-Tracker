import { createClient } from '@usermaven/react';

const key = import.meta.env.VITE_USERMAVEN_KEY;
const trackingHost = import.meta.env.VITE_USERMAVEN_HOST || 'https://events.usermaven.com';

export const usermavenClient = key
  ? createClient({
      key,
      trackingHost,
      autocapture: true,
      autoPageview: true,
    })
  : null;
