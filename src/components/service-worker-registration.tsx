'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = async (): Promise<(() => void) | undefined> => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          void registration;

        } catch {
          return undefined;
        }
      };

      void registerSW();

      // Handle page visibility change to sync when app becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'FORCE_SYNC'
          });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  return null; // This component doesn't render anything
}
