
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
  memberId?: string;
};

export type FutureMember = {
  id: string;
  name: string;
  baptismDate: Timestamp;
  photoURL?: string;
  baptismPhotos?: string[];
  isBaptized?: boolean;
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
    source: 'dashboard' | 'council' | 'family-search' | 'missionary-work';
    createdAt: Timestamp;
}

export type Birthday = {
  id: string;
  name: string;
  birthDate: Timestamp;
  photoURL?: string;
  isMember?: boolean;
  memberId?: string;
};

export type Baptism = {
    id: string;
    name: string;
    date: Timestamp;
    source: 'Manual' | 'Automático' | 'Nuevo Converso' | 'Futuro Miembro';
    photoURL?: string;
    baptismPhotos?: string[];
    observation?: string;
}

export type FamilySearchTraining = {
    id: string;
    familyName: string;
    createdAt: Timestamp;
    // Optional member reference if selected from existing members
    memberId?: string;
    memberName?: string; // Store member's full name for display
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

export type MissionaryImage = {
    id: string;
    imageUrl: string;
    description: string;
    createdAt: Timestamp;
    createdBy: string;
}

export type Service = {
    id: string;
    title: string;
    date: Timestamp;
    description: string;
    time?: string;
    councilNotified?: boolean;
    imageUrls?: string[];
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
    // Navigation data for clickable notifications
    actionUrl?: string;
    actionType?: 'navigate' | 'external';
    // Context data to determine navigation route
    contextType?: 'convert' | 'activity' | 'service' | 'member' | 'council' | 'baptism' | 'birthday' | 'investigator';
    contextId?: string;
}

// Member management types
export type MemberStatus = 'active' | 'less_active' | 'inactive';

// Ordenanzas disponibles
export type Ordinance = 
    | 'baptism' 
    | 'confirmation' 
    | 'elder_ordination' 
    | 'endowment' 
    | 'sealed_spouse' 
    | 'high_priest_ordination';

export const OrdinanceLabels: Record<Ordinance, string> = {
    baptism: 'Bautismo',
    confirmation: 'Confirmación',
    elder_ordination: 'Ordenado élder',
    endowment: 'Investidura',
    sealed_spouse: 'Sellado(a) al cónyuge',
    high_priest_ordination: 'Ordenado sumo sacerdote'
};

export type Member = {
    id: string;
    firstName: string;
    lastName: string;
    photoURL?: string;
    birthDate?: Timestamp;
    baptismDate?: Timestamp; // Fecha de bautismo del miembro
    baptismPhotos?: string[]; // Fotos del bautismo
    phoneNumber?: string;
    address?: string; // Dirección del miembro
    status: MemberStatus;
    ordinances?: Ordinance[]; // Ordenanzas recibidas
    // Ministering information
    ministeringTeachers?: string[]; // Nombres de los maestros ministrantes
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    // Activity tracking
    lastActiveDate?: Timestamp;
    inactiveSince?: Timestamp | null;
    // Council tracking
    councilCompleted?: boolean;
    councilCompletedAt?: Timestamp;
    // For less active members tracking
    lessActiveObservation?: string;
    lessActiveCompletedAt?: Timestamp;
}
