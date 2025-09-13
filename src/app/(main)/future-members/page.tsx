
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getDocs, query, orderBy, where, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { futureMembersCollection } from '@/lib/collections';
import type { FutureMember } from '@/lib/types';
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
import { format } from 'date-fns';
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


async function getFutureMembers(): Promise<FutureMember[]> {
  const today = Timestamp.fromDate(new Date());

  const q = query(
      futureMembersCollection, 
      where('baptismDate', '>=', today), 
      orderBy('baptismDate', 'asc')
    );

  const snapshot = await getDocs(q);
  
  const futureMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FutureMember));
  
  return futureMembers;
}

export default function FutureMembersPage() {
  const { user, loading: authLoading } = useAuth();
  const [futureMembers, setFutureMembers] = useState<FutureMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFutureMembers();
      setFutureMembers(data);
    } catch (error) {
      console.error("Failed to fetch future members:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    loadData();
  }, [authLoading, user, loadData]);

  const handleDelete = async (futureMemberId: string) => {
    try {
      await deleteDoc(doc(futureMembersCollection, futureMemberId));
      toast({
        title: 'Futuro Miembro Eliminado',
        description: 'El registro ha sido eliminado exitosamente.',
      });
      loadData(); // Refresh the list
    } catch (error) {
      logger.error({ error, message: 'Error deleting future member', futureMemberId });
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el registro.',
        variant: 'destructive',
      });
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Futuros Miembros</CardTitle>
            <CardDescription>
              Lista de personas con fecha de bautismo programada.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/future-members/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Miembro
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
            ) : futureMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No hay bautismos programados.
                </TableCell>
              </TableRow>
            ) : (
              futureMembers.map((item) => (
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
                      <Link href={`/future-members/${item.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de <strong>{item.name}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(item.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
