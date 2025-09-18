'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ServiceWorkerRegistration() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          console.log('[SW] Service worker registered successfully:', registration);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is available - handled by UpdateNotification component
                  console.log('[SW] New service worker available');
                }
              });
            }
          });

          // Check for waiting service worker
          if (registration.waiting) {
            // Update notification handled by UpdateNotification component
            console.log('[SW] Waiting service worker found');
          }

          // Listen for controlling service worker change
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Controller changed, reloading page');
            window.location.reload();
          });

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[SW] Message from service worker:', event.data);
            
            if (event.data?.type === 'SYNC_COMPLETE') {
              toast({
                title: "Sincronización Completa",
                description: `${event.data.syncedCount} elementos sincronizados correctamente.`,
              });
            }
          });

        } catch (error) {
          console.error('[SW] Service worker registration failed:', error);
        }
      };

      // Register service worker
      registerSW();

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
  }, [toast]);

  return null; // This component doesn't render anything
}