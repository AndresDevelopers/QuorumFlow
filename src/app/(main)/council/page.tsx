
'use client'

export const dynamic = 'force-dynamic';

import { getDocs, query, orderBy, where, Timestamp, doc, updateDoc, getDoc, deleteDoc, collection } from 'firebase/firestore';
import { membersCollection, futureMembersCollection, ministeringCollection, annotationsCollection, servicesCollection, activitiesCollection, convertsCollection } from '@/lib/collections';
import type { Member, FutureMember, Companionship, Family, Annotation, Service, Activity, Convert } from '@/lib/types';
import { getLessActiveMembers } from '@/lib/members-data';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { firestore } from '@/lib/firebase';

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
import { format, subMonths, subYears, addDays, subHours, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserCheck, Users, CalendarClock, AlertTriangle, CheckCircle, NotebookPen, Trash2, Save, Wrench, BellRing, UserMinus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceAnnotations } from '@/components/shared/voice-annotations';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';


async function getAnnotations(source: 'dashboard' | 'council', forCouncil: boolean = false): Promise<Annotation[]> {
    try {
        let q;
        if (forCouncil) {
             const fromDashboardQuery = query(annotationsCollection, where('isCouncilAction', '==', true), where('isResolved', '==', false));
             const fromCouncilQuery = query(annotationsCollection, where('source', '==', 'council'), where('isResolved', '==', false));
             
             const [dashboardSnapshot, councilSnapshot] = await Promise.all([
                 getDocs(fromDashboardQuery),
                 getDocs(fromCouncilQuery)
             ]);

             const dashboardAnns = dashboardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Annotation));
             const councilAnns = councilSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Annotation));
             
             const allAnns = new Map([...dashboardAnns, ...councilAnns].map(ann => [ann.id, ann]));
             return Array.from(allAnns.values());
        } else {
            q = query(annotationsCollection, where('source', '==', source), where('isResolved', '==', false), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Annotation));
        }

    } catch (error) {
        console.error("Error fetching annotations", { error, source, forCouncil });
        return [];
    }
}

async function getCouncilMembers(): Promise<Member[]> {
  const twoYearsAgo = subYears(new Date(), 2);
  const twentyFourHoursAgo = subHours(new Date(), 24);

  const snapshot = await getDocs(query(membersCollection, orderBy('baptismDate', 'desc')));

  const councilList = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Member))
    .filter(member => {
        const baptismDate = member.baptismDate?.toDate();
        if (!baptismDate || baptismDate < twoYearsAgo) return false;

        const isPending = !member.councilCompleted;
        const wasCompletedRecently = member.councilCompleted && member.councilCompletedAt && member.councilCompletedAt.toDate() > twentyFourHoursAgo;

        return isPending || wasCompletedRecently;
    });

  return councilList;
}

async function getUpcomingBaptisms(): Promise<FutureMember[]> {
  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  const q = query(
    futureMembersCollection,
    where('baptismDate', '>=', Timestamp.fromDate(now)),
    where('baptismDate', '<=', Timestamp.fromDate(sevenDaysFromNow))
  );

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FutureMember));
  
  return data.sort((a,b) => a.baptismDate.toMillis() - b.baptismDate.toMillis());
}

type UrgentFamily = Family & { companionshipId: string, companions: string[] };

async function getUrgentNeeds(): Promise<UrgentFamily[]> {
    const snapshot = await getDocs(ministeringCollection);
    const urgentNeeds: UrgentFamily[] = [];

    snapshot.forEach(doc => {
        const comp = { id: doc.id, ...doc.data() } as Companionship;
        comp.families.forEach(family => {
            if (family.isUrgent) {
                urgentNeeds.push({
                    ...family,
                    companionshipId: comp.id,
                    companions: comp.companions,
                });
            }
        });
    });

    return urgentNeeds;
}

