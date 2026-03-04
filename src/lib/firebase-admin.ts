import { initializeApp, getApps, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin SDK
let app: App;
let firestoreAdmin: Firestore;
let storageAdmin: Storage;
let messagingAdmin: Messaging;
let warnedInvalidServiceAccount = false;
let warnedMissingServiceAccount = false;

type ServiceAccountWithLegacy = ServiceAccount & { project_id?: string };

function parseServiceAccountKey(value: string): ServiceAccountWithLegacy | null {
  const trimmed = value.trim();
  const candidates: string[] = [];

  if (trimmed) {
    candidates.push(trimmed);
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      candidates.push(trimmed.slice(1, -1));
    }
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
      try {
        candidates.push(Buffer.from(trimmed, 'base64').toString('utf8'));
      } catch {}
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as ServiceAccountWithLegacy;
      if (!parsed.projectId && parsed.project_id) {
        parsed.projectId = parsed.project_id;
      }
      return parsed;
    } catch {}
  }

  return null;
}

if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (serviceAccountKey) {
      const serviceAccount = parseServiceAccountKey(serviceAccountKey);
      if (serviceAccount) {
        if (envProjectId && serviceAccount.projectId && serviceAccount.projectId !== envProjectId) {
          // Project ID mismatch: override with the correct env project ID
          // The service account credentials (private key, client email) remain valid
          // as long as the SA has the proper IAM permissions on the env project.
          console.warn(
            `[firebase-admin] Service account project_id (${serviceAccount.projectId}) overridden ` +
            `with env project (${envProjectId}). Ensure the SA has FCM/Firestore permissions on ${envProjectId}.`
          );
          serviceAccount.projectId = envProjectId;
        }

        const resolvedProjectId = envProjectId ?? serviceAccount.projectId;

        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: resolvedProjectId,
        });
      } else {
        if (!warnedInvalidServiceAccount) {
          console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — using Application Default Credentials.');
          warnedInvalidServiceAccount = true;
        }
        app = initializeApp({
          projectId: envProjectId,
        });
      }
    } else {
      // Fallback: Application Default Credentials (works in Cloud Run / GCP)
      if (!warnedMissingServiceAccount) {
        console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY not set — using Application Default Credentials.');
        warnedMissingServiceAccount = true;
      }
      app = initializeApp({
        projectId: envProjectId,
      });
    }
  } catch (error) {
    console.error('[firebase-admin] Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
} else {
  app = getApps()[0];
}

firestoreAdmin = getFirestore(app);
storageAdmin = getStorage(app);
messagingAdmin = getMessaging(app);

export { firestoreAdmin, storageAdmin, messagingAdmin };
