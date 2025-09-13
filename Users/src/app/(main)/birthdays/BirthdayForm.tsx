
'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, User, X, Upload, Loader2 } from 'lucide-react';
import { addDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { birthdaysCollection, storage } from '@/lib/collections';
import logger from '@/lib/logger';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Birthday } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

const birthdaySchema = z.object({
  name: z.string().min(2, { message: 'El nombre es requerido.' }),
  birthDate: z.date({
    required_error: 'La fecha de nacimiento es requerida.',
  }),
});

type FormValues = z.infer<typeof birthdaySchema>;

interface BirthdayFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFormSubmit: () => void;
  birthday?: Birthday;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function BirthdayForm({ isOpen, onOpenChange, onFormSubmit, birthday }: BirthdayFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!birthday;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(birthdaySchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && birthday) {
        form.reset({
          name: birthday.name,
          birthDate: birthday.birthDate.toDate(),
        });
        setPreviewUrl(birthday.photoURL || null);
      } else {
        form.reset({ name: '', birthDate: undefined });
        setPreviewUrl(null);
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, birthday, isEditMode, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo de la imagen es de 20MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  
  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl(isEditMode ? null : null); // Keep existing image in edit mode until save
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión para guardar.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    let finalPhotoURL = birthday?.photoURL || null;

    try {
        // Handle image upload if a new file is selected
        if (selectedFile) {
            const storageRef = ref(storage, `profile_pictures/birthdays/${user.uid}/${Date.now()}_${selectedFile.name}`);
            await uploadBytes(storageRef, selectedFile);
            finalPhotoURL = await getDownloadURL(storageRef);

            // If it's edit mode and there was an old photo, delete it
            if (isEditMode && birthday?.photoURL && birthday.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
                 const oldImageRef = ref(storage, birthday.photoURL);
                 await deleteObject(oldImageRef).catch(err => logger.warn({err, message: "Old image could not be deleted"}));
            }
        } else if (isEditMode && !previewUrl && birthday?.photoURL) {
            // Handle image removal
            if (birthday.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
                const oldImageRef = ref(storage, birthday.photoURL);
                await deleteObject(oldImageRef).catch(err => logger.warn({err, message: "Image to be removed could not be deleted"}));
            }
            finalPhotoURL = null;
        }

      const dataToSave = {
        name: values.name,
        birthDate: Timestamp.fromDate(values.birthDate),
        photoURL: finalPhotoURL,
      };

      if (isEditMode && birthday) {
        const docRef = doc(birthdaysCollection, birthday.id);
        await updateDoc(docRef, dataToSave);
        toast({
          title: "Cumpleaños Actualizado",
          description: "Los datos han sido actualizados exitosamente.",
        });
      } else {
        await addDoc(birthdaysCollection, dataToSave);
        toast({
          title: "Cumpleaños Agregado",
          description: "El nuevo cumpleaños ha sido registrado exitosamente.",
        });
      }
      
      onFormSubmit();
      onOpenChange(false);
    } catch (e) {
      logger.error({ error: e, message: `Error ${isEditMode ? 'updating' : 'adding'} birthday`, data: values });
      toast({
        title: "Error",
        description: 'Hubo un error al guardar los datos.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Editar Cumpleaños' : 'Agregar Nuevo Cumpleaños'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Actualiza los detalles de la persona.' : 'Ingresa los detalles para registrar un nuevo cumpleaños.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <FormItem className="flex flex-col items-center">
                <FormLabel>Foto de Perfil</FormLabel>
                <FormControl>
                    <div className="relative">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={previewUrl ?? undefined} alt="Vista previa" data-ai-hint="profile picture" />
                        <AvatarFallback>
                           {isSubmitting ? <Loader2 className="animate-spin" /> : <User className="h-10 w-10 text-muted-foreground" />}
                        </AvatarFallback>
                    </Avatar>
                    {previewUrl && !isSubmitting && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0 right-0 h-6 w-6 rounded-full"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                    )}
                    </div>
                </FormControl>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                    <Upload className="mr-2 h-4 w-4" />
                    {previewUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
                </Button>
                <Input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                />
                <FormMessage />
                </FormItem>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Nacimiento <span className="text-red-500">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'd LLLL yyyy', { locale: es })
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={es}
                          captionLayout="dropdown-buttons"
                          fromYear={1920}
                          toYear={new Date().getFullYear()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
