import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',
  beforeSend(event) {
    if (process.env.NODE_ENV === 'production') {
      if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection')) {
        return null;
      }
    }
    return event;
  },
  ignoreErrors: [
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    'NetworkError',
    'Failed to fetch',
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
