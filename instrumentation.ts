import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Environment-optimized sampling for server-side performance
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

      // Enable debug only in development
      debug: process.env.NODE_ENV === 'development',

      // Enable Spotlight for development debugging
      spotlight: process.env.NODE_ENV === 'development',

      // Server-side performance optimizations
      beforeSend(event) {
        // Filter server-side noise in production
        if (process.env.NODE_ENV === 'production') {
          // Skip common server errors that are not actionable
          if (event.exception?.values?.[0]?.type === 'AbortError') {
            return null;
          }
        }
        return event;
      },

      // Server-specific error filtering
      ignoreErrors: [
        // Common server-side noise
        'AbortError',
        'ECONNRESET',
        'EPIPE',
        'ENOTFOUND',
        // Next.js specific errors that are not actionable
        'NEXT_NOT_FOUND',
      ],

      // Improved performance monitoring
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,

      // Enhanced context for server errors
      initialScope: {
        tags: {
          component: 'server',
          runtime: 'nodejs',
        },
      },
    });
  }
}