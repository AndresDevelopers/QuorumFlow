import { collection, type CollectionReference } from 'firebase/firestore';
import { firestore, storage } from './firebase'; // Import the initialized storage instance

export { storage }; // Export storage directly

<<<<<<< HEAD
// Function to get collection reference that works on both client and server
const getCollection = (path: string): CollectionReference => {
  // Try to get firestore instance
  if (firestore) {
    return collection(firestore, path);
  }
  
  // If firestore is not available, try to initialize it
  try {
    const { initializeApp, getApps, getApp } = require('firebase/app');
    const { getFirestore } = require('firebase/firestore');
    const { firebaseConfig } = require('@/firebaseConfig');
    
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    return collection(db, path);
  } catch (error) {
    console.error('Failed to initialize Firebase for collection:', path, error);
    // Return a placeholder that will cause a clear error
    throw new Error(`Firebase not initialized for collection: ${path}`);
  }
};

// Export collection getters that work on both client and server
export const getMinisteringCollection = () => getCollection('c_ministracion');
export const getMinisteringHistoryCollection = () => getCollection('c_ministracion_historial');
export const getConvertsCollection = () => getCollection('c_conversos');
export const getFutureMembersCollection = () => getCollection('c_futuros_miembros');
export const getActivitiesCollection = () => getCollection('c_actividades');
export const getAnnotationsCollection = () => getCollection('c_anotaciones');
export const getBirthdaysCollection = () => getCollection('c_cumpleanos');
export const getBaptismsCollection = () => getCollection('c_bautismos');
export const getFamilySearchTrainingsCollection = () => getCollection('c_fs_capacitaciones');
export const getFamilySearchTasksCollection = () => getCollection('c_fs_pendientes');
export const getFamilySearchAnnotationsCollection = () => getCollection('c_fs_anotaciones');
export const getMissionaryAssignmentsCollection = () => getCollection('c_obra_misional_asignaciones');
export const getInvestigatorsCollection = () => getCollection('c_obra_misional_investigadores');
export const getNewConvertFriendsCollection = () => getCollection('c_obra_misional_amigos_conversos');
export const getMissionaryImagesCollection = () => getCollection('c_obra_misional_imagenes');
export const getServicesCollection = () => getCollection('c_servicios');
export const getAnnualReportsCollection = () => getCollection('c_reporte_anual');
export const getPushSubscriptionsCollection = () => getCollection('c_push_subscriptions');
export const getUsersCollection = () => getCollection('c_users');
export const getNotificationsCollection = () => getCollection('c_notifications');
export const getMembersCollection = () => getCollection('c_miembros');

// Legacy exports for backward compatibility (client-side only)
const isBrowser = typeof window !== 'undefined';
const coll = (path: string) =>
  isBrowser && firestore
    ? collection(firestore, path)
    : ({} as unknown as CollectionReference);
=======
const coll = (path: string) => {
  if (!firestore) {
    throw new Error('Firebase client not initialized');
  }
  return collection(firestore, path);
};
>>>>>>> 3fed7c8ae3c214fac94ad69ebc54c530434ccaf1

export const ministeringCollection = coll('c_ministracion');
export const ministeringHistoryCollection = coll('c_ministracion_historial');
export const convertsCollection = coll('c_conversos');
export const futureMembersCollection = coll('c_futuros_miembros');
export const activitiesCollection = coll('c_actividades');
export const annotationsCollection = coll('c_anotaciones');
export const birthdaysCollection = coll('c_cumpleanos');
export const baptismsCollection = coll('c_bautismos');
export const familySearchTrainingsCollection = coll('c_fs_capacitaciones');
export const familySearchTasksCollection = coll('c_fs_pendientes');
export const familySearchAnnotationsCollection = coll('c_fs_anotaciones');
export const missionaryAssignmentsCollection = coll('c_obra_misional_asignaciones');
export const investigatorsCollection = coll('c_obra_misional_investigadores');
export const newConvertFriendsCollection = coll('c_obra_misional_amigos_conversos');
export const missionaryImagesCollection = coll('c_obra_misional_imagenes');
export const servicesCollection = coll('c_servicios');
export const annualReportsCollection = coll('c_reporte_anual');
export const pushSubscriptionsCollection = coll('c_push_subscriptions');
export const usersCollection = coll('c_users');
export const notificationsCollection = coll('c_notifications');
export const membersCollection = coll('c_miembros');
// Add other collections here
