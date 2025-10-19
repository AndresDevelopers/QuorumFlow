'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usersCollection } from '@/lib/collections';
import { doc, getDoc, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import {
  assignableRoles,
  canManageSettings,
  normalizeRole,
  type UserRole,
} from '@/lib/roles';
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

  const roleLabels = useMemo<Record<UserRole, string>>(
    () => ({
      user: 'Miembro (Acceso restringido)',
      counselor: 'Consejero (Acceso completo sin ajustes)',
      president: 'Presidente (Acceso completo sin ajustes)',
      secretary: 'Secretario (Control total definido en Ajustes)',
    }),
    []
  );

  // Verificar si el usuario actual tiene rol "secretary"
  useEffect(() => {
    const checkUserRole = async () => {
      if (!firebaseUser) return;

      try {
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = normalizeRole(userData.role);
          setUserRole(role);

          if (canManageSettings(role)) {
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
            role: normalizeRole(data.role),
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
      const normalizedRole = normalizeRole(newRole);
      const userDocRef = doc(usersCollection, userId);
      await updateDoc(userDocRef, {
        role: normalizedRole,
        updatedAt: Timestamp.now(),
      });

      // Actualizar la lista local
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.uid === userId ? { ...user, role: normalizedRole } : user
        )
      );

      toast({
        title: 'Éxito',
        description: 'El rol del usuario ha sido actualizado.',
      });

      logger.info({
        message: 'User role updated',
        userId,
        newRole: normalizedRole,
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
        <CardContent className="text-sm leading-relaxed">
          <p className="text-amber-800 dark:text-amber-200">
            Solo el secretario designado puede administrar los roles desde la página de Ajustes.
            El presidente y los consejeros tienen acceso al resto de la aplicación, pero deben
            coordinar cambios de permisos con el secretario.
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
      <CardContent className="space-y-4">
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
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[640px]">
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
                          handleRoleChange(user.uid, normalizeRole(newRole))
                        }
                        disabled={isSaving === user.uid}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((roleOption) => (
                            <SelectItem key={roleOption} value={roleOption}>
                              {roleLabels[roleOption]}
                            </SelectItem>
                          ))}
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
