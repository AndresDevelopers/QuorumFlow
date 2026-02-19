import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { firestore as db } from './firebase';
import { ministeringCollection } from './collections';
import type { Companionship, Member } from './types';

/**
 * Sincroniza las asignaciones de ministración cuando se actualizan los ministrantes de un miembro
 * @param member - El miembro que ha sido actualizado
 * @param previousTeachers - Los ministrantes previos (para comparar cambios)
 */
export async function syncMinisteringAssignments(
  member: Member, 
  previousTeachers: string[] = []
): Promise<void> {
  try {
    console.log('🔄 Syncing ministering assignments for:', {
      memberName: `${member.firstName} ${member.lastName}`,
      newTeachers: member.ministeringTeachers || [],
      previousTeachers
    });

    const currentTeachers = member.ministeringTeachers || [];
    const memberFamilyName = `Familia ${member.lastName}`;

    // Si no hay ministrantes actuales y tampoco había antes, no hay nada que hacer
    if (currentTeachers.length === 0 && previousTeachers.length === 0) {
      return;
    }

    // Obtener todos los compañerismos existentes
    const companionshipsSnapshot = await getDocs(ministeringCollection);
    const companionships = companionshipsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Companionship));

    console.log('📋 Current companionships:', companionships.length);

    // Remover al miembro de compañerismos anteriores si es necesario
    if (previousTeachers.length > 0) {
      await removeFromPreviousCompanionships(companionships, memberFamilyName, previousTeachers);
    }

    // Agregar al miembro a nuevos compañerismos si es necesario
    if (currentTeachers.length > 0) {
      await addToNewCompanionships(companionships, memberFamilyName, currentTeachers, member.id);
    }

    console.log('✅ Ministering assignments synced successfully');

  } catch (error) {
    console.error('❌ Error syncing ministering assignments:', error);
    throw new Error(`Error al sincronizar asignaciones de ministración: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Remueve un miembro de compañerismos anteriores
 */
async function removeFromPreviousCompanionships(
  companionships: Companionship[],
  memberFamilyName: string,
  previousTeachers: string[]
): Promise<void> {
  const batch = writeBatch(db);
  let batchOperations = 0;

  for (const companionship of companionships) {
    // Verificar si este compañerismo tiene alguno de los ministrantes anteriores
    const hasAnyPreviousTeacher = previousTeachers.some(teacher => 
      companionship.companions.includes(teacher)
    );

    if (hasAnyPreviousTeacher) {
      // Verificar si la familia está asignada a este compañerismo
      const familyIndex = companionship.families.findIndex(f => f.name === memberFamilyName);
      
      if (familyIndex !== -1) {
        console.log(`🗑️ Removing ${memberFamilyName} from companionship:`, companionship.companions);
        
        // Remover la familia del compañerismo
        const updatedFamilies = companionship.families.filter(f => f.name !== memberFamilyName);
        
        const companionshipRef = doc(ministeringCollection, companionship.id);
        batch.update(companionshipRef, { families: updatedFamilies });
        batchOperations++;

        // Ejecutar batch si hemos alcanzado el límite
        if (batchOperations >= 500) {
          await batch.commit();
          batchOperations = 0;
        }
      }
    }
  }

  // Ejecutar operaciones restantes
  if (batchOperations > 0) {
    await batch.commit();
  }
}

/**
 * Agrega un miembro a nuevos compañerismos o crea un nuevo compañerismo
 */
async function addToNewCompanionships(
  companionships: Companionship[],
  memberFamilyName: string,
  currentTeachers: string[],
  memberId: string
): Promise<void> {
  console.log('➕ Adding to new companionships:', { memberFamilyName, currentTeachers });

  // Buscar un compañerismo existente que tenga exactamente los mismos ministrantes
  const matchingCompanionship = companionships.find(companionship => 
    arraysEqual(companionship.companions.sort(), currentTeachers.sort())
  );

  if (matchingCompanionship) {
    // Verificar si la familia ya está asignada
    const familyExists = matchingCompanionship.families.some(f => f.name === memberFamilyName);
    
    if (!familyExists) {
      console.log('📝 Adding family to existing companionship:', matchingCompanionship.companions);
      
      // Agregar la familia al compañerismo existente
      const newFamily = {
        name: memberFamilyName,
        isUrgent: false,
        observation: '',
        memberId
      };

      const companionshipRef = doc(ministeringCollection, matchingCompanionship.id);
      await updateDoc(companionshipRef, {
        families: [...matchingCompanionship.families, newFamily]
      });
    } else {
      console.log('ℹ️ Family already exists in matching companionship');
    }
  } else {
    // Crear un nuevo compañerismo
    console.log('🆕 Creating new companionship for teachers:', currentTeachers);
    
    const newCompanionship = {
      companions: currentTeachers,
      families: [{
        name: memberFamilyName,
        isUrgent: false,
        observation: '',
        memberId
      }]
    };

    await addDoc(ministeringCollection, newCompanionship);
  }
}

/**
 * Compara dos arrays para ver si son iguales
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Obtiene los ministrantes actuales de un miembro antes de la actualización
 * @param memberId - ID del miembro
 * @returns Los ministrantes previos o array vacío
 */
export async function getPreviousMinisteringTeachers(memberId: string): Promise<string[]> {
  try {
    // Esta función será llamada desde el formulario antes de actualizar
    // Para obtener los ministrantes previos del miembro
    const { membersCollection } = await import('./collections');
    const memberDoc = await getDoc(doc(membersCollection, memberId));
    
    if (memberDoc.exists()) {
      const memberData = memberDoc.data() as Member;
      return memberData.ministeringTeachers || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error getting previous ministering teachers:', error);
    return [];
  }
}
