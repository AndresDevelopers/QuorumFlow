
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { getCookie, setCookieWithMinutes, deleteCookie } from "@/lib/cookie-utils";

const CURRENT_VERSION = "1.0.0"; // This would be your app's current version
const UPDATE_DISMISSED_COOKIE = "update_dismissed";
const DISMISS_DURATION_MINUTES = 30;

export function UpdateNotification() {
  const { toast } = useToast();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    // Don't check for updates if we've already shown a toast in this session
    // or if the user has dismissed the update recently
    if (hasShownToast) return;

    const checkForUpdates = async () => {
      try {
        // Check if update was recently dismissed
        const updateDismissed = getCookie(UPDATE_DISMISSED_COOKIE);
        if (updateDismissed) {
          return; // Don't show notification if dismissed within the last 30 minutes
        }

        const response = await fetch("/version.json");
        const data = await response.json();

        if (data.version && data.version !== CURRENT_VERSION) {
          setHasShownToast(true);
          
          // Show single toast with both Update and Close actions
          const toastResult = toast({
            title: "Nueva versión disponible",
            description: `Hay una nueva versión disponible (${data.version}). Por favor, actualiza para obtener las últimas mejoras.`,
            action: (
              <div className="flex gap-2">
                <ToastAction 
                  altText="Cerrar" 
                  onClick={() => {
                    // Dismiss the update and set cookie for 30 minutes
                    setCookieWithMinutes(UPDATE_DISMISSED_COOKIE, "true", DISMISS_DURATION_MINUTES);
                    toastResult.dismiss();
                  }}
                >
                  Cerrar
                </ToastAction>
                <ToastAction 
                  altText="Actualizar" 
                  onClick={() => {
                    // Clear the dismissal cookie and reload
                    deleteCookie(UPDATE_DISMISSED_COOKIE);
                    window.location.reload();
                  }}
                >
                  Actualizar
                </ToastAction>
              </div>
            ),
            duration: Infinity, // Keep the toast open until the user interacts with it
          });
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    };

    checkForUpdates();
  }, [toast, hasShownToast]);

  return null; // This component does not render anything itself
}
