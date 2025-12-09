
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import { withSentryConfig } from '@sentry/nextjs';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  sw: 'sw.js',
  register: false, // Disable automatic registration
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Fix source map issues in development
  productionBrowserSourceMaps: false,
  // Webpack configuration for source maps
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable source maps in development to avoid conflicts
      config.devtool = false;
    }
    return config;
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const sentryBuildOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Bundle size optimizations - reduces Sentry impact by ~5KB gzipped
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Conditionally hide source maps only in production
  hideSourceMaps: process.env.NODE_ENV === 'production',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  // transpileClientSDK was removed in Sentry 8.x - the SDK now handles compatibility automatically
  // Reference: https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/
};

// Only use Sentry if all required environment variables are set and not placeholder values
const isSentryConfigured = process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT &&
  process.env.SENTRY_ORG !== 'tu-org-slug' &&
  process.env.SENTRY_PROJECT !== 'tu-project-slug' &&
  !process.env.SENTRY_AUTH_TOKEN.startsWith('your-sentry-auth-token');

const configWithSentry = isSentryConfigured
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;

export default withPWA(configWithSentry);