async function getCouncilAnnotations(): Promise<Annotation[]> {
    const councilAnns = await getAnnotations('council', true);
    return councilAnns.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

async function getUpcomingServices(): Promise<Service[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // We need two queries because Firestore doesn't support 'OR' or '!=' in a way that works for this.
  // One query for documents where councilNotified is false
  const notifiedFalseQuery = query(
    servicesCollection,
    where('date', '>=', Timestamp.fromDate(today)),
    where('councilNotified', '==', false)
  );
  
  // A separate query to get documents that don't have the councilNotified field at all
  const coll = collection(firestore, 'c_servicios');
  const allServicesSnapshot = await getDocs(query(coll, where('date', '>=', Timestamp.fromDate(today))));
  
  const notNotifiedOrFieldMissing = allServicesSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Service))
    .filter(service => service.councilNotified === false || service.councilNotified === undefined);

  // Sort the combined results by date
  return notNotifiedOrFieldMissing.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Function to get upcoming activities from Reports page data source (show 14 days before, hide after date passes)
async function getUpcomingActivities(): Promise<Activity[]> {
  try {
    const now = new Date();
    const fourteenDaysFromNow = addDays(now, 14);
    
    // Get all activities using the same query as Reports page
    const q = query(activitiesCollection, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    
    const activities = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
      .filter(activity => {
        const activityDate = activity.date.toDate();
        
        // Show activities that are:
        // 1. Within 14 days from now (upcoming)
        // 2. Not past their date (hide after date passes)
        return isBefore(activityDate, fourteenDaysFromNow) && isAfter(activityDate, now);
      })
      .sort((a, b) => a.date.toMillis() - b.date.toMillis()); // Sort by date ascending for council view
    
    return activities;
  } catch (error) {
    logger.error({ error, message: 'Error fetching upcoming activities from Reports data source' });
    return [];
  }
}


export default function CouncilPage() {
  const { user, loading: authLoading } = useAuth();
  const [councilConverts, setCouncilConverts] = useState<Member[]>([]);
  const [upcomingBaptisms, setUpcomingBaptisms] = useState<FutureMember[]>([]);
  const [urgentNeeds, setUrgentNeeds] = useState<UrgentFamily[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [lessActiveMembers, setLessActiveMembers] = useState<Member[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [observationInputs, setObservationInputs] = useState<Record<string, string>>({});

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
        const [converts, baptisms, needs, notes, upcomingServices, lessActive, activities] = await Promise.all([
        getCouncilMembers(),
        getUpcomingBaptisms(),
        getUrgentNeeds(),
        getCouncilAnnotations(),
        getUpcomingServices(),
        getLessActiveMembers(),
        getUpcomingActivities(),
        ]);
        setCouncilConverts(converts);
        setUpcomingBaptisms(baptisms);
        setUrgentNeeds(needs);
        setAnnotations(notes);
        setServices(upcomingServices);
        setLessActiveMembers(lessActive);
        setUpcomingActivities(activities);

        const initialObservations: Record<string, string> = {};
        converts.forEach((c: Member) => {
            initialObservations[c.id] = c.lessActiveObservation || '';
        });
        setObservationInputs(initialObservations);
    } catch (error) {
        logger.error({ error, message: 'Error fetching council data' });
        toast({ title: "Error", description: "No se pudieron cargar los datos del consejo.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading || !user) return;
    fetchAllData();
  }, [authLoading, user, fetchAllData]);

  const handleResolveAnnotation = async (id: string) => {
    try {
        const annotationRef = doc(annotationsCollection, id);
        const annotationSnap = await getDoc(annotationRef);

        if (!annotationSnap.exists()) {
             logger.warn({ annotationId: id, message: 'Attempted to resolve non-existent annotation' });
             toast({ title: 'Error', description: 'Annotation not found.', variant: 'destructive' });
             return;
        }

        const annotationData = annotationSnap.data() as Annotation;

        if (annotationData.source === 'council') {
            await deleteDoc(annotationRef);
        } else {
            await updateDoc(annotationRef, {
                isResolved: true,
                isCouncilAction: false,
            });
        }
        toast({ title: 'Anotación Resuelta', description: 'La anotación ha sido marcada como resuelta.' });
        fetchAllData();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, message: 'Error resolving annotation', id });
        toast({ title: 'Error al Resolver', description: `Failed to resolve annotation: ${errorMessage}`, variant: 'destructive' });
    }
  }

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await deleteDoc(doc(annotationsCollection, id));
      toast({ title: 'Anotación Eliminada', description: 'La anotación ha sido eliminada permanentemente.' });
      fetchAllData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, message: 'Error deleting annotation', id });
      toast({ title: 'Error al Eliminar', description: `Failed to delete annotation: ${errorMessage}`, variant: 'destructive' });
    }
  }

  const handleSaveObservation = async (memberId: string) => {
    const observation = observationInputs[memberId];
    try {
        const memberRef = doc(membersCollection, memberId);
        await updateDoc(memberRef, { lessActiveObservation: observation });
        toast({ title: 'Éxito', description: 'Observación guardada.' });
        fetchAllData();
    } catch (error) {
        logger.error({ error, memberId, message: 'Error saving observation' });
        toast({ title: 'Error', description: 'No se pudo guardar la observación.', variant: 'destructive' });
    }
  };

  const handleMarkCouncilCompleted = async (memberId: string) => {
      try {
        const memberRef = doc(membersCollection, memberId);
        await updateDoc(memberRef, {
            councilCompleted: true,
            councilCompletedAt: Timestamp.now()
        });
        toast({ title: 'Éxito', description: 'Seguimiento de miembro marcado como completado.' });
        fetchAllData();
      } catch (error) {
        logger.error({ error, memberId, message: 'Error marking council as completed' });
        toast({ title: 'Error', description: 'No se pudo marcar como completado.', variant: 'destructive' });
      }
  }

  const handleResolveUrgentNeed = async (companionshipId: string, familyName: string) => {
    try {
        const companionshipRef = doc(ministeringCollection, companionshipId);
        const companionshipSnap = await getDoc(companionshipRef);

        if (!companionshipSnap.exists()) throw new Error("Companionship not found");
        
        const companionship = companionshipSnap.data() as Companionship;
        const familyIndex = companionship.families.findIndex(f => f.name === familyName);
        if (familyIndex === -1) throw new Error("Family not found");

        const updatedFamilies = [...companionship.families];
        updatedFamilies[familyIndex] = { ...updatedFamilies[familyIndex], isUrgent: false, observation: '' };
        await updateDoc(companionshipRef, { families: updatedFamilies });
        toast({ title: 'Éxito', description: 'La necesidad urgente ha sido marcada como resuelta.' });
        fetchAllData();
    } catch (error) {
        logger.error({ error, companionshipId, familyName, message: 'Error resolving urgent need' });
        toast({ title: 'Error', description: 'No se pudo resolver la necesidad urgente.', variant: 'destructive' });
    }
  }

  const handleMarkServiceNotified = async (serviceId: string) => {
    try {
      const serviceRef = doc(servicesCollection, serviceId);
      await updateDoc(serviceRef, { councilNotified: true });
      toast({ title: 'Éxito', description: 'El servicio ha sido marcado como avisado.' });
      fetchAllData();
    } catch (error) {
      logger.error({ error, serviceId, message: 'Error marking service as notified' });
      toast({ title: 'Error', description: 'No se pudo marcar el servicio como avisado.', variant: 'destructive' });
    }
  };

  const handleMarkLessActiveMemberCompleted = async (memberId: string) => {
    try {
      const memberRef = doc(collection(firestore, 'c_miembros'), memberId);
      await updateDoc(memberRef, { 
        councilCompleted: true,
        councilCompletedAt: Timestamp.now()
      });
      toast({ title: 'Éxito', description: 'Seguimiento de miembro menos activo marcado como completado.' });
      fetchAllData();
    } catch (error) {
      logger.error({ error, memberId, message: 'Error marking less active member as completed' });
      toast({ title: 'Error', description: 'No se pudo marcar como completado.', variant: 'destructive' });
    }
  };

  const today = new Date();
  const sevenDaysFromNow = addDays(today, 7);
  const servicesIn7Days = services.filter(s => s.date.toDate() <= sevenDaysFromNow);
  const futureServices = services.filter(s => s.date.toDate() > sevenDaysFromNow);


  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
            <VoiceAnnotations
                title="Anotaciones para el Consejo"
                description="Notas del quórum y puntos marcados para seguimiento en el consejo."
                source="council"
                annotations={annotations}
                isLoading={loading}
                onAnnotationAdded={fetchAllData}
                onAnnotationToggled={fetchAllData}
                showCouncilView={true}
                onResolveAnnotation={handleResolveAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
                currentUserId={user?.uid}
            />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Wrench className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Servicios Próximos</CardTitle>
              <CardDescription>
                Proyectos de servicio para coordinar en el consejo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold">En los Próximos 7 Días</h3>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicesIn7Days.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No hay servicios programados para esta semana.
                      </TableCell>
                    </TableRow>
                  ) : (
                    servicesIn7Days.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>{format(item.date.toDate(), "eeee, d 'de' LLLL", { locale: es })}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleMarkServiceNotified(item.id)}>
                            <BellRing className="mr-2 h-4 w-4" />
                            Marcar como Avisado
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Servicios Futuros</h3>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futureServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center">
                        No hay más servicios futuros programados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    futureServices.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>{format(item.date.toDate(), "d 'de' LLLL, yyyy", { locale: es })}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
             <Users className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Seguimiento de Conversos</CardTitle>
              <CardDescription>
                Miembros recién bautizados para seguimiento en el consejo de barrio.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : councilConverts.length === 0 ? (
             <p className="text-sm text-center text-muted-foreground h-24 flex items-center justify-center">
               No hay conversos pendientes de seguimiento.
            </p>
          ) : (
            <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Bautismo</TableHead>
                    <TableHead className="w-[40%]">Observación</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {councilConverts.map((item) => (
                    <TableRow key={item.id} className={item.councilCompleted ? 'bg-green-500/10' : ''}>
                      <TableCell>
                        {item.photoURL ? (
                          <Image
                            src={item.photoURL}
                            alt={`Foto de ${item.firstName} ${item.lastName}`}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserCheck className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs font-medium text-foreground">{item.firstName} {item.lastName}</span>
                          <span>{item.baptismDate ? format(item.baptismDate.toDate(), 'd LLLL yyyy', { locale: es }) : 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center gap-2">
                              <Textarea
                                  placeholder="Añadir observación..."
                                  value={observationInputs[item.id] || ''}
                                  onChange={(e) => setObservationInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  rows={1}
                                  disabled={item.councilCompleted}
                              />
                              {observationInputs[item.id] !== (item.lessActiveObservation || '') && (
                                  <Button size="sm" variant="outline" onClick={() => handleSaveObservation(item.id)}>
                                      <Save className="h-4 w-4" />
                                  </Button>
                              )}
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.councilCompleted ? (
                          <Badge variant="default">Completado</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleMarkCouncilCompleted(item.id)}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Marcar Completado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
               {councilConverts.map((item) => (
                 <Card key={item.id} className={item.councilCompleted ? 'bg-green-500/10' : ''}>
                   <CardContent className="pt-4 space-y-4">
                     <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                         {item.photoURL ? (
                           <Image
                             src={item.photoURL}
                             alt={`Foto de ${item.firstName} ${item.lastName}`}
                             width={48}
                             height={48}
                             className="w-12 h-12 rounded-full object-cover"
                           />
                         ) : (
                           <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                             <UserCheck className="w-6 h-6 text-gray-500" />
                           </div>
                         )}
                         <div>
                           <p className="font-bold text-foreground">{item.firstName} {item.lastName}</p>
                           <p className="text-sm text-muted-foreground">
                             Bautismo: {item.baptismDate ? format(item.baptismDate.toDate(), 'd LLL yyyy', { locale: es }) : 'N/A'}
                           </p>
                         </div>
                       </div>
                       {item.councilCompleted ? (
                          <Badge variant="default">Completado</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleMarkCouncilCompleted(item.id)}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Completar
                          </Button>
                        )}
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor={`obs-${item.id}`}>Observación</Label>
                       <div className="flex items-center gap-2">
                           <Textarea
                               id={`obs-${item.id}`}
                                placeholder="Añadir observación..."
                                value={observationInputs[item.id] || ''}
                                onChange={(e) => setObservationInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                rows={2}
                                disabled={item.councilCompleted}
                            />
                            {observationInputs[item.id] !== (item.lessActiveObservation || '') && (
                                <Button size="icon" variant="outline" onClick={() => handleSaveObservation(item.id)}>
                                    <Save className="h-4 w-4" />
                                </Button>
                            )}
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
             <CalendarClock className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Bautismos en los Próximos 7 Días</CardTitle>
              <CardDescription>
                Futuros miembros con bautismos programados para esta semana.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
         {loading ? <Skeleton className="h-24 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre del Futuro Miembro</TableHead>
                <TableHead>Fecha Programada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingBaptisms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center">
                    No hay bautismos programados para los próximos 7 días.
                  </TableCell>
                </TableRow>
              ) : (
                upcomingBaptisms.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                       {item.baptismDate ? format(item.baptismDate.toDate(), 'd LLLL yyyy', { locale: es }) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
         )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
             <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <CardTitle>Actividades Registradas</CardTitle>
              <CardDescription>
                Actividades próximas que requieren atención del consejo (próximas 14 días).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : upcomingActivities.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay actividades próximas registradas.
            </p>
          ) : (
            <div className="space-y-4">
              {upcomingActivities.map((activity) => (
                <div key={activity.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{activity.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <CalendarClock className="h-4 w-4" />
                        <span>{format(activity.date.toDate(), 'd LLLL yyyy', { locale: es })}</span>
                        {activity.time && <span>• {activity.time}</span>}
                      </div>
                      {activity.location && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {activity.location}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Próxima
                    </Badge>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-gray-700 mt-2">{activity.description}</p>
                  )}
                  {activity.context && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>Contexto:</strong> {activity.context}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
             <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <CardTitle>Necesidades Urgentes de Ministración</CardTitle>
              <CardDescription>
                Familias que requieren atención inmediata según lo reportado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           {loading ? <Skeleton className="h-24 w-full" /> : urgentNeeds.length === 0 ? (
             <p className="text-sm text-center text-muted-foreground h-24 flex items-center justify-center">
                No hay necesidades urgentes reportadas.
             </p>
           ) : (
            <Accordion type="single" collapsible className="w-full">
                {urgentNeeds.map((item, index) => (
                     <AccordionItem value={`item-${index}`} key={`${item.companionshipId}-${item.name}`}>
                        <AccordionTrigger>
                           <div className='flex items-center justify-between w-full pr-4'>
                                <div>
                                    <span className='font-semibold'>{item.name}</span>
                                    <p className='text-sm text-muted-foreground font-normal'>Asignados a: {item.companions.join(' y ')}</p>
                                </div>
                                <Badge variant="destructive">Urgente</Badge>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="p-4 bg-muted/50 rounded-md space-y-4">
                             <p className="text-sm">
                                <span className="font-semibold">Observación:</span> {item.observation}
                            </p>
                            <Button size="sm" onClick={() => handleResolveUrgentNeed(item.companionshipId, item.name)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Marcar como Resuelto
                            </Button>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
           )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
             <UserMinus className="h-8 w-8 text-orange-500" />
            <div>
              <CardTitle>Miembros Menos Activos</CardTitle>
              <CardDescription>
                Miembros que requieren seguimiento y apoyo del consejo de barrio.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24 w-full" /> : lessActiveMembers.length === 0 ? (
             <p className="text-sm text-center text-muted-foreground h-24 flex items-center justify-center">
               No hay miembros menos activos registrados.
            </p>
          ) : (
            <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Inactivo Desde</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessActiveMembers.map((member) => (
                    <TableRow key={member.id} className={member.councilCompleted ? 'bg-green-500/10' : ''}>
                      <TableCell className="font-medium">{member.firstName} {member.lastName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Menos Activo
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.inactiveSince ? format(member.inactiveSince.toDate(), 'd LLLL yyyy', { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.councilCompleted ? (
                          <Badge variant="default">Completado</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleMarkLessActiveMemberCompleted(member.id)}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Marcar Completado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
               {lessActiveMembers.map((member) => (
                 <Card key={member.id} className={member.councilCompleted ? 'bg-green-500/10' : ''}>
                   <CardContent className="pt-4 space-y-4">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="font-bold">{member.firstName} {member.lastName}</p>
                         <p className="text-sm text-muted-foreground">
                           Inactivo desde: {member.inactiveSince ? format(member.inactiveSince.toDate(), 'd LLL yyyy', { locale: es }) : 'N/A'}
                         </p>
                         <Badge variant="outline" className="text-orange-600 border-orange-600 mt-2">
                           Menos Activo
                         </Badge>
                       </div>
                       {member.councilCompleted ? (
                          <Badge variant="default">Completado</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleMarkLessActiveMemberCompleted(member.id)}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Completar
                          </Button>
                        )}
                     </div>
                   </CardContent>
                 </Card>
               ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
