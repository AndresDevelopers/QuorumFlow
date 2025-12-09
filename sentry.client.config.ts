// This file configures the Sentry browser client for error reporting.
// The config you add here will be used whenever a page is rendered by the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Optimized sampling rates for better performance
  // Use environment-based sampling for production vs development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Disable debug in production for better performance
  debug: process.env.NODE_ENV === 'development',

  // Session Replay removed to reduce bundle size by ~20KB gzipped
  // This significantly improves performance and reduces First Load JS
  // If replay is needed, consider lazy loading it only when required
  
  // Performance optimizations
  beforeSend(event) {
    // Filter out noisy errors in production
    if (process.env.NODE_ENV === 'production') {
      // Skip common browser extension errors
      if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection')) {
        return null;
      }
    }
    return event;
  },

  // Improved error filtering
  ignoreErrors: [
    // Browser extension errors
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    // Network errors that are not actionable
    'NetworkError',
    'Failed to fetch',
  ],
});
