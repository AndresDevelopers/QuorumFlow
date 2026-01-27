/**
 * Sincronización inversa: de Ministración a Miembros
 * Cuando se elimina o modifica un compañerismo, actualiza los maestros ministrantes de los miembros
 */

import { getDocs, query, where, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { membersCollection } from './collections';
import { firestore } from './firebase';
import type { Member } from './types';
import logger from './logger';

/**
 * Elimina los maestros ministrantes de las familias cuando se elimina un compañerismo
 * @param companionNames - Nombres de los compañeros del compañerismo eliminado
 * @param familyNames - Nombres de las familias asignadas
 */
export async function removeMinisteringTeachersFromFamilies(
  companionNames: string[],
  familyNames: string[]
): Promise<void> {
  try {
    const normalizedCompanions = companionNames.map(name => name.trim().toLowerCase());

    console.log('🔄 Removing ministering teachers from families:', {
      companions: companionNames,
      families: familyNames
    });

    const batch = writeBatch(firestore);
    let batchCount = 0;

    for (const familyName of familyNames) {
      // Extraer el apellido de "Familia Apellido"
      const lastName = familyName.replace('Familia ', '').trim();
      
      // Buscar miembros con ese apellido
      const memberQuery = query(membersCollection, where('lastName', '==', lastName));
      const memberSnap = await getDocs(memberQuery);

      if (!memberSnap.empty) {
        for (const memberDoc of memberSnap.docs) {
          const member = { id: memberDoc.id, ...memberDoc.data() } as Member;
          
          if (member.ministeringTeachers && member.ministeringTeachers.length > 0) {
            // Filtrar los maestros que pertenecen a este compañerismo
            const updatedTeachers = member.ministeringTeachers.filter(
              teacher => !normalizedCompanions.includes(teacher.trim().toLowerCase())
            );

            // Solo actualizar si hubo cambios
            if (updatedTeachers.length !== member.ministeringTeachers.length) {
              console.log(`  ✏️ Updating ${member.firstName} ${member.lastName}:`, {
                before: member.ministeringTeachers,
                after: updatedTeachers
              });

              const memberRef = doc(membersCollection, member.id);
              batch.update(memberRef, { ministeringTeachers: updatedTeachers });
              batchCount++;

              // Ejecutar batch si alcanzamos el límite
              if (batchCount >= 500) {
                await batch.commit();
                batchCount = 0;
              }
            }
          }
        }
      }
    }

    // Ejecutar operaciones restantes
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log('✅ Successfully removed ministering teachers from families');
  } catch (error) {
    logger.error({ error, message: 'Error removing ministering teachers from families' });
    throw new Error(`Error al eliminar maestros ministrantes: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Actualiza los maestros ministrantes cuando se modifica un compañerismo
 * @param oldCompanions - Compañeros anteriores
 * @param newCompanions - Compañeros nuevos
 * @param oldFamilies - Familias anteriores
 * @param newFamilies - Familias nuevas
 */
export async function updateMinisteringTeachersOnCompanionshipChange(
  oldCompanions: string[],
  newCompanions: string[],
  oldFamilies: string[],
  newFamilies: string[]
): Promise<void> {
  try {
    console.log('🔄 Updating ministering teachers on companionship change:', {
      oldCompanions,
      newCompanions,
      oldFamilies,
      newFamilies
    });

    // Familias que se eliminaron del compañerismo
    const removedFamilies = oldFamilies.filter(f => !newFamilies.includes(f));
    
    // Familias que se agregaron al compañerismo
    const addedFamilies = newFamilies.filter(f => !oldFamilies.includes(f));

    // Familias que permanecen pero los compañeros cambiaron
    const remainingFamilies = oldFamilies.filter(f => newFamilies.includes(f));

    const batch = writeBatch(firestore);
    let batchCount = 0;

    // 1. Eliminar maestros de las familias removidas
    if (removedFamilies.length > 0) {
      for (const familyName of removedFamilies) {
        const lastName = familyName.replace('Familia ', '').trim();
        const memberQuery = query(membersCollection, where('lastName', '==', lastName));
        const memberSnap = await getDocs(memberQuery);

        if (!memberSnap.empty) {
          for (const memberDoc of memberSnap.docs) {
            const member = { id: memberDoc.id, ...memberDoc.data() } as Member;
            
            if (member.ministeringTeachers && member.ministeringTeachers.length > 0) {
              const updatedTeachers = member.ministeringTeachers.filter(
                teacher => !oldCompanions.includes(teacher)
              );

              if (updatedTeachers.length !== member.ministeringTeachers.length) {
                console.log(`  ➖ Removing from ${member.firstName} ${member.lastName}`);
                const memberRef = doc(membersCollection, member.id);
                batch.update(memberRef, { ministeringTeachers: updatedTeachers });
                batchCount++;
              }
            }
          }
        }
      }
    }

    // 2. Agregar maestros a las familias nuevas
    if (addedFamilies.length > 0) {
      for (const familyName of addedFamilies) {
        const lastName = familyName.replace('Familia ', '').trim();
        const memberQuery = query(membersCollection, where('lastName', '==', lastName));
        const memberSnap = await getDocs(memberQuery);

        if (!memberSnap.empty) {
          for (const memberDoc of memberSnap.docs) {
            const member = { id: memberDoc.id, ...memberDoc.data() } as Member;
            const currentTeachers = member.ministeringTeachers || [];
            const newTeachers = [...new Set([...currentTeachers, ...newCompanions])];

            if (newTeachers.length !== currentTeachers.length) {
              console.log(`  ➕ Adding to ${member.firstName} ${member.lastName}`);
              const memberRef = doc(membersCollection, member.id);
              batch.update(memberRef, { ministeringTeachers: newTeachers });
              batchCount++;
            }
          }
        }
      }
    }

    // 3. Actualizar maestros en familias que permanecen (si los compañeros cambiaron)
    const companionsChanged = JSON.stringify(oldCompanions.sort()) !== JSON.stringify(newCompanions.sort());
    
    if (companionsChanged && remainingFamilies.length > 0) {
      for (const familyName of remainingFamilies) {
        const lastName = familyName.replace('Familia ', '').trim();
        const memberQuery = query(membersCollection, where('lastName', '==', lastName));
        const memberSnap = await getDocs(memberQuery);

        if (!memberSnap.empty) {
          for (const memberDoc of memberSnap.docs) {
            const member = { id: memberDoc.id, ...memberDoc.data() } as Member;
            const currentTeachers = member.ministeringTeachers || [];
            
            // Remover compañeros antiguos y agregar nuevos
            const withoutOld = currentTeachers.filter(t => !oldCompanions.includes(t));
            const updatedTeachers = [...new Set([...withoutOld, ...newCompanions])];

            if (JSON.stringify(updatedTeachers.sort()) !== JSON.stringify(currentTeachers.sort())) {
              console.log(`  🔄 Updating ${member.firstName} ${member.lastName}`);
              const memberRef = doc(membersCollection, member.id);
              batch.update(memberRef, { ministeringTeachers: updatedTeachers });
              batchCount++;
            }
          }
        }
      }
    }

    // Ejecutar batch si hay operaciones
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Updated ${batchCount} member(s)`);
    } else {
      console.log('ℹ️ No changes needed');
    }

  } catch (error) {
    logger.error({ error, message: 'Error updating ministering teachers on companionship change' });
    throw new Error(`Error al actualizar maestros ministrantes: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
