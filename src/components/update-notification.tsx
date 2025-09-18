
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export function UpdateNotification() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [hasShownToast, setHasShownToast] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    // Load current version on mount
    const loadCurrentVersion = async () => {
      try {
        const response = await fetch("/version.json");
        const data = await response.json();
        setCurrentVersion(data.version);
      } catch (error) {
        console.error("Error loading current version:", error);
      }
    };

    loadCurrentVersion();
  }, []);

  useEffect(() => {
    // Don't check for updates if we've already shown a toast in this session
    // or if user is not authenticated or currentVersion is not loaded
    if (hasShownToast || !user || !currentVersion) return;

    const checkForUpdates = async () => {
      try {
        // Check if user has dismissed this version
        const userDocRef = doc(firestore, 'userPreferences', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.dismissedVersion === currentVersion) {
            return; // Don't show notification if this version was dismissed
          }
        }

        const response = await fetch("/version.json");
        const data = await response.json();

        if (data.version && data.version !== currentVersion) {
          setHasShownToast(true);

          // Show single toast with both Update and Close actions
          const toastResult = toast({
            title: "Nueva versión disponible",
            description: `Hay una nueva versión disponible (${data.version}). Por favor, actualiza para obtener las últimas mejoras.`,
            action: (
              <div className="flex gap-2">
                <ToastAction
                  altText="Cerrar"
                  onClick={async () => {
                    // Dismiss the update and save to Firestore
                    await setDoc(userDocRef, {
                      dismissedVersion: data.version,
                      dismissedAt: new Date(),
                    }, { merge: true });
                    toastResult.dismiss();
                  }}
                >
                  Cerrar
                </ToastAction>
                <ToastAction
                  altText="Actualizar"
                  onClick={async () => {
                    // Save the new version before reloading
                    await setDoc(userDocRef, {
                      dismissedVersion: data.version,
                      updatedAt: new Date(),
                    }, { merge: true });
                    // Reload the page
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
  }, [toast, hasShownToast, user, currentVersion]);

  return null; // This component does not render anything itself
}
