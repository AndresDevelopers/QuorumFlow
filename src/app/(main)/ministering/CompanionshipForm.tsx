
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, updateDoc, doc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { ministeringCollection, membersCollection } from '@/lib/collections';
import logger from '@/lib/logger';
import { updateMinisteringTeachersOnCompanionshipChange } from '@/lib/ministering-reverse-sync';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormField, FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, UserCheck, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Companionship, Member } from '@/lib/types';
import { validateCompanionshipData } from '@/lib/ministering-validations';

const companionshipSchema = z.object({
   companions: z.array(z.object({ value: z.string().min(1, 'El nombre es requerido.') })).min(2, { message: 'Se requieren al menos dos compañeros.' }),
   families: z.array(z.object({ value: z.string().min(1, 'El nombre es requerido.') })).min(1, { message: 'Se requiere al menos una familia.' }),
});

type FormValues = z.infer<typeof companionshipSchema>;

interface CompanionshipFormProps {
    companionship?: Companionship;
    onCancel?: () => void; // Add onCancel prop
}


export function CompanionshipForm({ companionship, onCancel }: CompanionshipFormProps) {
   const router = useRouter();
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);

   const isEditMode = !!companionship;

   // New state for dual mode functionality
   // En modo edición, iniciar en modo manual para mostrar los valores existentes
   const [companionEntryMode, setCompanionEntryMode] = useState<'manual' | 'automatic'>(isEditMode ? 'manual' : 'automatic');
   const [familyEntryMode, setFamilyEntryMode] = useState<'manual' | 'automatic'>(isEditMode ? 'manual' : 'automatic');
   const [members, setMembers] = useState<Member[]>([]);
   const [loadingMembers, setLoadingMembers] = useState(false);

  const defaultValues = isEditMode
  ? {
      companions: companionship.companions.map(c => ({ value: c })),
      families: companionship.families.map(f => ({ value: f.name })),
    }
  : {
      companions: [{ value: '' }, { value: '' }],
      families: [{ value: '' }],
    };

  // Load members for automatic mode
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const snapshot = await getDocs(query(membersCollection, orderBy('firstName', 'asc')));
      const membersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersList);
    } catch (error) {
      console.error("Error loading members:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los miembros.",
        variant: "destructive",
      });
    }
    setLoadingMembers(false);
  }, [toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const form = useForm<FormValues>({
    resolver: zodResolver(companionshipSchema),
    defaultValues,
  });

  // Handle member selection for companions
  const handleCompanionMemberSelect = (memberId: string, index: number) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      form.setValue(`companions.${index}.value`, `${member.firstName} ${member.lastName}`);
    }
  };

  // Handle member selection for families
  const handleFamilyMemberSelect = (memberId: string, index: number) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      // Use family name format (could be last name or full name based on your preference)
      form.setValue(`families.${index}.value`, `Familia ${member.lastName}`);
    }
  };

  // Handle entry mode changes
  const handleCompanionModeChange = (mode: 'manual' | 'automatic') => {
    setCompanionEntryMode(mode);
    // En modo edición, no limpiar los campos al cambiar de modo
    if (mode === 'manual' && !isEditMode) {
      // Clear companion fields when switching to manual (solo en modo creación)
      companionFields.forEach((_, index) => {
        form.setValue(`companions.${index}.value`, '');
      });
    }
  };

  const handleFamilyModeChange = (mode: 'manual' | 'automatic') => {
    setFamilyEntryMode(mode);
    // En modo edición, no limpiar los campos al cambiar de modo
    if (mode === 'manual' && !isEditMode) {
      // Clear family fields when switching to manual (solo en modo creación)
      familyFields.forEach((_, index) => {
        form.setValue(`families.${index}.value`, '');
      });
    }
  };

  const {
    fields: companionFields,
    append: appendCompanion,
    remove: removeCompanion,
  } = useFieldArray({ control: form.control, name: 'companions' });
  const {
    fields: familyFields,
    append: appendFamily,
    remove: removeFamily,
  } = useFieldArray({ control: form.control, name: 'families' });

  // Función para sincronizar compañeros cuando se eliminan familias
  const syncCompanionsWithFamilies = (familyCount: number) => {
    const currentCompanionCount = companionFields.length;

    // Si quedan muy pocas familias, reducir compañeros proporcionalmente
    // Mantener siempre al menos 2 compañeros (requerimiento del schema)
    let targetCompanionCount = Math.max(2, Math.min(currentCompanionCount, familyCount + 1));

    // Si hay más compañeros que el objetivo, eliminar los excedentes
    if (currentCompanionCount > targetCompanionCount) {
      const companionsToRemove = currentCompanionCount - targetCompanionCount;
      for (let i = 0; i < companionsToRemove; i++) {
        removeCompanion(currentCompanionCount - 1 - i);
      }
    }
  };

  // Modificar removeFamily para incluir sincronización
  const handleRemoveFamily = (index: number) => {
    if (familyFields.length <= 1) {
      // No permitir eliminar la última familia
      toast({
        title: "No se puede eliminar",
        description: "Debe mantener al menos una familia en el compañerismo.",
        variant: "destructive",
      });
      return;
    }

    removeFamily(index);

    // Sincronizar compañeros después de un breve delay para que el estado se actualice
    setTimeout(() => {
      const remainingFamilies = familyFields.length; // Ya se actualizó después de removeFamily
      syncCompanionsWithFamilies(remainingFamilies);
    }, 100);
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
        // Validar que no haya duplicados ni conflictos
        const companionNames = values.companions.map(c => c.value);
        const newFamilyNames = values.families.map(f => f.value);

        const validationResult = await validateCompanionshipData(
          companionNames,
          newFamilyNames,
          isEditMode ? companionship.id : undefined
        );

        if (!validationResult.valid) {
          toast({
            title: 'Error de Validación',
            description: validationResult.error || 'Hay conflictos en la asignación',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        // Synchronize ministering assignments using reverse sync
        if (isEditMode) {
            const oldCompanions = companionship.companions;
            const oldFamilies = companionship.families.map(f => f.name);
            
            console.log('📢 [FORM] Calling updateMinisteringTeachersOnCompanionshipChange with:', {
              oldCompanions,
              oldFamilies,
              newCompanions: companionNames,
              newFamilyNames
            });
            
            await updateMinisteringTeachersOnCompanionshipChange(
                oldCompanions,
                companionNames,
                oldFamilies,
                newFamilyNames
            );
        } else {
            // For new companionships, add ministering assignments
            for (const familyName of newFamilyNames) {
                const lastName = familyName.replace('Familia ', '');
                const memberQuery = query(membersCollection, where('lastName', '==', lastName));
                const memberSnap = await getDocs(memberQuery);
                if (!memberSnap.empty) {
                    const memberDoc = memberSnap.docs[0];
                    const member = { id: memberDoc.id, ...memberDoc.data() } as Member;
                    const currentTeachers = member.ministeringTeachers || [];
                    const newTeachers = [...new Set([...currentTeachers, ...companionNames])];
                    await updateDoc(doc(membersCollection, member.id), { ministeringTeachers: newTeachers });
                }
            }
        }

        if (isEditMode) {
             const companionshipRef = doc(ministeringCollection, companionship.id);
             
             // Smartly update families: keep existing data, remove old, add new
             const newFamilyNames = values.families.map(f => f.value);
             const existingFamilies = companionship.families;
             const updatedFamilies = newFamilyNames.map(name => {
                 const existing = existingFamilies.find(f => f.name === name);
                 return existing || { name, isUrgent: false, observation: '', visitedThisMonth: false };
             });

             await updateDoc(companionshipRef, {
                companions: values.companions.map(c => c.value),
                families: updatedFamilies,
             });

             toast({
                title: "Compañerismo Actualizado",
                description: "Los cambios se han guardado correctamente.",
             });
             // Instead of router.push, we call a refresh or passed-in handler if available
             // For simplicity, we can let the parent page handle refresh logic.
             if (onCancel) onCancel(); // Exit edit mode
             router.refresh(); // Force a server-side refresh of the page
        } else {
            const familiesWithObjects = values.families.map(f => ({
                name: f.value,
                isUrgent: false,
                observation: '',
                visitedThisMonth: false,
            }));

            await addDoc(ministeringCollection, {
                companions: values.companions.map(c => c.value),
                families: familiesWithObjects,
            });

            toast({
                title: "Compañerismo Agregado",
                description: "La asignación se ha guardado correctamente.",
            });
            router.push('/ministering');
        }
    } catch (error) {
      logger.error({ error, message: 'Error saving companionship' });
      toast({
        title: 'Error',
        description: 'No se pudo guardar la asignación.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? 'Editar Compañerismo' : 'Agregar Nuevo Compañerismo'}</CardTitle>
            <CardDescription>
              {isEditMode ? 'Actualiza los compañeros y las familias asignadas.' : 'Define los compañeros y las familias que ministrarán.'}
              <br />
              <span className="text-sm text-muted-foreground">Los campos marcados con * son obligatorios.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Companion Entry Mode Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Método de Registro - Compañeros</Label>
                <p className="text-sm text-muted-foreground">Selecciona cómo deseas registrar los compañeros</p>
              </div>
              <RadioGroup
                value={companionEntryMode}
                onValueChange={(value) => handleCompanionModeChange(value as 'manual' | 'automatic')}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="companion-manual" />
                  <Label htmlFor="companion-manual" className="flex items-center gap-2 cursor-pointer">
                    <Edit3 className="h-4 w-4" />
                    Manual - Ingresar nombres manualmente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="companion-automatic" />
                  <Label htmlFor="companion-automatic" className="flex items-center gap-2 cursor-pointer">
                    <UserCheck className="h-4 w-4" />
                    Automático - Seleccionar miembros existentes
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Compañeros *</Label>
              {companionFields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`companions.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        {companionEntryMode === 'automatic' ? (
                          <Select onValueChange={(value) => handleCompanionMemberSelect(value, index)} disabled={loadingMembers}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingMembers ? "Cargando..." : `Seleccionar compañero ${index + 1}`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={member.photoURL} />
                                      <AvatarFallback className="text-xs">
                                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {member.firstName} {member.lastName}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input {...field} placeholder={`Compañero ${index + 1}`} />
                          </FormControl>
                        )}
                        <Button type="button" variant="outline" size="icon" onClick={() => removeCompanion(index)} disabled={companionFields.length <= 2}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendCompanion({ value: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Compañero
              </Button>
            </div>

            {/* Family Entry Mode Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Método de Registro - Familias</Label>
                <p className="text-sm text-muted-foreground">Selecciona cómo deseas registrar las familias</p>
              </div>
              <RadioGroup
                value={familyEntryMode}
                onValueChange={(value) => handleFamilyModeChange(value as 'manual' | 'automatic')}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="family-manual" />
                  <Label htmlFor="family-manual" className="flex items-center gap-2 cursor-pointer">
                    <Edit3 className="h-4 w-4" />
                    Manual - Ingresar nombres manualmente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="family-automatic" />
                  <Label htmlFor="family-automatic" className="flex items-center gap-2 cursor-pointer">
                    <UserCheck className="h-4 w-4" />
                    Automático - Seleccionar miembros existentes
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Familias Asignadas *</Label>
              {familyFields.map((field, index) => (
                 <FormField
                  key={field.id}
                  control={form.control}
                  name={`families.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        {familyEntryMode === 'automatic' ? (
                          <Select onValueChange={(value) => handleFamilyMemberSelect(value, index)} disabled={loadingMembers}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={loadingMembers ? "Cargando..." : `Seleccionar familia ${index + 1}`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={member.photoURL} />
                                      <AvatarFallback className="text-xs">
                                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    Familia {member.lastName}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input {...field} placeholder={`Familia ${index + 1}`} />
                          </FormControl>
                        )}
                        <Button type="button" variant="outline" size="icon" onClick={() => handleRemoveFamily(index)} disabled={familyFields.length <= 1}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendFamily({ value: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Familia
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
              {isEditMode ? (
                 <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                 </Button>
              ) : (
                <Button variant="outline" asChild>
                    <Link href="/ministering">Cancelar</Link>
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
