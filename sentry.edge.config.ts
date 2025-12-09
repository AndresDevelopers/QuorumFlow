// This file configures the Sentry server client for edge runtime.
// The config you add here will be used whenever middleware or an edge route handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Conservative sampling for edge runtime to minimize performance impact
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.02 : 1.0,

  // Debug only in development
  debug: process.env.NODE_ENV === 'development',

  // Edge runtime optimizations
  beforeSend(event) {
    // Minimal processing in edge runtime for performance
    if (process.env.NODE_ENV === 'production') {
      // Filter edge-specific noise
      if (event.exception?.values?.[0]?.type === 'TypeError' && 
          event.exception?.values?.[0]?.value?.includes('fetch')) {
        return null;
      }
    }
    return event;
  },

  // Edge-specific error filtering
  ignoreErrors: [
    // Edge runtime specific noise
    'TypeError: fetch failed',
    'AbortError',
    // Middleware specific errors
    'NEXT_REDIRECT',
  ],

  // Minimal context for edge performance
  initialScope: {
    tags: {
      component: 'edge',
      runtime: 'edge-runtime',
    },
  },
});
