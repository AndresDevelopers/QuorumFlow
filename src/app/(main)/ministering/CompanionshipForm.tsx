'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDoc, updateDoc, doc, getDocs, query, orderBy, where, serverTimestamp, setDoc } from 'firebase/firestore';
import { ministeringCollection, membersCollection, ministeringDistrictsCollection } from '@/lib/collections';
import logger from '@/lib/logger';
import { updateMinisteringTeachersOnCompanionshipChange } from '@/lib/ministering-reverse-sync';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormField, FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Companionship, Member, MinisteringDistrict } from '@/lib/types';
import { normalizeMemberStatus } from '@/lib/members-data';
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

   // All entry modes use automatic mode - no manual entry allowed
   const companionEntryMode: 'automatic' = 'automatic';
   const familyEntryMode: 'automatic' = 'automatic';
   const [members, setMembers] = useState<Member[]>([]);
   const [districts, setDistricts] = useState<MinisteringDistrict[]>([]);
   const [loadingMembers, setLoadingMembers] = useState(false);
   
   const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');

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
      const membersList = snapshot.docs
        .map(doc => {
          const memberData = doc.data();
          return {
            id: doc.id,
            ...memberData,
            status: normalizeMemberStatus(memberData.status),
          } as Member;
        })
        .filter(member => member.status !== 'deceased');
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

  // Load districts
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const snapshot = await getDocs(query(ministeringDistrictsCollection, orderBy('name')));
        const districtsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MinisteringDistrict));
        setDistricts(districtsList);
        
        // Set initial selected district
        if (companionship) {
          const currentDistrict = districtsList.find(d => d.companionshipIds.includes(companionship.id));
          if (currentDistrict) {
            setSelectedDistrictId(currentDistrict.id);
          }
        }
      } catch (error) {
        console.error("Error loading districts:", error);
      }
    };
    loadDistricts();
  }, [companionship]);

  // Handle district assignment
  const handleDistrictChange = async (districtId: string) => {
    if (!companionship) return;
    
    try {
      // Remove from previous district
      for (const district of districts) {
        if (district.companionshipIds.includes(companionship.id)) {
          const newIds = district.companionshipIds.filter(id => id !== companionship.id);
          await updateDoc(doc(ministeringDistrictsCollection, district.id), { 
            companionshipIds: newIds,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Add to new district (if selected)
      if (districtId && districtId !== 'none') {
        const district = districts.find(d => d.id === districtId);
        if (district) {
          const newIds = [...district.companionshipIds, companionship.id];
          await updateDoc(doc(ministeringDistrictsCollection, districtId), { 
            companionshipIds: newIds,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      setSelectedDistrictId(districtId);
      toast({ title: 'Éxito', description: 'Distrito actualizado correctamente' });
    } catch (error) {
      logger.error({ error, message: "Failed to update district" });
      toast({ title: 'Error', description: 'Error al actualizar el distrito', variant: "destructive" });
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(companionshipSchema),
    defaultValues,
  });

  const getCompanionMemberId = (name: string) => {
    if (!name) return '';
    const member = members.find(m => `${m.firstName} ${m.lastName}` === name);
    return member?.id ?? '';
  };

  const getFamilyMemberId = (familyName: string) => {
    if (!familyName) return '';
    const lastName = familyName.replace('Familia ', '').trim();
    const member = members.find(m => m.lastName === lastName);
    return member?.id ?? '';
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
                 return existing || { name, isUrgent: false, observation: '' };
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
            }));

            // Add the new companionship
            const newCompanionshipRef = doc(ministeringCollection);
            await setDoc(newCompanionshipRef, {
                companions: values.companions.map(c => c.value),
                families: familiesWithObjects,
            });

            // Add to selected district (if any)
            if (selectedDistrictId && selectedDistrictId !== 'none') {
                const district = districts.find(d => d.id === selectedDistrictId);
                if (district) {
                    const newIds = [...district.companionshipIds, newCompanionshipRef.id];
                    await updateDoc(doc(ministeringDistrictsCollection, selectedDistrictId), { 
                        companionshipIds: newIds,
                        updatedAt: serverTimestamp()
                    });
                }
            }

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
                <p className="text-sm text-muted-foreground">Selecciona los compañeros de la lista de miembros</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                <span>Automático - Seleccionar miembros existentes</span>
              </div>
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
                          <>
                            <Select
                              value={getCompanionMemberId(field.value)}
                              onValueChange={(value) => {
                                const member = members.find(m => m.id === value);
                                if (member) {
                                  field.onChange(`${member.firstName} ${member.lastName}`);
                                }
                              }}
                              disabled={loadingMembers}
                            >
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
                            <input type="hidden" {...field} />
                          </>
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
                <p className="text-sm text-muted-foreground">Selecciona las familias de la lista de miembros</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                <span>Automático - Seleccionar miembros existentes</span>
              </div>
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
                          <>
                            <Select
                              value={getFamilyMemberId(field.value)}
                              onValueChange={(value) => {
                                const member = members.find(m => m.id === value);
                                if (member) {
                                  field.onChange(`Familia ${member.lastName}`);
                                }
                              }}
                              disabled={loadingMembers}
                            >
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
                            <input type="hidden" {...field} />
                          </>
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

            {/* District Selection */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label className="text-base font-medium">Distrito de Ministración</Label>
                <p className="text-sm text-muted-foreground">Selecciona el distrito al que pertenece este compañerismo</p>
              </div>
              {isEditMode ? (
                <Select
                  value={selectedDistrictId}
                  onValueChange={handleDistrictChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin distrito</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={selectedDistrictId}
                  onValueChange={(value) => setSelectedDistrictId(value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin distrito</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
