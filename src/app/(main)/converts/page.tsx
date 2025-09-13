
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { convertsCollection, membersCollection } from '@/lib/collections';
import type { Convert } from '@/lib/types';
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
import { PlusCircle, Trash2, Pencil } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
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
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

async function getConverts(): Promise<Convert[]> {
  const twentyFourMonthsAgo = subMonths(new Date(), 24);
  const twentyFourMonthsAgoTimestamp = Timestamp.fromDate(twentyFourMonthsAgo);

  // Obtener conversos de la colección c_conversos
  const convertsSnapshot = await getDocs(query(convertsCollection, orderBy('baptismDate', 'desc')));
  const convertsFromCollection = convertsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Convert))
    .filter(convert => 
        convert.baptismDate && 
        convert.baptismDate.toDate &&
        convert.baptismDate.toDate() > twentyFourMonthsAgo
    );

  // Obtener miembros bautizados hace 2 años
  const membersSnapshot = await getDocs(query(membersCollection, orderBy('baptismDate', 'desc')));
  const membersAsConverts = membersSnapshot.docs
    .map(doc => {
      const memberData = doc.data();
      if (memberData.baptismDate && memberData.baptismDate.toDate) {
        const baptismDate = memberData.baptismDate.toDate();
        if (baptismDate > twentyFourMonthsAgo) {
          return {
            id: `member_${doc.id}`,
            name: `${memberData.firstName} ${memberData.lastName}`,
            baptismDate: memberData.baptismDate,
            photoURL: memberData.photoURL,
            councilCompleted: memberData.councilCompleted || false,
            councilCompletedAt: memberData.councilCompletedAt || null,
            observation: 'Bautizado como miembro',
            missionaryReference: 'Registro de miembros'
          } as Convert;
        }
      }
      return null;
    })
    .filter(Boolean) as Convert[];

  // Combinar y ordenar por fecha de bautismo (más reciente primero)
  const allConverts = [...convertsFromCollection, ...membersAsConverts]
    .sort((a, b) => b.baptismDate.toDate().getTime() - a.baptismDate.toDate().getTime());

  // Eliminar duplicados basados en nombre y fecha de bautismo
  const uniqueConverts = allConverts.filter((convert, index, self) => 
    index === self.findIndex(c => 
      c.name === convert.name && 
      c.baptismDate.toDate().getTime() === convert.baptismDate.toDate().getTime()
    )
  );

  return uniqueConverts;
}

export default function ConvertsPage() {
  const { user, loading: authLoading } = useAuth();
  const [converts, setConverts] = useState<Convert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getConverts();
      setConverts(data);
    } catch (error) {
      console.error("Failed to fetch converts:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [authLoading, user]);

  const handleDelete = async (convertId: string) => {
    try {
      await deleteDoc(doc(convertsCollection, convertId));
      toast({
        title: 'Converso Eliminado',
        description: 'El registro ha sido eliminado exitosamente.',
      });
      loadData(); // Refresh the list
    } catch (error) {
      logger.error({ error, message: 'Error deleting convert', convertId });
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el converso.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Conversos Recientes</CardTitle>
            <CardDescription>
              Lista de miembros bautizados en los últimos 24 meses, incluyendo conversos registrados y miembros bautizados.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/converts/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Converso
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha de Bautismo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : converts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No hay conversos ni miembros bautizados en los últimos 24 meses.
                </TableCell>
              </TableRow>
            ) : (
              converts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={item.photoURL} data-ai-hint="profile picture" />
                            <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(item.baptismDate.toDate(), 'd LLLL yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" asChild>
                      <Link href={`/converts/${item.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
