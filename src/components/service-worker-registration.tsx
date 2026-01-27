'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useI18n } from '@/contexts/i18n-context';

export function ServiceWorkerRegistration() {
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = async (): Promise<(() => void) | undefined> => {
        try {
          const hadControllerOnMount = Boolean(navigator.serviceWorker.controller);
          let hasShownUpdateToast = false;

          const showUpdateToast = (title: string, description: string) => {
            if (hasShownUpdateToast) return;
            hasShownUpdateToast = true;
            toast({
              title,
              description,
              duration: Infinity,
              action: (
                <ToastAction
                  altText={t('serviceWorker.reload')}
                  onClick={() => window.location.reload()}
                >
                  {t('serviceWorker.reload')}
                </ToastAction>
              ),
            });
          };

          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast(
                    "Actualización disponible",
                    "Recarga cuando termines para aplicar la nueva versión."
                  );
                }
              });
            }
          });

          // Check for waiting service worker
          if (registration.waiting) {
            showUpdateToast(
              "Actualización disponible",
              "Recarga cuando termines para aplicar la nueva versión."
            );
          }

          const handleControllerChange = () => {
            if (!hadControllerOnMount) {
              return;
            }
            showUpdateToast(
              "Actualización aplicada",
              "Recarga cuando termines para asegurar consistencia."
            );
          };

          const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
              toast({
                title: "Sincronización Completa",
                description: `${event.data.syncedCount} elementos sincronizados correctamente.`,
              });
            }
          };

          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

          return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
          };

        } catch (error) {
          toast({
            title: "Error",
            description: "No se pudo registrar el service worker.",
            variant: "destructive",
          });
          return undefined;
        }
      };

      // Register service worker
      let cleanupServiceWorkerListeners: (() => void) | undefined;
      void registerSW().then((cleanup) => {
        cleanupServiceWorkerListeners = cleanup;
      });

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
        cleanupServiceWorkerListeners?.();
      };
    }
  }, [toast]);

  return null; // This component doesn't render anything
}
