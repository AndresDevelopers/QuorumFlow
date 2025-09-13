
'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Upload, X } from 'lucide-react';
import { addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

import { baptismsCollection, storage } from '@/lib/collections';
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
import { useAuth } from '@/contexts/auth-context';

const baptismSchema = z.object({
  name: z.string().min(2, { message: 'El nombre es requerido.' }),
  date: z.date({
    required_error: 'La fecha del bautismo es requerida.',
  }),
});

type FormValues = z.infer<typeof baptismSchema>;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export default function AddBaptismPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(baptismSchema),
    defaultValues: {
      name: '',
    },
  });
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let validFiles: File[] = [];
    for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
            toast({
                title: "Archivo demasiado grande",
                description: `La imagen "${file.name}" supera el límite de 20MB.`,
                variant: "destructive",
            });
        } else {
            validFiles.push(file);
        }
    }
    setSelectedFiles(prev => [...prev, ...validFiles]);
    const newUrls = validFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newUrls]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    const urlToRemove = previewUrls[index];
    URL.revokeObjectURL(urlToRemove);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };


  const onSubmit = async (values: FormValues) => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión para guardar.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    let photoUrls: string[] = [];
    try {
        if (selectedFiles.length > 0) {
            const uploadPromises = selectedFiles.map(file => {
                const storageRef = ref(storage, `baptism_photos/manual/${user.uid}/${Date.now()}_${file.name}`);
                return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
            });
            photoUrls = await Promise.all(uploadPromises);
        }

        await addDoc(baptismsCollection, {
            name: values.name,
            date: Timestamp.fromDate(values.date),
            photoUrls,
        });
        toast({
            title: "Bautismo Agregado",
            description: "El bautismo ha sido registrado exitosamente para el reporte anual.",
        });
        router.push('/reports');
    } catch(e) {
        logger.error({ error: e, message: 'Error adding manual baptism', data: values });
        toast({
            title: "Error",
            description: "Hubo un error al agregar el bautismo.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Agregar Bautismo Manualmente</CardTitle>
            <CardDescription>
              Ingresa los detalles de un bautismo realizado en el año actual para incluirlo en el reporte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha del Bautismo <span className="text-red-500">*</span></FormLabel>
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
                        defaultMonth={new Date()}
                        fromDate={new Date(new Date().getFullYear(), 0, 1)}
                        toDate={new Date(new Date().getFullYear(), 11, 31)}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
                <FormLabel>Fotos del Bautismo</FormLabel>
                 <FormControl>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Imágenes
                    </Button>
                 </FormControl>
                <Input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    disabled={isSubmitting}
                />
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {previewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                        <Image src={url} alt={`Preview ${index + 1}`} width={100} height={100} className="w-full h-24 object-cover rounded-md" />
                        <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" disabled={isSubmitting}>
                        <X className="h-3 w-3" />
                        </button>
                    </div>
                    ))}
                </div>
            </FormItem>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/reports">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Bautismo'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
