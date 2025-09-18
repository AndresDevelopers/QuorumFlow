
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, User, X, Upload, Loader2 } from 'lucide-react';
import { addDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { futureMembersCollection, storage } from '@/lib/collections';
import logger from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import type { FutureMember } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

const futureMemberSchema = z.object({
  name: z.string().min(2, { message: 'El nombre es requerido.' }),
  baptismDate: z.date({
    required_error: 'La fecha de bautismo es requerida.',
  }),
});

type FormValues = z.infer<typeof futureMemberSchema>;

interface FutureMemberFormProps {
  futureMember?: FutureMember;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function FutureMemberForm({ futureMember }: FutureMemberFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!futureMember;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(futureMemberSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (isEditMode && futureMember) {
      form.reset({
        name: futureMember.name,
        baptismDate: futureMember.baptismDate.toDate(),
      });
      setPreviewUrl(futureMember.photoURL || null);
    } else {
        form.reset({ name: '', baptismDate: undefined });
        setPreviewUrl(null);
    }
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [futureMember, isEditMode, form]);

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
    setPreviewUrl(null);
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
    let finalPhotoURL = futureMember?.photoURL || null;

    try {
      if (selectedFile) {
        const storageRef = ref(storage, `profile_pictures/future_members/${user.uid}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        finalPhotoURL = await getDownloadURL(storageRef);

        if (isEditMode && futureMember?.photoURL && futureMember.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
          const oldImageRef = ref(storage, futureMember.photoURL);
          await deleteObject(oldImageRef).catch(err => logger.warn({err, message: 'Old image could not be deleted.'}));
        }
      } else if (isEditMode && !previewUrl && futureMember?.photoURL) {
        if (futureMember.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
            const oldImageRef = ref(storage, futureMember.photoURL);
            await deleteObject(oldImageRef).catch(err => logger.warn({err, message: 'Image to be removed could not be deleted'}));
        }
        finalPhotoURL = null;
      }

      const dataToSave = {
        name: values.name,
        baptismDate: Timestamp.fromDate(values.baptismDate),
        photoURL: finalPhotoURL,
      };

      if (isEditMode && futureMember) {
        const docRef = doc(futureMembersCollection, futureMember.id);
        await updateDoc(docRef, dataToSave);
        toast({
          title: "Futuro Miembro Actualizado",
          description: "Los datos han sido actualizados exitosamente.",
        });
      } else {
        await addDoc(futureMembersCollection, dataToSave);
        toast({
          title: "Futuro Miembro Agregado",
          description: "La persona ha sido registrada exitosamente.",
        });
      }
      router.push('/future-members');
      router.refresh();
    } catch (e) {
        logger.error({ error: e, message: `Error ${isEditMode ? 'updating' : 'adding'} future member`, data: values });
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>{isEditMode ? 'Editar Futuro Miembro' : 'Agregar Futuro Miembro'}</CardTitle>
            <CardDescription>
              {isEditMode ? 'Actualiza los detalles de la persona.' : 'Ingresa los detalles y la fecha de bautismo programada.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <Input placeholder="Ej: Maria González" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baptismDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Bautismo <span className="text-red-500">*</span></FormLabel>
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
                        disabled={(date) => date < new Date('1900-01-01')}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/future-members">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
