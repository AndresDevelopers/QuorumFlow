
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { addDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';

import { servicesCollection } from '@/lib/collections';
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
import { Textarea } from '@/components/ui/textarea';
import type { Service } from '@/lib/types';

const serviceSchema = z.object({
  title: z.string().min(3, 'El título es requerido.'),
  description: z.string().min(10, 'La descripción es requerida.'),
  date: z.date({
    required_error: 'La fecha es requerida.',
  }),
  time: z.string().optional(),
});

type FormValues = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  service?: Service;
}

export function ServiceForm({ service }: ServiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!service;

  const form = useForm<FormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: isEditMode
      ? {
          title: service.title,
          date: service.date.toDate(),
          description: service.description,
          time: service.time || '',
        }
      : {
          title: '',
          description: '',
          time: '',
        },
  });

  useEffect(() => {
    if (isEditMode && service) {
      form.reset({
        title: service.title,
        date: service.date.toDate(),
        description: service.description,
        time: service.time || '',
      });
    }
  }, [service, isEditMode, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditMode && service) {
        const serviceRef = doc(servicesCollection, service.id);
        await updateDoc(serviceRef, {
          ...values,
          date: Timestamp.fromDate(values.date),
        });
        toast({
          title: 'Servicio Actualizado',
          description: 'El servicio ha sido actualizado exitosamente.',
        });
      } else {
        await addDoc(servicesCollection, {
          title: values.title,
          date: Timestamp.fromDate(values.date),
          description: values.description,
          time: values.time || '',
        });
        toast({
          title: 'Servicio Agregado',
          description: 'El servicio ha sido registrado exitosamente.',
        });
      }
      router.push('/service');
      router.refresh(); 
    } catch (e) {
      logger.error({ error: e, message: 'Error saving service', data: values });
      toast({
        title: "Error",
        description: 'Hubo un error al guardar el servicio.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8"
      >
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>{isEditMode ? 'Editar Servicio' : 'Agregar Nuevo Servicio'}</CardTitle>
            <CardDescription>
              {isEditMode ? 'Modifica los detalles del servicio.' : 'Ingresa los detalles del proyecto de servicio.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Servicio <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Limpieza del parque" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha <span className="text-red-500">*</span></FormLabel>
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
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Describe brevemente en qué consiste el servicio."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href="/service">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Guardar Servicio'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
