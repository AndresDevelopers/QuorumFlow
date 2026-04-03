import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05,
    debug: false,
    ignoreErrors: [
      'NEXT_REDIRECT',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NetworkError',
      'Failed to fetch',
    ],
  });
}

export const onRequestError = Sentry.captureRequestError;
