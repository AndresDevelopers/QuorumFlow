import { Companionship, Member } from './types';
import { getDocs } from 'firebase/firestore';
import { ministeringCollection, membersCollection } from './collections';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  conflicts?: {
    duplicateCompanions: string[];
    duplicateFamilies: string[];
    companionAlreadyAssigned: { companion: string; companionship: string }[];
    familyAlreadyAssigned: { family: string; companionship: string }[];
  };
}

/**
 * Valida que no haya compañeros duplicados en el mismo compañerismo
 */
export function validateNoDuplicateCompanions(companions: string[]): {
  valid: boolean;
  duplicates: string[];
} {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  companions.forEach((companion) => {
    const normalized = companion.trim().toLowerCase();
    if (seen.has(normalized)) {
      duplicates.push(companion);
    }
    seen.add(normalized);
  });

  return {
    valid: duplicates.length === 0,
    duplicates,
  };
}

/**
 * Valida que no haya familias duplicadas en el mismo compañerismo
 */
export function validateNoDuplicateFamilies(families: string[]): {
  valid: boolean;
  duplicates: string[];
} {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  families.forEach((family) => {
    const normalized = family.trim().toLowerCase();
    if (seen.has(normalized)) {
      duplicates.push(family);
    }
    seen.add(normalized);
  });

  return {
    valid: duplicates.length === 0,
    duplicates,
  };
}

/**
 * Valida que un compañero no esté ya asignado a otro compañerismo
 */
export async function validateCompanionNotAlreadyAssigned(
  companion: string,
  excludeCompanionshipId?: string
): Promise<{ valid: boolean; assignedTo?: string }> {
  try {
    const companionships = await getDocs(ministeringCollection);
    const normalizedCompanion = companion.trim().toLowerCase();

    for (const doc of companionships.docs) {
      // Saltar el compañerismo actual si es edición
      if (excludeCompanionshipId && doc.id === excludeCompanionshipId) {
        continue;
      }

      const companionshipData = doc.data() as Companionship;
      const companions = companionshipData.companions || [];

      const isAlreadyAssigned = companions.some(
        (c) => c.trim().toLowerCase() === normalizedCompanion
      );

      if (isAlreadyAssigned) {
        return {
          valid: false,
          assignedTo: doc.id,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating companion assignment:', error);
    return { valid: true }; // No fallar la validación por error
  }
}

/**
 * Valida que una familia no esté ya asignada a otro compañerismo
 */
export async function validateFamilyNotAlreadyAssigned(
  familyName: string,
  excludeCompanionshipId?: string
): Promise<{ valid: boolean; assignedTo?: string }> {
  try {
    const companionships = await getDocs(ministeringCollection);
    const normalizedFamily = familyName.trim().toLowerCase();

    for (const doc of companionships.docs) {
      // Saltar el compañerismo actual si es edición
      if (excludeCompanionshipId && doc.id === excludeCompanionshipId) {
        continue;
      }

      const companionshipData = doc.data() as Companionship;
      const families = companionshipData.families || [];

      const isAlreadyAssigned = families.some(
        (f) => f.name.trim().toLowerCase() === normalizedFamily
      );

      if (isAlreadyAssigned) {
        return {
          valid: false,
          assignedTo: doc.id,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating family assignment:', error);
    return { valid: true }; // No fallar la validación por error
  }
}

/**
 * Valida que compañeros y familias no se superpongan (un compañero no es también familia)
 */
export function validateNoOverlap(companions: string[], families: string[]): {
  valid: boolean;
  overlapping: string[];
} {
  const normalizedCompanions = new Set(companions.map((c) => c.trim().toLowerCase()));
  const overlapping: string[] = [];

  families.forEach((family) => {
    const normalizedFamily = family.trim().toLowerCase();
    if (normalizedCompanions.has(normalizedFamily)) {
      overlapping.push(family);
    }
  });

  return {
    valid: overlapping.length === 0,
    overlapping,
  };
}

/**
 * Validación completa de un compañerismo
 */
export async function validateCompanionshipData(
  companions: string[],
  families: string[],
  excludeCompanionshipId?: string
): Promise<ValidationResult> {
  const conflicts = {
    duplicateCompanions: [] as string[],
    duplicateFamilies: [] as string[],
    companionAlreadyAssigned: [] as { companion: string; companionship: string }[],
    familyAlreadyAssigned: [] as { family: string; companionship: string }[],
  };

  // Validar sin duplicados dentro del mismo compañerismo
  const companionDuplicates = validateNoDuplicateCompanions(companions);
  if (!companionDuplicates.valid) {
    conflicts.duplicateCompanions = companionDuplicates.duplicates;
  }

  const familyDuplicates = validateNoDuplicateFamilies(families);
  if (!familyDuplicates.valid) {
    conflicts.duplicateFamilies = familyDuplicates.duplicates;
  }

  // Validar que no haya solapamiento (un compañero no es también familia)
  const overlapCheck = validateNoOverlap(companions, families);
  if (!overlapCheck.valid) {
    return {
      valid: false,
      error: `Los siguientes están asignados como compañeros y también como familias: ${overlapCheck.overlapping.join(', ')}`,
      conflicts,
    };
  }

  // Validar que compañeros no estén en otros compañerismos
  for (const companion of companions) {
    const companionCheck = await validateCompanionNotAlreadyAssigned(
      companion,
      excludeCompanionshipId
    );
    if (!companionCheck.valid) {
      conflicts.companionAlreadyAssigned.push({
        companion,
        companionship: companionCheck.assignedTo || '',
      });
    }
  }

  // Validar que familias no estén en otros compañerismos
  for (const family of families) {
    const familyCheck = await validateFamilyNotAlreadyAssigned(family, excludeCompanionshipId);
    if (!familyCheck.valid) {
      conflicts.familyAlreadyAssigned.push({
        family,
        companionship: familyCheck.assignedTo || '',
      });
    }
  }

  // Determinar si hay errores
  const hasErrors =
    conflicts.duplicateCompanions.length > 0 ||
    conflicts.duplicateFamilies.length > 0 ||
    conflicts.companionAlreadyAssigned.length > 0 ||
    conflicts.familyAlreadyAssigned.length > 0;

  if (hasErrors) {
    let errorMessage = 'Se encontraron los siguientes conflictos:\n\n';

    if (conflicts.duplicateCompanions.length > 0) {
      errorMessage += `• Compañeros duplicados: ${conflicts.duplicateCompanions.join(', ')}\n`;
    }

    if (conflicts.duplicateFamilies.length > 0) {
      errorMessage += `• Familias duplicadas: ${conflicts.duplicateFamilies.join(', ')}\n`;
    }

    if (conflicts.companionAlreadyAssigned.length > 0) {
      errorMessage += `• Compañeros ya asignados:\n${conflicts.companionAlreadyAssigned
        .map((c) => `  - ${c.companion} (en otro compañerismo)`)
        .join('\n')}\n`;
    }

    if (conflicts.familyAlreadyAssigned.length > 0) {
      errorMessage += `• Familias ya asignadas:\n${conflicts.familyAlreadyAssigned
        .map((f) => `  - ${f.family} (en otro compañerismo)`)
        .join('\n')}`;
    }

    return {
      valid: false,
      error: errorMessage,
      conflicts,
    };
  }

  return {
    valid: true,
    conflicts,
  };
}
