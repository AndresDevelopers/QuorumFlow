
import { Timestamp } from 'firebase/firestore';

export type Family = {
  name: string;
  isUrgent: boolean;
  observation: string;
  visitedThisMonth: boolean;
};

export type Companionship = {
  id: string;
  companions: string[];
  families: Family[];
};

export type Convert = {
  id: string;
  name: string;
  baptismDate: Timestamp;
  photoURL?: string;
  councilCompleted?: boolean;
  councilCompletedAt?: Timestamp | null;
  observation?: string;
  missionaryReference?: string;
};

export type FutureMember = {
  id: string;
  name: string;
  baptismDate: Timestamp;
  photoURL?: string;
  baptismPhotos?: string[];
};

export type Activity = {
  id: string;
  title: string;
  date: Timestamp;
  description: string;
  time?: string;
  imageUrls?: string[];
  location?: string;
  context?: string;
  learning?: string;
  additionalText?: string;
}

export type Annotation = {
    id: string;
    text: string;
    isCouncilAction: boolean;
    isResolved: boolean;
    source: 'dashboard' | 'council';
    createdAt: Timestamp;
}

export type Birthday = {
  id: string;
  name: string;
  birthDate: Timestamp;
  photoURL?: string;
};

export type Baptism = {
    id: string;
    name: string;
    date: Timestamp;
    source: 'Manual' | 'Automático';
    photoUrls?: string[];
}

export type FamilySearchTraining = {
    id: string;
    familyName: string;
    createdAt: Timestamp;
}

export type FamilySearchTask = {
    id: string;
    task: string;
    createdAt: Timestamp;
}

export type FamilySearchAnnotation = {
    id: string;
    note: string;
    createdAt: Timestamp;
}

export type MissionaryAssignment = {
    id: string;
    description: string;
    time?: string;
    isCompleted: boolean;
    createdAt: Timestamp;
}

export type Investigator = {
    id: string;
    name: string;
    assignedMissionaries: string;
    status: 'active' | 'baptized';
    createdAt: Timestamp;
    convertId?: string;
    linkedAt?: Timestamp;
}

export type NewConvertFriendship = {
    id: string;
    convertId: string;
    convertName: string;
    friends: string[];
    assignedAt: Timestamp;
}

export type Service = {
    id: string;
    title: string;
    date: Timestamp;
    description: string;
    time?: string;
    councilNotified?: boolean;
}

export type AnnualReportAnswers = {
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    p5: string;
    p6: string;
}

export type AppNotification = {
    id: string;
    userId: string;
    title: string;
    body: string;
    createdAt: Timestamp;
    isRead: boolean;
}
