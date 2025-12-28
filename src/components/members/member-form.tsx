'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Member, MemberStatus, Ordinance } from '@/lib/types';
import { OrdinanceLabels } from '@/lib/types';
import { createMember, updateMember, uploadMemberPhoto, uploadBaptismPhotos, getMembersForSelector, searchMembersByName } from '@/lib/members-data';
import { syncMinisteringAssignments, getPreviousMinisteringTeachers } from '@/lib/ministering-sync';
import { Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { safeGetDate } from '@/lib/date-utils';

const memberFormSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.date().optional(),
  baptismDate: z.date().optional(),
  status: z.enum(['active', 'less_active', 'inactive'] as const),
  photoURL: z.string().optional(),
  baptismPhotos: z.array(z.string()).optional(),
  ordinances: z.array(z.enum(['baptism', 'confirmation', 'elder_ordination', 'endowment', 'sealed_spouse', 'high_priest_ordination'] as const)).optional(),
  ministeringTeachers: z.array(z.string()).optional(),
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

interface MemberFormProps {
  member?: Member | null;
  onClose: () => void;
}

export function MemberForm({ member, onClose }: MemberFormProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [baptismPhotoFiles, setBaptismPhotoFiles] = useState<File[]>([]);
  const [baptismPhotoPreviews, setBaptismPhotoPreviews] = useState<string[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Estados para el diálogo de duplicados
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateMembers, setDuplicateMembers] = useState<Member[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [allowContinueWithDuplicate, setAllowContinueWithDuplicate] = useState(false);
  const [duplicateDecisionMade, setDuplicateDecisionMade] = useState(false);
  
  // Estados locales para los inputs de fecha
  const [birthDateInput, setBirthDateInput] = useState('');
  const [baptismDateInput, setBaptismDateInput] = useState('');

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      status: 'active',
      photoURL: undefined,
      baptismDate: undefined,
      ordinances: [],
      ministeringTeachers: [],
    },
  });

  // Cargar datos del miembro al formulario
  useEffect(() => {
    console.log('🔄 Loading member data in form:', {
      member,
      hasMember: !!member,
      memberId: member?.id
    });

    // Reset loading state when member changes
    setLoading(false);

    // Reset duplicate states when loading a member
    setDuplicateMembers([]);
    setShowDuplicateDialog(false);
    setAllowContinueWithDuplicate(false);
    setDuplicateDecisionMade(false);

    if (member) {
      // Convertir Timestamps a Date y preparar valores para el formulario
      const birthDateValue = safeGetDate((member as any).birthDate) ?? undefined;
      const baptismDateValue = safeGetDate((member as any).baptismDate) ?? undefined;
      
      const valuesToSet = {
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        phoneNumber: member.phoneNumber || '',
        birthDate: birthDateValue,
        baptismDate: baptismDateValue,
        status: member.status || 'active',
        photoURL: (member.photoURL && member.photoURL.trim()) || undefined,
        baptismPhotos: member.baptismPhotos || [],
        ordinances: member.ordinances || [],
        ministeringTeachers: member.ministeringTeachers || []
      };

      console.log('📝 Setting form values:', valuesToSet);
      console.log('📷 Photo URL:', member.photoURL);
      console.log('📅 Birth date:', { raw: member.birthDate, converted: birthDateValue });
      console.log('🎂 Baptism date:', { raw: member.baptismDate, converted: baptismDateValue });
      console.log('🎯 Status value:', { raw: member.status, final: valuesToSet.status });

      // Reset form with new values and trigger validation
      form.reset(valuesToSet);

      // Set photo preview - treat empty strings as no photo
      const photoUrl = member.photoURL && member.photoURL.trim() ? member.photoURL : null;
      setPhotoPreview(photoUrl);
      setPhotoFile(null); // Clear any selected file when loading existing member
      
      // Set baptism photos
      setBaptismPhotoPreviews(member.baptismPhotos || []);
      setBaptismPhotoFiles([]); // Clear any selected files when loading existing member
      
      // Actualizar los estados locales de los inputs de fecha
      setBirthDateInput(formatDateForDisplay(birthDateValue));
      setBaptismDateInput(formatDateForDisplay(baptismDateValue));
      
      console.log('✅ Member data loaded successfully');
    } else {
      console.log('🆕 Resetting form for new member');

      // Reset to empty form for new member
      form.reset({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        status: 'active',
        photoURL: undefined,
        birthDate: undefined,
        baptismDate: undefined,
        baptismPhotos: [],
        ordinances: [],
        ministeringTeachers: [],
      });
      setPhotoPreview(null);
      setPhotoFile(null);
      setBaptismPhotoPreviews([]);
      setBaptismPhotoFiles([]);

      // Limpiar los inputs de fecha
      setBirthDateInput('');
      setBaptismDateInput('');

      // Reset duplicate states for new member
      setDuplicateMembers([]);
      setShowDuplicateDialog(false);
      setAllowContinueWithDuplicate(false);
      setDuplicateDecisionMade(false);
    }
  }, [member, form]);

  // Cargar miembros disponibles para ministrantes
  const loadAvailableMembers = useCallback(async () => {
    if (!user) {
      console.log('👤 No user available for loading members');
      return;
    }
    
    setLoadingMembers(true);
    try {
      console.log('📎 Loading available members for ministering assignment...');
      // Obtener todos los miembros (incluyendo inactivos) para maestros ministrantes
      const members = await getMembersForSelector(true);
      console.log(`📊 Found ${members.length} available members`);
      
      // Filtrar el miembro actual si estamos editando
      const filteredMembers = member 
        ? members.filter(m => m.id !== member.id)
        : members;
      
      console.log(`🎣 After filtering: ${filteredMembers.length} members available`);
      setAvailableMembers(filteredMembers);
    } catch (error) {
      console.error('❌ Error loading members for ministering:', error);
      setAvailableMembers([]); // Set empty array as fallback
      // Don't show toast for this error to avoid interrupting user flow
      console.warn('Members for ministering will not be available due to loading error');
    } finally {
      setLoadingMembers(false);
    }
  }, [member, user]);

  // Cargar miembros disponibles cuando el componente se monta
  useEffect(() => {
    if (user && !authLoading) {
      // Usar setTimeout para evitar bloquear el renderizado inicial
      const timer = setTimeout(() => {
        loadAvailableMembers();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, loadAvailableMembers, user]);

  // Función para verificar duplicados
  const checkForDuplicates = useCallback(async (firstName: string, lastName: string) => {
    // Solo verificar para nuevos miembros
    if (member) return;

    if (!firstName?.trim() || !lastName?.trim()) {
      setDuplicateMembers([]);
      setShowDuplicateDialog(false);
      setAllowContinueWithDuplicate(false);
      setDuplicateDecisionMade(false);
      return;
    }

    setCheckingDuplicate(true);
    try {
      const duplicates = await searchMembersByName(firstName, lastName);
      setDuplicateMembers(duplicates);
      if (duplicates.length > 0) {
        setShowDuplicateDialog(true);
        setAllowContinueWithDuplicate(false);
        setDuplicateDecisionMade(false);
      } else {
        setShowDuplicateDialog(false);
        setAllowContinueWithDuplicate(false);
        setDuplicateDecisionMade(false);
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      setDuplicateMembers([]);
      setShowDuplicateDialog(false);
      setAllowContinueWithDuplicate(false);
      setDuplicateDecisionMade(false);
    } finally {
      setCheckingDuplicate(false);
    }
  }, [member]);

  const watchedFirstName = useWatch({ control: form.control, name: 'firstName' });
  const watchedLastName = useWatch({ control: form.control, name: 'lastName' });

  // Efecto para verificar duplicados automáticamente al escribir
  useEffect(() => {
    const firstName = watchedFirstName;
    const lastName = watchedLastName;

    if (!firstName?.trim() || !lastName?.trim()) {
      setDuplicateMembers([]);
      setShowDuplicateDialog(false);
      setAllowContinueWithDuplicate(false);
      setDuplicateDecisionMade(false);
      return;
    }

    // Verificar inmediatamente si ambos campos tienen al menos 2 caracteres
    if (firstName.trim().length >= 2 && lastName.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        checkForDuplicates(firstName, lastName);
      }, 150); // Reducir debounce a 150ms para ser más responsivo

      return () => clearTimeout(timeoutId);
    } else {
      // Limpiar duplicados si no hay suficientes caracteres
      setDuplicateMembers([]);
      setShowDuplicateDialog(false);
      setAllowContinueWithDuplicate(false);
      setDuplicateDecisionMade(false);
    }
  }, [checkForDuplicates, watchedFirstName, watchedLastName]);

  // Función para parsear fecha desde string DD/MM/YYYY
  const parseDate = (dateString: string, maxYear: number): Date | undefined => {
    if (!dateString.trim()) return undefined;

    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) return undefined;

    const [, dayStr, monthStr, yearStr] = match;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
    const year = parseInt(yearStr, 10);

    // Validate ranges
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > maxYear) {
      return undefined;
    }

    const date = new Date(year, month, day);
    
    // Check if date is valid (handles invalid dates like Feb 30)
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
      return undefined;
    }

    return date;
  };

  // Función para formatear fecha para mostrar
  const formatDateForDisplay = (date: Date | undefined): string => {
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    try {
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return '';
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Por favor selecciona un archivo de imagen válido.',
          variant: 'destructive'
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'La imagen debe ser menor a 5MB.',
          variant: 'destructive'
        });
        return;
      }

      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    // Clear the photoURL field in the form to ensure proper update
    form.setValue('photoURL', undefined);
  };

  const baptismPhotosInputRef = useRef<HTMLInputElement>(null);

  const handleBaptismPhotosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      // Validar que sean imágenes
      const validFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (validFiles.length !== files.length) {
        toast({
          title: 'Formato inválido',
          description: 'Por favor selecciona solo archivos de imagen.',
          variant: 'destructive'
        });
        return;
      }

      // Limitar a 10 fotos máximo
      const totalFiles = [...baptismPhotoFiles, ...validFiles];
      if (totalFiles.length > 10) {
        toast({
          title: 'Límite excedido',
          description: 'Puedes subir máximo 10 fotos de bautismo.',
          variant: 'destructive'
        });
        return;
      }

      setBaptismPhotoFiles(prev => [...prev, ...validFiles]);

      // Crear previews
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          setBaptismPhotoPreviews(prev => [...prev, preview]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeBaptismPhoto = (index: number) => {
    setBaptismPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setBaptismPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: MemberFormValues) => {
    console.log('🚀 Starting member submission:', {
      isEditing: !!member,
      memberId: member?.id,
      values,
      user: user?.uid
    });

    if (!user) {
      console.error('❌ No user authenticated');
      return;
    }

    // Verificar si hay duplicados sin resolver
    if (duplicateMembers.length > 0 && !allowContinueWithDuplicate) {
      setShowDuplicateDialog(true);
      return;
    }

    setLoading(true);
    try {
      // Handle photo URL
      let photoURL = member?.photoURL; // Start with existing photo
      if (photoFile) {
        // Upload new photo
        photoURL = await uploadMemberPhoto(photoFile, user.uid);
      } else if (photoPreview === null && member?.photoURL) {
        // Photo was removed - delete from storage
        try {
          if (member.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, member.photoURL);
            await deleteObject(photoRef);
            console.log('✅ Old member photo deleted from storage');
          }
        } catch (error) {
          console.warn('⚠️ Could not delete old member photo from storage:', error);
          // Continue with the update even if deletion fails
        }
        photoURL = null as any;
      }
      // else keep existing photoURL

      // Subir fotos de bautismo
      let baptismPhotoURLs: string[] = [];
      if (baptismPhotoFiles.length > 0) {
        try {
          const uploadedPhotos = await uploadBaptismPhotos(baptismPhotoFiles, user.uid);
          baptismPhotoURLs = uploadedPhotos;
          
          // Mantener las fotos existentes que no fueron eliminadas
          if (member?.baptismPhotos) {
            const existingPhotos = member.baptismPhotos.filter(url => 
              baptismPhotoPreviews.includes(url)
            );
            baptismPhotoURLs = [...existingPhotos, ...uploadedPhotos];
          }
        } catch (error) {
          console.error('Error uploading baptism photos:', error);
          toast({
            title: 'Advertencia',
            description: 'No se pudieron subir algunas fotos de bautismo.',
            variant: 'destructive'
          });
          // Mantener las fotos existentes en caso de error
          baptismPhotoURLs = member?.baptismPhotos || [];
        }
      } else {
        // Si no hay nuevas fotos, mantener las existentes
        baptismPhotoURLs = member?.baptismPhotos || [];
      }

      // Eliminar fotos de bautismo que fueron removidas
      if (member?.baptismPhotos) {
        const photosToDelete = member.baptismPhotos.filter(url => 
          !baptismPhotoPreviews.includes(url)
        );
        
        for (const photoUrl of photosToDelete) {
          try {
            if (photoUrl.startsWith('https://firebasestorage.googleapis.com')) {
              const photoRef = ref(storage, photoUrl);
              await deleteObject(photoRef);
            }
          } catch (error) {
            console.warn('Could not delete baptism photo:', error);
          }
        }
      }

      // Verificar si es un bautismo de los últimos 2 años
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const isRecentBaptism = values.baptismDate &&
        values.baptismDate >= twoYearsAgo;
      
      // Verificar si hay cambios en la fecha de bautismo
      const previousBaptismDate = member?.baptismDate?.toDate ? member.baptismDate.toDate() :
                                  member?.baptismDate instanceof Date ? member.baptismDate : null;
      const previousBaptismYear = previousBaptismDate?.getFullYear();
      const newBaptismYear = values.baptismDate?.getFullYear();
      const baptismYearChanged = previousBaptismYear !== newBaptismYear;
      const baptismDateRemoved = member?.baptismDate && !values.baptismDate;

      // Preparar datos del miembro para actualizar (datos serializables)
      console.log('💾 Preparing member data for update:', {
        status: values.status,
        statusType: typeof values.status,
        allValues: values
      });
      const memberData = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        status: values.status,
        // Manejar campos opcionales: usar el valor del formulario si está presente, sino undefined para limpiar
        phoneNumber: values.phoneNumber?.trim() ? values.phoneNumber.trim() : undefined,
        birthDate: values.birthDate ? values.birthDate.toISOString() : undefined,
        baptismDate: values.baptismDate ? values.baptismDate.toISOString() : undefined,
        photoURL: photoURL as any,
        baptismPhotos: baptismPhotoURLs,
        ordinances: values.ordinances || [],
        ministeringTeachers: values.ministeringTeachers || [],
      };

      console.log('📤 Final member data to send:', memberData);
      console.log('📅 Date conversions:', {
        birthDate: {
          original: values.birthDate,
          isoString: values.birthDate ? values.birthDate.toISOString() : undefined
        },
        baptismDate: {
          original: values.baptismDate,
          isoString: values.baptismDate ? values.baptismDate.toISOString() : undefined
        }
      });

      // Si es un bautismo reciente, crear registro en conversos y bautismos
      let convertDocRef = null;
      let updateDocDynamic = null;

      if (isRecentBaptism && values.baptismDate) {
        const convertData = {
          name: `${values.firstName.trim()} ${values.lastName.trim()}`,
          baptismDate: Timestamp.fromDate(values.baptismDate),
          photoURL: photoURL || undefined,
          councilCompleted: false,
          observation: 'Registrado automáticamente desde Miembros',
          createdAt: Timestamp.now(),
          createdBy: user.uid,
          memberId: member?.id || '', // Se actualizará después para nuevos miembros
        };

        const baptismData = {
          name: `${values.firstName.trim()} ${values.lastName.trim()}`,
          date: Timestamp.fromDate(values.baptismDate),
          source: 'Automático',
          photoURL: photoURL || undefined,
          baptismPhotos: baptismPhotoURLs,
          createdAt: Timestamp.now(),
        };

        // Importar dinámicamente para evitar dependencias circulares
        const { addDoc, collection, query, where, getDocs, deleteDoc, doc, updateDoc: updateDocImported } = await import('firebase/firestore');
        const { firestore } = await import('@/lib/firebase');

        updateDocDynamic = updateDocImported;

        // Si es una actualización y la fecha de bautismo cambió, eliminar el registro anterior
        if (member && (baptismYearChanged || baptismDateRemoved)) {
          const baptismQuery = query(
             collection(firestore, 'c_bautismos'),
             where('name', '==', `${values.firstName.trim()} ${values.lastName.trim()}`),
             where('source', '==', 'Automático')
           );
          const existingBaptisms = await getDocs(baptismQuery);
          existingBaptisms.forEach(async (baptismDoc) => {
            await deleteDoc(doc(firestore, 'c_bautismos', baptismDoc.id));
          });
        }

        // Crear nuevo registro si hay fecha de bautismo en los últimos 2 años
        convertDocRef = await addDoc(collection(firestore, 'converts'), convertData);
        await addDoc(collection(firestore, 'c_bautismos'), baptismData);
      }

      if (member) {
        // Get previous ministering teachers before update
        const previousTeachers = member.ministeringTeachers || [];
        
        // Update existing member via API
        const response = await fetch(`/api/members/${member.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(memberData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('API Error response:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          });
          throw new Error(`Failed to update member: ${errorData.details || errorData.error || response.statusText}`);
        }

        // Sync ministering assignments if teachers changed
        const currentTeachers = values.ministeringTeachers || [];
        if (JSON.stringify(previousTeachers.sort()) !== JSON.stringify(currentTeachers.sort())) {
          try {
            await syncMinisteringAssignments(
              { ...member, ...memberData, id: member.id } as any,
              previousTeachers
            );
            console.log('✅ Ministering assignments synced');
          } catch (error) {
            console.error('⚠️ Error syncing ministering assignments:', error);
            // Don't fail the whole operation if sync fails
          }
        }

        toast({
          title: '✅ Miembro Actualizado',
          description: `${values.firstName} ${values.lastName} ha sido actualizado correctamente.`
        });
        console.log('✅ Member updated successfully:', { memberId: member.id, updatedData: memberData });
      } else {
        // Create new member via API
        const newMember = {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          status: values.status,
          phoneNumber: values.phoneNumber?.trim() || undefined,
          birthDate: values.birthDate ? values.birthDate.toISOString() : undefined,
          baptismDate: values.baptismDate ? values.baptismDate.toISOString() : undefined,
          photoURL: photoURL as any,
          baptismPhotos: baptismPhotoURLs,
          ordinances: values.ordinances || [],
          ministeringTeachers: values.ministeringTeachers || [],
        };

        const response = await fetch('/api/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newMember),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('API Error response:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          });
          throw new Error(`Failed to create member: ${errorData.details || errorData.error || response.statusText}`);
        }

        const { id: newMemberId } = await response.json();

        // Actualizar el registro de converso con el memberId si existe
        if (convertDocRef && updateDocDynamic) {
          await updateDocDynamic(convertDocRef, { memberId: newMemberId });
        }

        // Sync ministering assignments for new member if teachers assigned
        const currentTeachers = values.ministeringTeachers || [];
        if (currentTeachers.length > 0) {
          try {
            await syncMinisteringAssignments(
              { ...newMember, id: newMemberId } as any,
              []
            );
            console.log('✅ Ministering assignments synced for new member');
          } catch (error) {
            console.error('⚠️ Error syncing ministering assignments:', error);
            // Don't fail the whole operation if sync fails
          }
        }

        toast({
          title: '✅ Miembro Creado',
          description: `${values.firstName} ${values.lastName} ha sido agregado como nuevo miembro.`
        });
        console.log('✅ New member created successfully:', { memberId: newMemberId, memberData: newMember });
      }

      onClose();
    } catch (error) {
      console.error('Error saving member:', error);
      
      let errorMessage = member 
        ? 'No se pudo actualizar el miembro.' 
        : 'No se pudo crear el miembro.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Diálogo de duplicados */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={(open) => {
        if (!open && !duplicateDecisionMade) {
          // Si el usuario cierra el diálogo sin tomar una decisión, se considera como cancelar
          setShowDuplicateDialog(false);
          setAllowContinueWithDuplicate(false);
          setDuplicateDecisionMade(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Miembro Guardado Anteriormente</AlertDialogTitle>
            <AlertDialogDescription>
              Ya existe un miembro con el nombre{" "}
              &quot;{form.getValues('firstName')} {form.getValues('lastName')}&quot;.
              {duplicateMembers.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">Miembros encontrados:</div>
                  <div className="space-y-2">
                    {duplicateMembers.map((dupMember) => (
                      <div key={dupMember.id} className="flex items-center gap-3 p-2 bg-muted rounded-md">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={dupMember.photoURL} />
                          <AvatarFallback className="text-xs">
                            {dupMember.firstName.charAt(0)}{dupMember.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{dupMember.firstName} {dupMember.lastName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            Estado: {dupMember.status === 'active' ? 'Activo' :
                                   dupMember.status === 'less_active' ? 'Menos Activo' : 'Inactivo'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  ¿Qué deseas hacer?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDuplicateDialog(false);
              setAllowContinueWithDuplicate(false);
              setDuplicateDecisionMade(true);
              onClose(); // Cerrar el formulario
            }}>
              Cancelar y Salir
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDuplicateDialog(false);
              setAllowContinueWithDuplicate(true);
              setDuplicateDecisionMade(true);
            }}>
              Continuar Llenando
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Form key={member?.id || 'new'} {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Photo Upload */}
        <div className="space-y-4">
          <Label>Foto de Perfil (Opcional)</Label>
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={photoPreview || undefined} />
              <AvatarFallback className="text-lg">
                {form.watch('firstName')?.[0]?.toUpperCase()}
                {form.watch('lastName')?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Foto
                    </span>
                  </Button>
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {photoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removePhoto}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Quitar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos: JPG, PNG, GIF. Máximo 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nombre"
                    {...field}
                    onBlur={(e) => {
                      field.onBlur();
                      const firstName = e.target.value.trim();
                      const lastName = form.getValues('lastName')?.trim() || '';
                      checkForDuplicates(firstName, lastName);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Apellido"
                    {...field}
                    onBlur={(e) => {
                      field.onBlur();
                      const lastName = e.target.value.trim();
                      const firstName = form.getValues('firstName')?.trim() || '';
                      checkForDuplicates(firstName, lastName);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Phone Number */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Teléfono</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej: +1 234 567 8900" 
                  type="tel"
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Opcional. Incluye el código de país si es necesario.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Birth Date */}
        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de Nacimiento</FormLabel>
              <FormControl>
                <Input
                  placeholder="DD/MM/YYYY"
                  value={birthDateInput}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    setBirthDateInput(inputValue);
                    
                    // Only update the form field if we have a valid date
                    const parsedDate = parseDate(inputValue, new Date().getFullYear());
                    if (parsedDate || !inputValue.trim()) {
                      field.onChange(parsedDate);
                    }
                  }}
                  onBlur={(e) => {
                    const inputValue = e.target.value;
                    const parsedDate = parseDate(inputValue, new Date().getFullYear());
                    
                    if (parsedDate) {
                      // Valid date: format it properly
                      const formattedDate = formatDateForDisplay(parsedDate);
                      setBirthDateInput(formattedDate);
                      field.onChange(parsedDate);
                    } else if (!inputValue.trim()) {
                      // Empty input: clear everything
                      setBirthDateInput('');
                      field.onChange(undefined);
                    } else {
                      // Invalid date: keep the input but clear the form field
                      field.onChange(undefined);
                    }
                    
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>
                Ingresa la fecha en formato DD/MM/YYYY (ejemplo: 15/03/1990)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Baptism Date */}
        <FormField
          control={form.control}
          name="baptismDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de Bautismo</FormLabel>
              <FormControl>
                <Input
                  placeholder="DD/MM/YYYY"
                  value={baptismDateInput}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    setBaptismDateInput(inputValue);
                    
                    // Only update the form field if we have a valid date
                    const parsedDate = parseDate(inputValue, new Date().getFullYear() + 10);
                    if (parsedDate || !inputValue.trim()) {
                      field.onChange(parsedDate);
                    }
                  }}
                  onBlur={(e) => {
                    const inputValue = e.target.value;
                    const parsedDate = parseDate(inputValue, new Date().getFullYear() + 10);
                    
                    if (parsedDate) {
                      // Valid date: format it properly
                      const formattedDate = formatDateForDisplay(parsedDate);
                      setBaptismDateInput(formattedDate);
                      field.onChange(parsedDate);
                    } else if (!inputValue.trim()) {
                      // Empty input: clear everything
                      setBaptismDateInput('');
                      field.onChange(undefined);
                    } else {
                      // Invalid date: keep the input but clear the form field
                      field.onChange(undefined);
                    }
                    
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>
                Ingresa la fecha en formato DD/MM/YYYY (ejemplo: 15/03/2023)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Baptism Photos */}
        <div className="space-y-4">
          <Label>Fotos de Bautismo (Opcional)</Label>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Label htmlFor="baptism-photos-upload" className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Agregar Fotos
                  </span>
                </Button>
              </Label>
              <Input
                id="baptism-photos-upload"
                ref={baptismPhotosInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleBaptismPhotosChange}
                className="hidden"
              />
            </div>
            
            {baptismPhotoPreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {baptismPhotoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <div className="relative w-full h-24 rounded-md border overflow-hidden">
                      <Image
                        src={preview}
                        alt={`Foto de bautismo ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBaptismPhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar foto de bautismo"
                      aria-label={`Eliminar foto de bautismo ${index + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Puedes subir hasta 10 fotos. Formatos: JPG, PNG, GIF. Máximo 5MB por foto.
            </p>
          </div>
        </div>

        {/* Ordenanzas */}
        <FormField
          control={form.control}
          name="ordinances"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ordenanzas Recibidas</FormLabel>
              <FormDescription>
                Selecciona las ordenanzas que ha recibido el miembro.
              </FormDescription>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {(Object.entries(OrdinanceLabels) as [Ordinance, string][]).map(([ordinance, label]) => (
                  <div key={ordinance} className="flex items-center space-x-2">
                    <Checkbox
                      checked={field.value?.includes(ordinance) || false}
                      onCheckedChange={(checked) => {
                        const currentOrdinances = field.value || [];
                        if (checked) {
                          field.onChange([...currentOrdinances, ordinance]);
                        } else {
                          field.onChange(currentOrdinances.filter(o => o !== ordinance));
                        }
                      }}
                    />
                    <Label className="text-sm font-normal cursor-pointer" htmlFor={ordinance}>
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Maestros Ministrantes */}
        <FormField
          control={form.control}
          name="ministeringTeachers"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maestros Ministrantes</FormLabel>
              <FormDescription>
                Selecciona los miembros que ministran a esta persona/familia.
              </FormDescription>
              <div className="max-h-48 overflow-y-auto border rounded-md p-3">
                {loadingMembers ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Cargando miembros disponibles...
                  </div>
                ) : availableMembers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No hay miembros disponibles para asignar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableMembers.map((availableMember) => {
                      const memberName = `${availableMember.firstName} ${availableMember.lastName}`;
                      const isSelected = field.value?.includes(memberName) || false;
                      
                      return (
                        <div key={availableMember.id} className="flex items-center space-x-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const currentTeachers = field.value || [];
                              if (checked) {
                                field.onChange([...currentTeachers, memberName]);
                              } else {
                                field.onChange(currentTeachers.filter(name => name !== memberName));
                              }
                            }}
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={availableMember.photoURL} />
                              <AvatarFallback className="text-xs">
                                {availableMember.firstName.charAt(0)}{availableMember.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Label className="text-sm font-normal cursor-pointer">
                                {memberName}
                              </Label>
                              {availableMember.status && (
                                <p className="text-xs text-muted-foreground capitalize">
                                  {availableMember.status === 'active' ? 'Activo' : 
                                   availableMember.status === 'less_active' ? 'Menos Activo' : 'Inactivo'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {field.value && field.value.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {field.value.length} ministrante(s) seleccionado(s)
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado de Actividad *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="less_active">Menos Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                El estado determina cómo aparece el miembro en los reportes y seguimientos.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-current" />
                {member ? 'Actualizando...' : 'Creando...'}
              </>
            ) : (
              `${member ? 'Actualizar' : 'Crear'} Miembro`
            )}
          </Button>
        </div>
      </form>
    </Form>
    </>
  );
}
