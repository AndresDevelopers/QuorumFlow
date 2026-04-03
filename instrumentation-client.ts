import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection')) {
        return null;
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
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
