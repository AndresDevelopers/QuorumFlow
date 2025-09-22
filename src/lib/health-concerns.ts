import { addDoc, deleteDoc, doc, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { healthConcernsCollection, storage } from './collections';
import type { HealthConcern } from './types';

type UploadResult = {
  photoURL: string;
  photoPath: string;
};

export type HealthConcernInput = {
  firstName: string;
  lastName: string;
  helperIds: string[];
  helperNames: string[];
  address: string;
  observation: string;
  createdBy: string;
  photoFile?: File | null;
};

const sanitizeFileName = (name: string) => {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
};

const uploadPhoto = async (file: File, userId: string): Promise<UploadResult> => {
  const safeName = sanitizeFileName(file.name || `salud-${Date.now()}.jpg`);
  const storagePath = `health-concerns/${userId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const photoURL = await getDownloadURL(storageRef);
  return { photoURL, photoPath: storagePath };
};

export const fetchHealthConcerns = async (): Promise<HealthConcern[]> => {
  const q = query(healthConcernsCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as HealthConcern));
};

export const createHealthConcern = async (
  input: HealthConcernInput
): Promise<HealthConcern> => {
  const now = Timestamp.now();
  let uploadResult: UploadResult | undefined;

  if (input.photoFile) {
    uploadResult = await uploadPhoto(input.photoFile, input.createdBy);
  }

  const data: Record<string, unknown> = {
    firstName: input.firstName,
    lastName: input.lastName,
    helperIds: input.helperIds,
    helperNames: input.helperNames,
    address: input.address,
    observation: input.observation,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  if (uploadResult) {
    data.photoURL = uploadResult.photoURL;
    data.photoPath = uploadResult.photoPath;
  }

  const docRef = await addDoc(healthConcernsCollection, data);

  return {
    id: docRef.id,
    firstName: input.firstName,
    lastName: input.lastName,
    helperIds: input.helperIds,
    helperNames: input.helperNames,
    address: input.address,
    observation: input.observation,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    photoURL: uploadResult?.photoURL,
    photoPath: uploadResult?.photoPath,
  };
};

export const deleteHealthConcern = async (
  id: string,
  photoPath?: string | null
): Promise<void> => {
  const docRef = doc(healthConcernsCollection, id);
  await deleteDoc(docRef);

  if (photoPath) {
    try {
      const storageRef = ref(storage, photoPath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error removing health concern photo:', error);
    }
  }
};
