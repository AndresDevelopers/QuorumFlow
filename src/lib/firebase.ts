// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { firebaseConfig } from "@/firebaseConfig"; // Import config from the new file
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Guard Firebase client initialization to browser only to avoid SSR/prerender errors
const isBrowser = typeof window !== "undefined";

let app: ReturnType<typeof getApp> | undefined;
if (isBrowser) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig as any) : getApp();
}

// Export client SDK instances only on the browser. On the server, these are undefined placeholders.
// Components marked with 'use client' will access these at runtime in the browser.
export const auth = (isBrowser && app) ? getAuth(app) : (undefined as unknown as ReturnType<typeof getAuth>);
export const firestore = (isBrowser && app) ? getFirestore(app) : (undefined as unknown as ReturnType<typeof getFirestore>);
export const storage = (isBrowser && app) ? getStorage(app) : (undefined as unknown as ReturnType<typeof getStorage>);
export const functions = (isBrowser && app) ? getFunctions(app) : (undefined as unknown as ReturnType<typeof getFunctions>);

export { app };
