'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Users, AlertTriangle, UserX, UserCheck, Eye, ChevronUp } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Member, Companionship, Family } from '@/lib/types';
import { OrdinanceLabels } from '@/lib/types';
import { getMembersByStatus } from '@/lib/members-data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { getDocs, query, orderBy } from 'firebase/firestore';
import { ministeringCollection } from '@/lib/collections';

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

export default function ObservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [companionships, setCompanionships] = useState<Companionship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const withoutEndowmentRef = useRef<HTMLDivElement>(null);
  const withoutElderOrdinationRef = useRef<HTMLDivElement>(null);
  const withoutHigherPriesthoodRef = useRef<HTMLDivElement>(null);
  const withoutMinisteringRef = useRef<HTMLDivElement>(null);
  const inactiveRef = useRef<HTMLDivElement>(null);
  const familyFocusCompanionshipsRef = useRef<HTMLDivElement>(null);
  const problematicCompanionshipsRef = useRef<HTMLDivElement>(null);

  const fetchMembers = async () => {
    if (authLoading || !user) return;

    setLoading(true);
    try {
      const allMembers = await getMembersByStatus();
      setMembers(allMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los miembros.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanionships = async () => {
    try {
      const q = query(ministeringCollection, orderBy('companions'));
      const snapshot = await getDocs(q);
      const comps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Companionship));
      setCompanionships(comps);
    } catch (error) {
      console.error('Error fetching companionships:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las compaÃ±erÃ­as.',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchCompanionships();
  }, [authLoading, user]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleViewProfile = (memberId: string) => {
    router.push(`/members/${memberId}`);
  };

  // Filtrar miembros por criterios
  const membersWithoutEndowment = members.filter(member =>
    !member.ordinances || !member.ordinances.includes('endowment')
  );

  const membersWithoutElderOrdination = members.filter(member =>
    !member.ordinances || !member.ordinances.includes('elder_ordination')
  );

  const membersWithoutHigherPriesthood = members.filter(member =>
    !member.ordinances || (!member.ordinances.includes('elder_ordination') && !member.ordinances.includes('high_priest_ordination'))
  );

  const membersWithoutMinistering = members.filter(member =>
    !member.ministeringTeachers || member.ministeringTeachers.length === 0
  );

  const inactiveMembers = members.filter(member => member.status === 'inactive');

  // Filter companionships where companions are less active or inactive
  const problematicCompanionships = companionships.filter(companionship => {
    return companionship.companions.some(companionName => {
      const member = members.find(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase() === companionName.toLowerCase()
      );
      return member && (member.status === 'less_active' || member.status === 'inactive');
    });
  });

  const membersByFullName = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach(member => {
      map.set(`${member.firstName} ${member.lastName}`.toLowerCase(), member);
    });
    return map;
  }, [members]);

  const membersByLastName = useMemo(() => {
    const map = new Map<string, Member[]>();
    members.forEach(member => {
      const key = member.lastName.toLowerCase();
      const existing = map.get(key) ?? [];
      existing.push(member);
      map.set(key, existing);
    });
    return map;
  }, [members]);

  const resolveFamilyMembers = useCallback((familyName: string): Member[] => {
    const normalized = familyName.trim().toLowerCase();
    if (normalized.startsWith('familia ')) {
      const lastName = normalized.replace('familia ', '').trim();
      return membersByLastName.get(lastName) ?? [];
    }

    const directMatch = membersByFullName.get(normalized);
    if (directMatch) {
      return [directMatch];
    }

    return membersByLastName.get(normalized) ?? [];
  }, [membersByFullName, membersByLastName]);

  type FlaggedFamily = {
    family: Family;
    members: Member[];
  };

  type FamilyFocusCompanionship = Companionship & {
    flaggedFamilies: FlaggedFamily[];
  };

  const familyFocusCompanionships: FamilyFocusCompanionship[] = useMemo(() => {
    return companionships.map((companionship) => {
      const flaggedFamilies = companionship.families
        .map<FlaggedFamily | null>((family) => {
          const relatedMembers = resolveFamilyMembers(family.name);
          const flaggedMembers = relatedMembers.filter(member =>
            member.status === 'inactive' || member.status === 'less_active'
          );
          return flaggedMembers.length > 0 ? { family, members: flaggedMembers } : null;
        })
        .filter((entry): entry is FlaggedFamily => entry !== null);

      if (flaggedFamilies.length === 0) {
        return null;
      }

      return { ...companionship, flaggedFamilies };
    }).filter((entry): entry is FamilyFocusCompanionship => entry !== null);
  }, [companionships, resolveFamilyMembers]);

  const observationCounts = {
    withoutEndowment: membersWithoutEndowment.length,
    withoutElderOrdination: membersWithoutElderOrdination.length,
    withoutHigherPriesthood: membersWithoutHigherPriesthood.length,
    withoutMinistering: membersWithoutMinistering.length,
    inactive: inactiveMembers.length,
    familyFocusCompanionships: familyFocusCompanionships.length,
    problematicCompanionships: problematicCompanionships.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Observaciones</h1>
        <p className="text-muted-foreground">
          Seguimiento de miembros que requieren atenciÃ³n especial.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer" onClick={() => withoutEndowmentRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Sin Investidura</CardTitle>
             <AlertTriangle className="h-4 w-4 text-orange-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-orange-600">{observationCounts.withoutEndowment}</div>
             <p className="text-xs text-muted-foreground">miembros sin ordenanza de investidura</p>
           </CardContent>
         </Card>
        <Card className="cursor-pointer" onClick={() => withoutElderOrdinationRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Sin Ordenanza de Elderes</CardTitle>
             <UserCheck className="h-4 w-4 text-purple-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-purple-600">{observationCounts.withoutElderOrdination}</div>
             <p className="text-xs text-muted-foreground">miembros sin ordenanza de Ã©lder</p>
           </CardContent>
         </Card>
        <Card className="cursor-pointer" onClick={() => withoutHigherPriesthoodRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Sin Sacerdocio Mayor</CardTitle>
             <UserCheck className="h-4 w-4 text-indigo-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-indigo-600">{observationCounts.withoutHigherPriesthood}</div>
             <p className="text-xs text-muted-foreground">miembros sin sacerdocio mayor</p>
           </CardContent>
         </Card>
        <Card className="cursor-pointer" onClick={() => withoutMinisteringRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Sin Ministrantes</CardTitle>
             <UserX className="h-4 w-4 text-blue-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-blue-600">{observationCounts.withoutMinistering}</div>
             <p className="text-xs text-muted-foreground">miembros sin maestros ministrantes</p>
           </CardContent>
         </Card>
        <Card className="cursor-pointer" onClick={() => inactiveRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
             <UserX className="h-4 w-4 text-red-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-red-600">{observationCounts.inactive}</div>
             <p className="text-xs text-muted-foreground">miembros inactivos</p>
           </CardContent>
         </Card>
        <Card className="cursor-pointer" onClick={() => familyFocusCompanionshipsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Familias en seguimiento</CardTitle>
            <Users className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">{observationCounts.familyFocusCompanionships}</div>
            <p className="text-xs text-muted-foreground">compañerismos con familias menos activas o inactivas</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => problematicCompanionshipsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">CompaÃ±erÃ­as ProblemÃ¡ticas</CardTitle>
             <Users className="h-4 w-4 text-orange-600" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-orange-600">{observationCounts.problematicCompanionships}</div>
             <p className="text-xs text-muted-foreground">compaÃ±erÃ­as con compaÃ±eros inactivos</p>
           </CardContent>
         </Card>
      </div>

      {/* SecciÃ³n Sin Investidura */}
      <Card ref={withoutEndowmentRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Miembros Sin Ordenanza de Investidura
          </CardTitle>
          <CardDescription>
            Miembros que no han recibido la ordenanza del templo de investidura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>TelÃ©fono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ordenanzas Recibidas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : membersWithoutEndowment.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Todos los miembros han recibido la investidura.
                    </TableCell>
                  </TableRow>
                ) : (
                  membersWithoutEndowment.map((member) => {
                    const statusInfo = statusConfig[member.status];
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={`${member.firstName} ${member.lastName}`}
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
                          <Badge variant={statusInfo.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
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
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProfile(member.id)}
                            title="Ver perfil"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : membersWithoutEndowment.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Todos los miembros han recibido la investidura.
                </p>
              </div>
            ) : (
              membersWithoutEndowment.map((member) => {
                const statusInfo = statusConfig[member.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
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
                              {member.phoneNumber || 'Sin telÃ©fono'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Ordenanzas:</p>
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
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* SecciÃ³n Sin Ordenanza de Elderes */}
      <Card ref={withoutElderOrdinationRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-purple-600" />
            Miembros Sin Ordenanza de Elderes
          </CardTitle>
          <CardDescription>
            Miembros que no han recibido la ordenanza de Ã©lder (sacerdocio mayor).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>TelÃ©fono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ordenanzas Recibidas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : membersWithoutElderOrdination.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Todos los miembros han recibido la ordenanza de Ã©lder.
                    </TableCell>
                  </TableRow>
                ) : (
                  membersWithoutElderOrdination.map((member) => {
                    const statusInfo = statusConfig[member.status];
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={`${member.firstName} ${member.lastName}`}
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
                          <Badge variant={statusInfo.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
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
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProfile(member.id)}
                            title="Ver perfil"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : membersWithoutElderOrdination.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Todos los miembros han recibido la ordenanza de Ã©lder.
                </p>
              </div>
            ) : (
              membersWithoutElderOrdination.map((member) => {
                const statusInfo = statusConfig[member.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
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
                              {member.phoneNumber || 'Sin telÃ©fono'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Ordenanzas:</p>
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
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* SecciÃ³n Sin Sacerdocio Mayor */}
      <Card ref={withoutHigherPriesthoodRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            Miembros Sin Sacerdocio Mayor
          </CardTitle>
          <CardDescription>
            Miembros que no han recibido la ordenanza de Ã©lder ni de sumo sacerdote (sacerdocio mayor).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>TelÃ©fono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ordenanzas Recibidas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : membersWithoutHigherPriesthood.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Todos los miembros han recibido el sacerdocio mayor.
                    </TableCell>
                  </TableRow>
                ) : (
                  membersWithoutHigherPriesthood.map((member) => {
                    const statusInfo = statusConfig[member.status];
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={`${member.firstName} ${member.lastName}`}
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
                          <Badge variant={statusInfo.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
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
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProfile(member.id)}
                            title="Ver perfil"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : membersWithoutHigherPriesthood.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Todos los miembros han recibido el sacerdocio mayor.
                </p>
              </div>
            ) : (
              membersWithoutHigherPriesthood.map((member) => {
                const statusInfo = statusConfig[member.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
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
                              {member.phoneNumber || 'Sin telÃ©fono'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Ordenanzas:</p>
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
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* SecciÃ³n Sin Maestros Ministrantes */}
      <Card ref={withoutMinisteringRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-blue-600" />
            Miembros Sin Maestros Ministrantes
          </CardTitle>
          <CardDescription>
            Miembros que no tienen asignados maestros ministrantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>TelÃ©fono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : membersWithoutMinistering.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Todos los miembros tienen maestros ministrantes asignados.
                    </TableCell>
                  </TableRow>
                ) : (
                  membersWithoutMinistering.map((member) => {
                    const statusInfo = statusConfig[member.status];
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={`${member.firstName} ${member.lastName}`}
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
                          <Badge variant={statusInfo.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProfile(member.id)}
                            title="Ver perfil"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : membersWithoutMinistering.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Todos los miembros tienen maestros ministrantes asignados.
                </p>
              </div>
            ) : (
              membersWithoutMinistering.map((member) => {
                const statusInfo = statusConfig[member.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
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
                              {member.phoneNumber || 'Sin telÃ©fono'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Perfil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* SecciÃ³n Miembros Inactivos */}
      <Card ref={inactiveRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-600" />
            Miembros Inactivos
          </CardTitle>
          <CardDescription>
            Miembros marcados como inactivos que requieren seguimiento especial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>TelÃ©fono</TableHead>
                  <TableHead>Fecha de Nacimiento</TableHead>
                  <TableHead>Ãltima Actividad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : inactiveMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No hay miembros inactivos.
                    </TableCell>
                  </TableRow>
                ) : (
                  inactiveMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={`${member.firstName} ${member.lastName}`}
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
                        {member.birthDate
                          ? format(member.birthDate.toDate(), 'd MMM yyyy', { locale: es })
                          : 'No especificada'}
                      </TableCell>
                      <TableCell>
                        {member.lastActiveDate
                          ? format(member.lastActiveDate.toDate(), 'd MMM yyyy', { locale: es })
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(member.id)}
                          title="Ver perfil"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : inactiveMembers.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No hay miembros inactivos.
                </p>
              </div>
            ) : (
              inactiveMembers.map((member) => (
                <Card key={member.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {member.photoURL ? (
                          <img
                            src={member.photoURL}
                            alt={`${member.firstName} ${member.lastName}`}
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
                            {member.phoneNumber || 'Sin telÃ©fono'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {member.birthDate && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Nacimiento: {format(member.birthDate.toDate(), 'd MMM yyyy', { locale: es })}
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground mb-3">
                      Ãltima actividad: {member.lastActiveDate
                        ? format(member.lastActiveDate.toDate(), 'd MMM yyyy', { locale: es })
                        : 'Nunca'}
                    </p>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProfile(member.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Perfil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección Compañerismos con familias menos activas */}
      <Card ref={familyFocusCompanionshipsRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-600" />
            Familias que necesitan visita
          </CardTitle>
          <CardDescription>Compañerismos con familias asignadas donde hay miembros menos activos o inactivos.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compañerismo</TableHead>
                  <TableHead>Familias y estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-52" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : familyFocusCompanionships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No hay familias menos activas asignadas actualmente.
                    </TableCell>
                  </TableRow>
                ) : (
                  familyFocusCompanionships.map((companionship) => (
                    <TableRow key={companionship.id}>
                      <TableCell className="font-medium">
                        {companionship.companions.map((c, i) => (
                          <div key={i}>
                            <span>{c}</span>
                            {i < companionship.companions.length - 1 && <hr className="my-1" />}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {companionship.flaggedFamilies.map((flagged, index) => (
                          <div key={flagged.family.name} className="space-y-1 py-1">
                            <p className="font-medium">{flagged.family.name}</p>
                            <div className="flex flex-wrap gap-1">
                              {flagged.members.map((member) => {
                                const statusInfo = statusConfig[member.status];
                                const StatusIcon = statusInfo.icon;
                                return (
                                  <Badge key={member.id} variant={statusInfo.variant} className="gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {member.firstName} {member.lastName}
                                  </Badge>
                                );
                              })}
                            </div>
                            {index < companionship.flaggedFamilies.length - 1 && <div className="my-2 h-px bg-muted" />}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/ministering/${companionship.id}`)}
                          title="Ver compañerismo"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : familyFocusCompanionships.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay familias menos activas asignadas actualmente.</p>
              </div>
            ) : (
              familyFocusCompanionships.map((companionship) => (
                <Card key={companionship.id}>
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Compañeros:</p>
                      {companionship.companions.map((c, i) => (
                        <div key={i}>
                          <p>{c}</p>
                          {i < companionship.companions.length - 1 && <hr className="my-1" />}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Familias por animar:</p>
                      {companionship.flaggedFamilies.map((flagged) => (
                        <div key={flagged.family.name} className="mb-3 last:mb-0">
                          <p className="font-semibold">{flagged.family.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {flagged.members.map((member) => {
                              const statusInfo = statusConfig[member.status];
                              const StatusIcon = statusInfo.icon;
                              return (
                                <Badge key={member.id} variant={statusInfo.variant} className="gap-1">
                                  <StatusIcon className="h-3 w-3" />
                                  {member.firstName}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/ministering/${companionship.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />Ver más
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* SecciÃ³n CompaÃ±erÃ­as ProblemÃ¡ticas */}
      <Card ref={problematicCompanionshipsRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            CompaÃ±erÃ­as con CompaÃ±eros Inactivos o Menos Activos
          </CardTitle>
          <CardDescription>
            CompaÃ±erÃ­as de ministraciÃ³n donde uno o mÃ¡s compaÃ±eros estÃ¡n marcados como inactivos o menos activos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CompaÃ±eros</TableHead>
                  <TableHead>Familias Asignadas</TableHead>
                  <TableHead>Estado de CompaÃ±eros</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : problematicCompanionships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Todas las compaÃ±erÃ­as tienen compaÃ±eros activos.
                    </TableCell>
                  </TableRow>
                ) : (
                  problematicCompanionships.map((companionship) => {
                    const inactiveCompanions = companionship.companions.filter(companionName => {
                      const member = members.find(m =>
                        `${m.firstName} ${m.lastName}`.toLowerCase() === companionName.toLowerCase()
                      );
                      return member && (member.status === 'less_active' || member.status === 'inactive');
                    });

                    return (
                      <TableRow key={companionship.id}>
                        <TableCell className="font-medium">
                          {companionship.companions.map((c, i) => (
                            <div key={i}>
                              <span>{c}</span>
                              {i < companionship.companions.length - 1 && <hr className="my-1" />}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {companionship.families.map((f, i) => (
                            <div key={i}>
                              <span>{f.name}</span>
                              {i < companionship.families.length - 1 && <hr className="my-1" />}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {inactiveCompanions.map((companionName, i) => {
                              const member = members.find(m =>
                                `${m.firstName} ${m.lastName}`.toLowerCase() === companionName.toLowerCase()
                              );
                              if (!member) return null;
                              const statusInfo = statusConfig[member.status];
                              const StatusIcon = statusInfo.icon;
                              return (
                                <Badge key={i} variant={statusInfo.variant} className="gap-1">
                                  <StatusIcon className="h-3 w-3" />
                                  {statusInfo.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/ministering/${companionship.id}`)}
                            title="Ver compaÃ±erÃ­a"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : problematicCompanionships.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Todas las compaÃ±erÃ­as tienen compaÃ±eros activos.
                </p>
              </div>
            ) : (
              problematicCompanionships.map((companionship) => {
                const inactiveCompanions = companionship.companions.filter(companionName => {
                  const member = members.find(m =>
                    `${m.firstName} ${m.lastName}`.toLowerCase() === companionName.toLowerCase()
                  );
                  return member && (member.status === 'less_active' || member.status === 'inactive');
                });

                return (
                  <Card key={companionship.id}>
                    <CardContent className="pt-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">CompaÃ±eros:</p>
                        {companionship.companions.map((c, i) => (
                          <div key={i}>
                            <p>{c}</p>
                            {i < companionship.companions.length - 1 && <hr className="my-1" />}
                          </div>
                        ))}
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Familias:</p>
                        {companionship.families.map((f, i) => (
                          <div key={i}>
                            <p>{f.name}</p>
                            {i < companionship.families.length - 1 && <hr className="my-1" />}
                          </div>
                        ))}
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Estado de CompaÃ±eros:</p>
                        <div className="flex flex-wrap gap-1">
                          {inactiveCompanions.map((companionName, i) => {
                            const member = members.find(m =>
                              `${m.firstName} ${m.lastName}`.toLowerCase() === companionName.toLowerCase()
                            );
                            if (!member) return null;
                            const statusInfo = statusConfig[member.status];
                            const StatusIcon = statusInfo.icon;
                            return (
                              <Badge key={i} variant={statusInfo.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/ministering/${companionship.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver CompaÃ±erÃ­a
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {showScrollTop && (
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-50 rounded-full p-3 shadow-lg bg-primary hover:bg-primary/90"
          size="icon"
          title="Volver al inicio"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
