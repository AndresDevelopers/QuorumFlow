'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usersCollection } from '@/lib/collections';
import { doc, getDoc, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2 } from 'lucide-react';

type UserRole = 'user' | 'secretary' | 'admin' | 'leader';

interface UserData {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: Timestamp;
}

export default function RoleManagement() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  // Verificar si el usuario actual tiene rol "secretary"
  useEffect(() => {
    const checkUserRole = async () => {
      if (!firebaseUser) return;

      try {
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role as UserRole;
          setUserRole(role);

          if (role === 'secretary' || role === 'admin') {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        }
      } catch (error) {
        logger.error({ error, message: 'Error checking user role' });
        setHasAccess(false);
      }
    };

    checkUserRole();
  }, [firebaseUser]);

  // Cargar todos los usuarios
  useEffect(() => {
    const fetchUsers = async () => {
      if (!hasAccess) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const querySnapshot = await getDocs(usersCollection);
        const usersList: UserData[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          usersList.push({
            uid: doc.id,
            name: data.name || 'Sin nombre',
            email: data.email || 'Sin email',
            role: (data.role || 'user') as UserRole,
            createdAt: data.createdAt,
          });
        });

        // Ordenar por fecha de creación (más recientes primero)
        usersList.sort((a, b) => {
          const dateA = a.createdAt?.toMillis() ?? 0;
          const dateB = b.createdAt?.toMillis() ?? 0;
          return dateB - dateA;
        });

        setUsers(usersList);
      } catch (error) {
        logger.error({ error, message: 'Error loading users' });
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los usuarios.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [hasAccess, toast]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!firebaseUser) return;

    setIsSaving(userId);

    try {
      const userDocRef = doc(usersCollection, userId);
      await updateDoc(userDocRef, {
        role: newRole,
        updatedAt: Timestamp.now(),
      });

      // Actualizar la lista local
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === userId ? { ...user, role: newRole } : user
        )
      );

      toast({
        title: 'Éxito',
        description: 'El rol del usuario ha sido actualizado.',
      });

      logger.info({
        message: 'User role updated',
        userId,
        newRole,
        changedBy: firebaseUser.uid,
      });
    } catch (error) {
      logger.error({ error, message: 'Error updating user role', userId });
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol del usuario.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(null);
    }
  };

  if (!hasAccess) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-5 w-5" />
            Acceso Restringido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-amber-800 dark:text-amber-200">
            Solo los usuarios con rol de secretario o administrador pueden acceder a la gestión de roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Roles de Usuarios</CardTitle>
        <CardDescription>
          Administra los roles de acceso para todos los usuarios del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-40">Rol</TableHead>
                  <TableHead className="w-20 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) =>
                          handleRoleChange(user.uid, newRole as UserRole)
                        }
                        disabled={isSaving === user.uid}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            Usuario (Acceso restringido)
                          </SelectItem>
                          <SelectItem value="secretary">
                            Secretario (Acceso completo)
                          </SelectItem>
                          <SelectItem value="admin">
                            Administrador (Control total)
                          </SelectItem>
                          <SelectItem value="leader">
                            Líder (Acceso completo)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {isSaving === user.uid && (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
