import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK
let app: App;
let firestoreAdmin: Firestore;
let storageAdmin: Storage;

if (!getApps().length) {
  try {
    // Use service account from environment variables
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (serviceAccount.project_id === envProjectId) {
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: envProjectId,
        });
      } else {
        console.warn(`Service account project (${serviceAccount.project_id}) does not match env project (${envProjectId}). Using env project without credentials.`);
        // Fallback to Application Default Credentials
        app = initializeApp({
          projectId: envProjectId,
        });
      }
    } else {
      // Fallback to Application Default Credentials
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    // Fallback: try without credentials (for development)
    try {
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
      throw error; // Re-throw original error
    }
  }
} else {
  app = getApps()[0];
}

firestoreAdmin = getFirestore(app);
storageAdmin = getStorage(app);

export { firestoreAdmin, storageAdmin };