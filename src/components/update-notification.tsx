
"use client";

import { useEffect, useMemo, useState } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { firestore } from "@/lib/firebase";
import logger from "@/lib/logger";
import { getCookie, setCookieWithMinutes, deleteCookie } from "@/lib/cookie-utils";
import { doc, getDoc, setDoc } from "firebase/firestore";

const VERSION_ENDPOINT = "/version.json";
const DISMISS_COOKIE = "update_dismissed";
const DISMISS_DURATION_MINUTES = 30;

interface UpdateNotificationProps {
  /**
   * Allows tests or calling code to provide the version that is currently running.
   * When omitted, the component will resolve it from {@link VERSION_ENDPOINT}.
   */
  currentVersion?: string;
  /**
   * Optional fetch implementation. Useful for dependency injection and testing.
   */
  fetchImpl?: typeof fetch;
  /**
   * Optional reload strategy. Defaults to `window.location.reload`.
   */
  onReload?: () => void;
}

interface VersionManifest {
  version?: string;
  [key: string]: unknown;
}

async function resolveVersion(fetchClient: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchClient(VERSION_ENDPOINT);
    const data: VersionManifest = await response.json();
    if (typeof data.version === "string" && data.version.trim().length > 0) {
      return data.version;
    }
    logger.warn({ data, message: "Version manifest missing version field" });
    return null;
  } catch (error) {
    logger.error({ error, message: "Unable to resolve application version" });
    return null;
  }
}

export function UpdateNotification({
  currentVersion: providedVersion,
  fetchImpl,
  onReload,
}: UpdateNotificationProps = {}) {
  const { toast, dismiss } = useToast();
  const { user } = useAuth();
  const { t } = useI18n();
  const [hasShownToast, setHasShownToast] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(providedVersion ?? null);

  const fetchClient = useMemo(() => fetchImpl ?? fetch, [fetchImpl]);
  const reload = useMemo(() => onReload ?? (() => window.location.reload()), [onReload]);

  useEffect(() => {
    let isMounted = true;

    if (providedVersion) {
      setCurrentVersion(providedVersion);
      return () => {
        isMounted = false;
      };
    }

    resolveVersion(fetchClient).then(version => {
      if (isMounted) {
        setCurrentVersion(version);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [providedVersion, fetchClient]);

  useEffect(() => {
    if (hasShownToast || !user || !currentVersion) {
      return;
    }

    if (getCookie(DISMISS_COOKIE) === "true") {
      return;
    }

    let isActive = true;

    const checkForUpdates = async () => {
      try {
        const latestVersion = await resolveVersion(fetchClient);
        if (!isActive || !latestVersion || latestVersion === currentVersion) {
          return;
        }

        const userDocRef = doc(firestore, "userPreferences", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!isActive) return;

        if (userDoc.exists()) {
          const { dismissedVersion } = userDoc.data() as { dismissedVersion?: string };
          if (dismissedVersion === latestVersion) {
            return;
          }
        }

        setHasShownToast(true);

        toast({
          title: "Nueva versión disponible",
          description: "Actualiza para obtener las últimas mejoras",
          duration: Infinity,
          action: (
            <div className="flex gap-2">
              <ToastAction
                altText={t("updateNotification.dismiss")}
                onClick={async () => {
                  try {
                    setCookieWithMinutes(DISMISS_COOKIE, "true", DISMISS_DURATION_MINUTES);
                    await setDoc(
                      userDocRef,
                      {
                        dismissedVersion: latestVersion,
                        dismissedAt: new Date().toISOString(),
                      },
                      { merge: true }
                    );
                  } catch (err) {
                    logger.warn({ error: err, message: "Failed to persist dismissed version" });
                  } finally {
                    dismiss();
                  }
                }}
              >
                {t("updateNotification.dismiss")}
              </ToastAction>
              <ToastAction
                altText={t("updateNotification.update")}
                onClick={async () => {
                  try {
                    deleteCookie(DISMISS_COOKIE);
                    await setDoc(
                      userDocRef,
                      {
                        dismissedVersion: latestVersion,
                        updatedAt: new Date().toISOString(),
                      },
                      { merge: true }
                    );
                  } catch (err) {
                    logger.warn({ error: err, message: "Failed to record update acknowledgement" });
                  } finally {
                    reload();
                  }
                }}
              >
                {t("updateNotification.update")}
              </ToastAction>
            </div>
          ),
        });
      } catch (error) {
        logger.warn({ error, message: "Error while checking for application updates" });
      }
    };

    checkForUpdates();

    return () => {
      isActive = false;
    };
  }, [
    toast,
    dismiss,
    hasShownToast,
    user,
    currentVersion,
    fetchClient,
    reload,
    t,
  ]);

  return null; // This component does not render anything itself
}
