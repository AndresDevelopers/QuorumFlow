// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { firebaseConfig } from "@/firebaseConfig"; // Import config from the new file
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Initialize Firebase app on both server and client
let app: ReturnType<typeof getApp> | undefined;
app = getApps().length === 0 ? initializeApp(firebaseConfig as any) : getApp();

// Export client SDK instances
export const auth = app ? getAuth(app) : (undefined as unknown as ReturnType<typeof getAuth>);
export const firestore = app ? getFirestore(app) : (undefined as unknown as ReturnType<typeof getFirestore>);
export const storage = app ? getStorage(app) : (undefined as unknown as ReturnType<typeof getStorage>);
export const functions = app ? getFunctions(app) : (undefined as unknown as ReturnType<typeof getFunctions>);

export { app };
