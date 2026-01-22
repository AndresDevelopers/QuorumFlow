'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Search, Filter, Edit, Trash2, Users, UserCheck, UserX, Eye, ChevronUp, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useMembersSync } from '@/hooks/use-members-sync';
import { SyncStatus } from '@/components/shared/sync-status';
import type { Member, MemberStatus } from '@/lib/types';
import { OrdinanceLabels } from '@/lib/types';
import { MemberForm } from '@/components/members/member-form';
import { deleteMember } from '@/lib/members-data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safeGetDate, safeFormatDate } from '@/lib/date-utils';

const statusConfig = {
  active: {
    label: 'Activo',
    variant: 'default' as const,
    icon: UserCheck,
    color: 'text-green-600'
  },
  less_active: {
    label: 'Menos Activo',
    variant: 'secondary' as const,
    icon: UserX,
    color: 'text-yellow-600'
  },
  inactive: {
    label: 'Inactivo',
    variant: 'destructive' as const,
    icon: UserX,
    color: 'text-red-600'
  }
};

export default function MembersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { members, loading, syncStatus, lastSyncTime, fetchMembers, clearCache } = useMembersSync({
    enableInitialFetch: true, // Enable initial fetch for members page
    enableRealtimeSync: true, // Enable real-time Firestore listener
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [baptismFilter, setBaptismFilter] = useState<'all' | 'baptized' | 'not_baptized'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);





  // Handle edit param from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId && members.length > 0) {
      const memberToEdit = members.find(m => m.id === editId);
      if (memberToEdit) {
        handleEditMember(memberToEdit);
      }
    }
  }, [members]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDeleteMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete member');
      }

      toast({
        title: 'Éxito',
        description: 'Miembro eliminado correctamente.'
      });

      // Clear cache and refresh immediately
      clearCache();

      // Force refresh to get updated data
      await fetchMembers(true);
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el miembro.',
        variant: 'destructive'
      });
    }
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingMember(null);

    // Clear cache and refresh immediately
    clearCache();

    // Force refresh to get updated data with multiple attempts
    fetchMembers(true);
    
    // Additional refresh after a short delay to ensure data is updated
    setTimeout(() => {
      fetchMembers(true);
    }, 500);
    
    // Final refresh attempt
    setTimeout(() => {
      fetchMembers(true);
    }, 1500);
  };

  const handleViewProfile = (memberId: string) => {
    router.push(`/members/${memberId}`);
  };



  const filteredMembers = members.filter(member => {
    const matchesSearch =
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const isBaptized = member.ordinances?.includes('baptism') ?? false;
    
    // Safely get baptism date
    const baptismDate = safeGetDate(member.baptismDate);
    const hasFutureBaptism = baptismDate && baptismDate > new Date();
    
    const matchesBaptism = baptismFilter === 'all' ||
      (baptismFilter === 'baptized' && isBaptized) ||
      (baptismFilter === 'not_baptized' && !isBaptized && hasFutureBaptism);
    return matchesSearch && matchesStatus && matchesBaptism;
  });

  const memberCounts = {
    active: members.filter(m => m.status === 'active').length,
    less_active: members.filter(m => m.status === 'less_active').length,
    inactive: members.filter(m => m.status === 'inactive').length,
    total: members.length
  };

  return (
    <section className="page-section">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-fluid-title font-semibold tracking-tight">Miembros</h1>
          <p className="text-balance text-fluid-subtitle text-muted-foreground">
            Gestiona los miembros del quórum y su estado de actividad.
          </p>
          {/* Sync Status Indicator */}
          <SyncStatus
            syncStatus={syncStatus}
            lastSyncTime={lastSyncTime}
            className="mt-2"
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            onClick={() => fetchMembers(true)}
            disabled={loading || syncStatus === 'syncing'}
            title="Actualizar lista de miembros"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(loading || syncStatus === 'syncing') ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? 'Sincronizando...' : 'Actualizar'}
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Miembro
              </Button>
            </DialogTrigger>
            <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-4 sm:left-[50%] sm:top-1/2 sm:h-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Editar Miembro' : 'Agregar Nuevo Miembro'}
                </DialogTitle>
                <DialogDescription>
                  {editingMember
                    ? 'Modifica la información del miembro.'
                    : 'Completa la información del nuevo miembro.'}
                </DialogDescription>
              </DialogHeader>
              <MemberForm
                member={editingMember}
                onClose={handleFormClose}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCounts.total}</div>
            <p className="text-xs text-muted-foreground">miembros registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{memberCounts.active}</div>
            <p className="text-xs text-muted-foreground">miembros activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menos Activos</CardTitle>
            <UserX className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{memberCounts.less_active}</div>
            <p className="text-xs text-muted-foreground">necesitan seguimiento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{memberCounts.inactive}</div>
            <p className="text-xs text-muted-foreground">miembros inactivos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Miembros</CardTitle>
          <CardDescription>
            Busca y filtra los miembros por nombre o estado de actividad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: MemberStatus | 'all') => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="less_active">Menos Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={baptismFilter} onValueChange={(value: 'all' | 'baptized' | 'not_baptized') => setBaptismFilter(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por bautismo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="baptized">Bautizados</SelectItem>
                <SelectItem value="not_baptized">No bautizados (futuro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Fecha de Nacimiento</TableHead>
                  <TableHead>Fecha de Bautismo</TableHead>
                  <TableHead>Ordenanzas</TableHead>
                  <TableHead>Ministrantes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      {searchTerm || statusFilter !== 'all'
                        ? 'No se encontraron miembros con los filtros aplicados.'
                        : syncStatus === 'syncing'
                          ? 'Cargando miembros...'
                          : 'No hay miembros registrados. Agrega el primer miembro.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => {
                    console.log('🎨 Rendering member:', {
                      id: member.id,
                      name: `${member.firstName} ${member.lastName}`,
                      status: member.status,
                      statusType: typeof member.status,
                      statusInfo: statusConfig[member.status]
                    });
                    const statusInfo = statusConfig[member.status];
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {member.photoURL ? (
                              <Image
                                src={member.photoURL}
                                alt={`${member.firstName} ${member.lastName}`}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span>{member.firstName} {member.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{member.phoneNumber || 'No especificado'}</TableCell>
                        <TableCell>
                          {safeFormatDate(member.birthDate, 'd MMM yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const isBaptized = member.ordinances?.includes('baptism') ?? false;
                            const baptismDate = safeGetDate(member.baptismDate);
                            if (isBaptized && baptismDate) {
                              return safeFormatDate(member.baptismDate, 'd MMM yyyy', { locale: es });
                            } else if (!isBaptized && baptismDate) {
                              return `Programado: ${safeFormatDate(member.baptismDate, 'd MMM yyyy', { locale: es })}`;
                            } else {
                              return 'No especificada';
                            }
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.ordinances && member.ordinances.length > 0 ? (
                              member.ordinances.map((ordinance) => (
                                <Badge key={ordinance} variant="outline" className="text-xs">
                                  {OrdinanceLabels[ordinance]}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">Ninguna</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.ministeringTeachers && member.ministeringTeachers.length > 0 ? (
                              member.ministeringTeachers.map((teacher, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {teacher}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">Sin asignar</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewProfile(member.id)}
                              title="Ver perfil"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMember(member)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará permanentemente
                                    a {member.firstName} {member.lastName} de la base de datos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMember(member.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 md:hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all'
                    ? 'No se encontraron miembros con los filtros aplicados.'
                    : syncStatus === 'syncing'
                      ? 'Cargando miembros...'
                      : 'No hay miembros registrados. Agrega el primer miembro.'}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                console.log('📱 Rendering mobile member:', {
                  id: member.id,
                  name: `${member.firstName} ${member.lastName}`,
                  status: member.status,
                  statusType: typeof member.status,
                  statusInfo: statusConfig[member.status]
                });
                const statusInfo = statusConfig[member.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <Image
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold">{member.firstName} {member.lastName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {member.phoneNumber || 'Sin teléfono'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {safeGetDate(member.birthDate) && (
                        <p className="text-sm text-muted-foreground mb-3">
                          Nacimiento: {safeFormatDate(member.birthDate, 'd MMM yyyy', { locale: es })}
                        </p>
                      )}

                      {(() => {
                        const isBaptized = member.ordinances?.includes('baptism') ?? false;
                        const baptismDate = safeGetDate(member.baptismDate);
                        if (baptismDate) {
                          return (
                            <p className="text-sm text-muted-foreground mb-3">
                              Bautismo: {isBaptized ? safeFormatDate(member.baptismDate, 'd MMM yyyy', { locale: es }) : `Programado: ${safeFormatDate(member.baptismDate, 'd MMM yyyy', { locale: es })}`}
                            </p>
                          );
                        }
                        return null;
                      })()}

                      {/* Ordenanzas en móvil */}
                      {member.ordinances && member.ordinances.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-2">Ordenanzas:</p>
                          <div className="flex flex-wrap gap-1">
                            {member.ordinances.map((ordinance) => (
                              <Badge key={ordinance} variant="outline" className="text-xs">
                                {OrdinanceLabels[ordinance]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ministrantes en móvil */}
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Ministrantes:</p>
                        <div className="flex flex-wrap gap-1">
                          {member.ministeringTeachers && member.ministeringTeachers.length > 0 ? (
                            member.ministeringTeachers.map((teacher, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {teacher}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin asignar</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                          className="w-full sm:w-auto"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                          className="w-full sm:w-auto"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente
                                a {member.firstName} {member.lastName} de la base de datos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMember(member.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-50"
          size="icon"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}
    </section>
  );
}
