/**
 * Lazy loading utility for Sentry Session Replay
 * Reduces initial bundle size by loading Replay only when needed
 */

// Dynamically import Sentry only if available
let sentryModule: any = null;
let getCurrentHub: any = null;

try {
  sentryModule = require('@sentry/nextjs');
  getCurrentHub = sentryModule.getCurrentHub;
} catch (error) {
  // Sentry is optional
}

interface ReplayOptions {
  sessionSampleRate?: number;
  errorSampleRate?: number;
  maskAllText?: boolean;
  maskAllInputs?: boolean;
  blockAllMedia?: boolean;
}

let replayInstance: any = null;
let isLoading = false;

/**
 * Dynamically loads and initializes Sentry Session Replay
 * @param options - Replay configuration options
 * @returns Promise that resolves to the Replay instance
 */
export async function loadSentryReplay(options: ReplayOptions = {}): Promise<any> {
  // Return existing instance if already loaded
  if (replayInstance) {
    return replayInstance;
  }

  // Prevent multiple simultaneous loads
  if (isLoading) {
    // Wait for the current load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return replayInstance;
  }

  try {
    isLoading = true;
    
    // Check if Sentry is available
    if (!getCurrentHub) {
      console.warn('⚠️ Sentry not available. Session Replay will not be loaded.');
      return null;
    }
    
    // Import Replay from @sentry/replay
    const { Replay } = await import('@sentry/replay');
    
    const defaultOptions = {
      sessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      errorSampleRate: 1.0,
      maskAllText: process.env.NODE_ENV === 'production',
      blockAllMedia: false,
      ...options
    };

    // Create and configure the Replay instance
    replayInstance = new Replay(defaultOptions);

    // Add to current Sentry hub
    const hub = getCurrentHub();
    const client = hub.getClient();
    
    if (client) {
      client.addIntegration(replayInstance);
      console.log('✅ Sentry Session Replay loaded successfully');
    } else {
      console.warn('⚠️ Sentry client not found. Make sure Sentry is initialized.');
    }

    return replayInstance;

  } catch (error) {
    console.error('❌ Failed to load Sentry Session Replay:', error);
    return null;
  } finally {
    isLoading = false;
  }
}

/**
 * Check if Session Replay is currently loaded
 * @returns boolean indicating if replay is loaded
 */
export function isReplayLoaded(): boolean {
  return !!replayInstance;
}

/**
 * Get the current replay instance (if loaded)
 * @returns Replay instance or null
 */
export function getReplayInstance() {
  return replayInstance;
}

/**
 * Utility to conditionally load replay based on user criteria
 * @param shouldLoad - Function that returns boolean to determine if replay should load
 * @param options - Replay configuration options
 */
export async function conditionallyLoadReplay(
  shouldLoad: () => boolean | Promise<boolean>,
  options?: Parameters<typeof loadSentryReplay>[0]
) {
  try {
    const load = await shouldLoad();
    if (load && !isReplayLoaded()) {
      await loadSentryReplay(options);
    }
  } catch (error) {
    console.error('❌ Error in conditional replay loading:', error);
  }
}

/**
 * Common use cases for conditional loading
 */
export const ReplayLoadingStrategies = {
  /**
   * Load replay for admin users only
   */
  adminOnly: (isAdmin: boolean) => () => isAdmin,
  
  /**
   * Load replay based on feature flag
   */
  featureFlag: (flagValue: boolean) => () => flagValue,
  
  /**
   * Load replay for specific percentage of users
   */
  percentage: (percentage: number) => () => Math.random() < (percentage / 100),
  
  /**
   * Load replay in development environment only
   */
  developmentOnly: () => () => process.env.NODE_ENV === 'development',
  
  /**
   * Load replay when user encounters an error
   */
  onError: () => {
    let shouldLoad = false;
    
    // Listen for unhandled errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', () => {
        shouldLoad = true;
      });
      
      window.addEventListener('unhandledrejection', () => {
        shouldLoad = true;
      });
    }
    
    return () => shouldLoad;
  }
};

/**
 * Example usage patterns
 */
export const ExampleUsage = {
  /**
   * Load replay for admin users
   */
  async loadForAdmin(isAdmin: boolean) {
    await conditionallyLoadReplay(
      ReplayLoadingStrategies.adminOnly(isAdmin),
      {
        sessionSampleRate: 1.0,
        errorSampleRate: 1.0,
        maskAllText: false // Admins might need to see actual content
      }
    );
  },
  
  /**
   * Load replay for 10% of users
   */
  async loadForSample() {
    await conditionallyLoadReplay(
      ReplayLoadingStrategies.percentage(10),
      {
        sessionSampleRate: 0.5,
        errorSampleRate: 1.0
      }
    );
  },
  
  /**
   * Load replay when debugging is needed
   */
  async loadForDebugging() {
    await conditionallyLoadReplay(
      () => localStorage.getItem('debug-mode') === 'true',
      {
        sessionSampleRate: 1.0,
        errorSampleRate: 1.0,
        maskAllText: false,
        blockAllMedia: false
      }
    );
  }
};