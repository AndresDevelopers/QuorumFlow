
'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { newConvertFriendsCollection } from '@/lib/collections';
import type { Convert, NewConvertFriendship } from '@/lib/types';
import logger from '@/lib/logger';

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
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2 } from 'lucide-react';
import { MemberSelector } from '@/components/members/member-selector';

const friendshipSchema = z.object({
  friends: z
    .array(
      z.object({
        name: z.string().min(2, 'El nombre es requerido.'),
      })
    )
    .min(1, 'Se requiere al menos un amigo.'),
});

type FormValues = z.infer<typeof friendshipSchema>;

interface FriendshipFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFormSubmit: () => void;
  convert?: Convert | null;
  friendship?: NewConvertFriendship | null;
}

export function FriendshipForm({
  isOpen,
  onOpenChange,
  onFormSubmit,
  convert,
  friendship,
}: FriendshipFormProps) {
  const isEditMode = !!friendship;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(friendshipSchema),
    defaultValues: {
      friends: [{ name: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'friends',
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && friendship) {
        form.reset({ friends: friendship.friends.map((name) => ({ name })) });
      } else {
        form.reset({ friends: [{ name: '' }] });
      }
    }
  }, [isOpen, isEditMode, friendship, form]);


  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const friendNames = values.friends.map((f) => f.name);
        if (isEditMode && friendship) {
          const friendshipRef = doc(newConvertFriendsCollection, friendship.id);
          await updateDoc(friendshipRef, { friends: friendNames });
          toast({
            title: 'Éxito',
            description: 'Asignación de amistad actualizada.',
          });
        } else if (convert) {
          await addDoc(newConvertFriendsCollection, {
            convertId: convert.id,
            convertName: convert.name,
            friends: friendNames,
            assignedAt: serverTimestamp(),
          });
          toast({
            title: 'Éxito',
            description: 'Amigos asignados al nuevo converso.',
          });
        }
        onFormSubmit();
      } catch (error) {
        logger.error({ error, message: 'Error saving friendship' });
        toast({
          title: 'Error',
          description: 'No se pudo guardar la asignación.',
          variant: 'destructive',
        });
      }
    });
  };

  const targetName = isEditMode ? friendship?.convertName : convert?.name;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Editar' : 'Asignar'} Amigos para {targetName}
              </DialogTitle>
              <DialogDescription>
                Agrega o modifica los miembros del quórum que apoyarán a este
                nuevo converso.
                <br />
                <span className="text-sm text-muted-foreground">Los campos marcados con * son obligatorios.</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Amigos del Quórum *</Label>
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`friends.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <MemberSelector
                              value={field.value}
                              onValueChange={(memberId) => field.onChange(memberId)}
                              placeholder={`Seleccionar amigo ${index + 1}`}
                              statusFilter={["active"]}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '' })}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Amigo
              </Button>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Asignación'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
