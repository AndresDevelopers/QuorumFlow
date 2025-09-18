
'use client';

import { useEffect, useState, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getDocs, Timestamp, deleteDoc, doc, query, orderBy, collection, where } from 'firebase/firestore';
import { birthdaysCollection, membersCollection, storage } from '@/lib/collections';
import type { Birthday, Member } from '@/lib/types';
import { deleteObject, ref } from 'firebase/storage';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import logger from '@/lib/logger';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';

async function getBirthdays(): Promise<Birthday[]> {
  try {
    // Obtener cumpleaños de la colección de cumpleaños
    const birthdaysSnapshot = await getDocs(query(birthdaysCollection, orderBy('name')));
    const birthdays = birthdaysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Birthday));

    // Obtener miembros con fecha de nacimiento
    const membersSnapshot = await getDocs(
      query(
        membersCollection,
        where('birthDate', '!=', null),
        orderBy('birthDate', 'asc')
      )
    );

    // Convertir miembros a formato de cumpleaños
    const memberBirthdays: Birthday[] = membersSnapshot.docs
      .filter(doc => {
        const member = doc.data() as Member;
        return member.birthDate && member.firstName && member.lastName;
      })
      .map(doc => {
        const member = doc.data() as Member;
        return {
          id: `member_${doc.id}`,
          name: `${member.firstName} ${member.lastName}`,
          birthDate: member.birthDate as Timestamp,
          photoURL: member.photoURL,
          isMember: true,
          memberId: doc.id
        } as Birthday;
      });

    // Combinar y ordenar por próxima fecha de cumpleaños
    return [...birthdays, ...memberBirthdays];
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    // En caso de error, intentar obtener solo los cumpleaños sin miembros
    try {
      const birthdaysSnapshot = await getDocs(query(birthdaysCollection, orderBy('name')));
      return birthdaysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Birthday));
    } catch (fallbackError) {
      console.error('Error fetching fallback birthdays:', fallbackError);
      return [];
    }
  }
}

function getUpcomingBirthdays(birthdays: Birthday[]): Birthday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return birthdays
    .map(b => {
      const birthDate = b.birthDate.toDate();
      let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }
      return { ...b, nextBirthday };
    })
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());
}

export default function BirthdaysPage() {
  const { user, loading: authLoading } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const { t } = useI18n();

  const fetchBirthdays = useCallback(() => {
    setLoading(true);
    getBirthdays()
      .then(data => {
        setBirthdays(getUpcomingBirthdays(data));
      })
      .catch(error => {
        logger.error({ error, message: 'Failed to fetch birthdays' });
        toast({ title: t('birthdays.error'), description: t('birthdays.loadError'), variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchBirthdays();
  }, [authLoading, user, fetchBirthdays]);
  
  const handleDelete = async (birthday: Birthday) => {
    try {
      // No permitir eliminar cumpleaños de miembros
      if (birthday.isMember) {
        toast({
          title: t('birthdays.cannotDelete'),
          description: t('birthdays.belongsToMember'),
          variant: 'destructive'
        });
        return;
      }

      // Delete photo from storage if it exists
      if (birthday.photoURL) {
        try {
            const photoRef = ref(storage, birthday.photoURL);
            await deleteObject(photoRef);
        } catch (storageError) {
             logger.warn({ error: storageError, message: 'Could not delete photo from storage, it might not exist.'});
        }
      }

      await deleteDoc(doc(birthdaysCollection, birthday.id));
      toast({
        title: t('birthdays.deletedTitle'),
        description: t('birthdays.deletedDescription'),
      });
      fetchBirthdays(); // Refresh the list
    } catch (error) {
      logger.error({ error, message: 'Error deleting birthday', birthdayId: birthday.id });
      toast({
        title: t('birthdays.error'),
        description: t('birthdays.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const upcomingIn14Days = birthdays.filter(b => {
    const today = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14);
    return (b as any).nextBirthday >= today && (b as any).nextBirthday <= twoWeeksFromNow;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('birthdays.upcomingTitle')}</CardTitle>
          <CardDescription>
            {t('birthdays.upcomingDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex space-x-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-16 w-16 rounded-full" />
            </div>
          ) : upcomingIn14Days.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              <TooltipProvider>
                {upcomingIn14Days.map(b => (
                  <Tooltip key={b.id}>
                    <TooltipTrigger>
                       <Avatar className="h-16 w-16">
                            <AvatarImage src={b.photoURL} data-ai-hint="person avatar" />
                            <AvatarFallback>{b.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format((b as any).nextBirthday, `'${t('birthdays.birthsOn')}' d 'de' LLLL`, { locale: es })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              {t('birthdays.noUpcoming')}
            </p>
          )}
        </CardContent>
      </Card>
    
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{t('birthdays.listTitle')}</CardTitle>
              <CardDescription>
                {t('birthdays.listDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('birthdays.name')}</TableHead>
                <TableHead>{t('birthdays.nextBirthday')}</TableHead>
                <TableHead className="text-right">{t('birthdays.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                  </TableRow>
                ))
              ) : birthdays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    {t('birthdays.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                birthdays.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={item.photoURL} data-ai-hint="person avatar" />
                                <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{item.name}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                      {format((item as any).nextBirthday, "d 'de' LLLL", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      {item.isMember ? (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/members?edit=${item.memberId}`} title={t('birthdays.editMember')}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/birthdays/${item.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      )}
                      {(item.isMember === false || item.isMember === undefined) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Eliminar cumpleaños">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('birthdays.deleteDialogTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('birthdays.deleteDialogDescription').replace('{name}', item.name)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('birthdays.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive hover:bg-destructive/90">
                                {t('birthdays.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
