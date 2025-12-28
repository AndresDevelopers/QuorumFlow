'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDocs, query, orderBy, Timestamp, where, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { activitiesCollection, baptismsCollection, futureMembersCollection, convertsCollection, annualReportsCollection, membersCollection } from '@/lib/collections';
import type { Activity, Baptism, Convert, AnnualReportAnswers } from '@/lib/types';
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { Button } from '@/components/ui/button';
import { Download, FileText, PlusCircle, UserPlus, Droplets, Wand2, RefreshCw, Trash2, Save, Pencil, Camera } from 'lucide-react';
import { format, getYear, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { saveAs } from 'file-saver';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Switch } from '@/components/ui/switch';
import type { SuggestedActivities } from '@/ai/flows/suggest-activities-flow';

function base64ToDocxBlob(base64: string): Blob {
  const sanitized = base64.replace(/\s/g, '');
  const bytes = Uint8Array.from(atob(sanitized), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function getActivities(): Promise<Activity[]> {
  const q = query(activitiesCollection, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
}

async function getBaptismsForCurrentYear(): Promise<Baptism[]> {
    const start = startOfYear(new Date());
    const end = endOfYear(new Date());

    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    // 1. Obtener de futuros miembros
    const futureMembersQuery = query(
        futureMembersCollection,
        where('baptismDate', '>=', startTimestamp),
        where('baptismDate', '<=', endTimestamp)
    );
    const fmSnapshot = await getDocs(futureMembersQuery);
    const fromFutureMembers = fmSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            date: data.baptismDate,
            source: 'Futuro Miembro'
        } as Baptism
    });

    // 2. Obtener de nuevos conversos
    const convertsQuery = query(
        convertsCollection,
        where('baptismDate', '>=', startTimestamp),
        where('baptismDate', '<=', endTimestamp)
    );
    const convertsSnapshot = await getDocs(convertsQuery);
    const fromConverts = convertsSnapshot.docs.map(doc => {
        const data = doc.data() as Convert;
        return {
            id: doc.id,
            name: data.name,
            date: data.baptismDate,
            source: 'Nuevo Converso'
        } as Baptism
    });

    // 3. Obtener bautismos manuales
    const baptismsQuery = query(
        baptismsCollection,
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
    );
    const bSnapshot = await getDocs(baptismsQuery);
    const fromManual = bSnapshot.docs.map(doc => {
         const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            date: data.date,
            source: 'Manual'
        } as Baptism
    });

    // 4. Obtener de miembros existentes con fecha de bautismo en el año actual
    const membersQuery = query(
        membersCollection,
        where('baptismDate', '>=', startTimestamp),
        where('baptismDate', '<=', endTimestamp)
    );
    const membersSnapshot = await getDocs(membersQuery);
    const fromMembers = membersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: `${data.firstName} ${data.lastName}`,
            date: data.baptismDate,
            source: 'Automático'
        } as Baptism
    });
    
    const allBaptisms = [...fromFutureMembers, ...fromConverts, ...fromManual, ...fromMembers];
    return allBaptisms.sort((a,b) => b.date.toMillis() - a.date.toMillis());
}

async function getAnnualReportAnswers(year: number): Promise<AnnualReportAnswers | null> {
    const docRef = doc(annualReportsCollection, String(year));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as AnnualReportAnswers;
    }
    return null;
}

const reportQuestions = [
    { id: 'p1', label: 'Describir los esfuerzos por ayudar a los miembros a vivir el Evangelio de Jesucristo.' },
    { id: 'p2', label: 'Cómo apoyó su organización a la Obra Misional en su barrio o rama.' },
    { id: 'p3', label: 'Describir los esfuerzos por cuidar de los pobres y necesitados (no utilice nombres sin permiso).' },
    { id: 'p4', label: 'Describir como su organización apoyo los esfuerzos por ayudar a los miembros a investigar su historia familiar.' },
    { id: 'p5', label: 'Como secretario, describa cómo usted ha sentido la inspiración del Señor y cómo ha sentido la mano de Dios el Padre guiando sus esfuerzos.' },
    { id: 'p6', label: 'Describa la información adicional que usted sienta que es importante incluir en este informe.' },
];

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [baptisms, setBaptisms] = useState<Baptism[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestedActivities | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isGeneratingReport, startGeneratingReport] = useTransition();
  const [includeAllActivities, setIncludeAllActivities] = useState(true);

  const [answers, setAnswers] = useState<Partial<AnnualReportAnswers>>({});
  const [loadingAnswers, setLoadingAnswers] = useState(true);

  const fetchInitialData = useCallback(async () => {
      setLoading(true);
      setLoadingAnswers(true);
      const currentYear = getYear(new Date());

      const [activitiesData, baptismsData, answersData] = await Promise.all([
          getActivities(), 
          getBaptismsForCurrentYear(),
          getAnnualReportAnswers(currentYear)
      ]);
      
      setActivities(activitiesData);
      setBaptisms(baptismsData);
      if (answersData) {
        setAnswers(answersData);
      }
      setLoading(false);
      setLoadingAnswers(false);

      return activitiesData;
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    fetchInitialData().then(() => {
        handleGenerateSuggestions();
    });
  }, [authLoading, user, fetchInitialData]);

  const handleGenerateSuggestions = async (refresh = false) => {
    startGenerating(async () => {
        try {
            // Check if we're in production
            const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
            const cacheKey = 'reports_suggestions_cache';
            const cacheTimestampKey = 'reports_suggestions_timestamp';

            if (!refresh && isProduction) {
                try {
                    const cachedData = localStorage.getItem(cacheKey);
                    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);

                    if (cachedData && cachedTimestamp) {
                        const cacheAge = Date.now() - parseInt(cachedTimestamp);
                        // Cache for 24 hours
                        if (cacheAge < 24 * 60 * 60 * 1000) {
                            const result = JSON.parse(cachedData);
                            setSuggestions(result);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error loading suggestions from cache:', error);
                }
            }

            const url = refresh ? '/api/suggestions?refresh=true' : '/api/suggestions';
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to fetch suggestions: ${response.status} ${response.statusText}`);
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`Failed to fetch suggestions: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();

            // Cache the result in production
            if (isProduction) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(result));
                    localStorage.setItem(cacheTimestampKey, Date.now().toString());
                } catch (error) {
                    console.error('Error saving suggestions to cache:', error);
                }
            }

            setSuggestions(result);
        } catch (error) {
            console.error("Error generating suggestions:", error);
            // Optionally show user-friendly error message
            setSuggestions(null); // Clear suggestions on error
        }
    });
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteDoc(doc(activitiesCollection, id));
      toast({ title: 'Actividad Eliminada', description: 'El registro de la actividad ha sido eliminado.' });
      fetchInitialData();
    } catch (error) {
      logger.error({ error, message: 'Error deleting activity', id });
      toast({ title: 'Error', description: 'No se pudo eliminar la actividad.', variant: 'destructive' });
    }
  }

  const handleDeleteBaptism = async (item: Baptism) => {
    try {
      let collection;
      if (item.source === 'Manual') {
        collection = baptismsCollection;
      } else if (item.source === 'Nuevo Converso') {
        collection = convertsCollection;
      } else if (item.source === 'Futuro Miembro') {
        collection = futureMembersCollection;
      } else {
        collection = baptismsCollection;
      }
      
      await deleteDoc(doc(collection, item.id));
      toast({ title: 'Bautismo Eliminado', description: 'El registro del bautismo ha sido eliminado.' });
      fetchInitialData();
    } catch (error) {
      logger.error({ error, message: 'Error deleting baptism record', item });
      toast({ title: 'Error', description: 'No se pudo eliminar el registro del bautismo.', variant: 'destructive' });
    }
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSaveAnswers = async () => {
    const currentYear = String(getYear(new Date()));
    try {
        const docRef = doc(annualReportsCollection, currentYear);
        await setDoc(docRef, answers, { merge: true });
        toast({ title: 'Éxito', description: 'Respuestas guardadas correctamente.' });
    } catch (error) {
        logger.error({ error, message: 'Error saving annual report answers' });
        toast({ title: 'Error', description: 'No se pudieron guardar las respuestas.', variant: 'destructive' });
    }
  };

  const generateReport = async () => {
    startGeneratingReport(async () => {
      try {
        const functions = getFunctions();
        const generateCompleteReportCallable = httpsCallable(functions, 'generateCompleteReport');
        const result = await generateCompleteReportCallable({ 
            year: getYear(new Date()),
            includeAllActivities
        });
        
        const data = result.data as { fileContents: string };
        const blob = base64ToDocxBlob(data.fileContents);

        saveAs(blob, `Reporte_Completo_${getYear(new Date())}.docx`);
        toast({ title: "Éxito", description: "El reporte completo se ha generado correctamente." });

      } catch (error) {
        logger.error({ error, message: "Error calling generateCompleteReport cloud function" });
        
        // Fallback a la función anterior si la nueva falla
        try {
          const functions = getFunctions();
          const generateReportCallable = httpsCallable(functions, 'generateReport');
          const result = await generateReportCallable({ 
              year: getYear(new Date()),
              includeAllActivities
          });
          
          const data = result.data as { fileContents: string };
          const blob = base64ToDocxBlob(data.fileContents);

          saveAs(blob, `Reporte_Anual_${getYear(new Date())}.docx`);
          toast({ title: "Éxito", description: "El reporte se ha generado correctamente (versión anterior)." });
        } catch (fallbackError) {
          logger.error({ error: fallbackError, message: "Error calling fallback generateReport cloud function" });
          toast({
            title: "Error al Generar Reporte",
            description: "No se pudo generar el reporte. Verifica la consola para más detalles.",
            variant: "destructive",
            duration: 9000
          });
        }
      }
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-8">
        
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle>Informe Anual</CardTitle>
                            <CardDescription>
                                Compila la información para el informe anual del quórum.
                            </CardDescription>
                        </div>
                    </div>
                     <Button onClick={generateReport} disabled={isGeneratingReport}>
                        {isGeneratingReport ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Generando...</> : <><Download className="mr-2 h-4 w-4" />Descargar Reporte</>}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {loadingAnswers ? (
                    <Skeleton className="h-64 w-full" />
                ) : (
                    reportQuestions.map(q => (
                        <div key={q.id} className="space-y-2">
                            <Label htmlFor={q.id} className="font-semibold">{q.label}</Label>
                            <Textarea
                                id={q.id}
                                value={(answers as any)[q.id] || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                rows={4}
                            />
                        </div>
                    ))
                )}
            </CardContent>
            <CardContent className="flex justify-end">
                <Button onClick={handleSaveAnswers}><Save className="mr-2 h-4 w-4" /> Guardar Respuestas</Button>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle>Actividades Registradas</CardTitle>
                    <CardDescription>
                    Registro de todas las actividades del quórum.
                    </CardDescription>
                </div>
                </div>
                <Button asChild>
                    <Link href="/reports/add">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Actividad
                    </Link>
                </Button>
            </div>
            </CardHeader>
            <CardContent>
            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                        </TableRow>
                        ))
                    ) : activities.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No hay actividades registradas.
                        </TableCell>
                        </TableRow>
                    ) : (
                        activities.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {(item.imageUrls && item.imageUrls.length > 0) ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <span className="font-medium cursor-pointer hover:underline">{item.title}</span>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="max-w-3xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{item.title}</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}
                                                        {item.time && `, ${item.time}`}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <Carousel className="w-full">
                                                    <CarouselContent>
                                                        {item.imageUrls.map((url, index) => (
                                                            <CarouselItem key={index}>
                                                                <Image src={url} alt={`Imagen ${index+1} de ${item.title}`} width={800} height={600} className="w-full h-auto object-contain rounded-md" data-ai-hint="activity photo" />
                                                            </CarouselItem>
                                                        ))}
                                                    </CarouselContent>
                                                    <CarouselPrevious />
                                                    <CarouselNext />
                                                </Carousel>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : (
                                        <span>{item.title}</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}
                                {item.time && `, ${item.time}`}
                            </TableCell>
                            <TableCell className="max-w-md">
                                <p className="truncate">{item.description}</p>
                                {item.additionalText && <p className="text-xs text-muted-foreground truncate">Texto adicional: {item.additionalText}</p>}
                            </TableCell>
                            <TableCell className="text-right">
                                {item.imageUrls && item.imageUrls.length > 0 && <Camera className="h-4 w-4 inline-block mr-2 text-muted-foreground" />}
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/reports/${item.id}/edit`}><Pencil className="h-4 w-4" /></Link>
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
                ) : activities.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay actividades registradas.</p>
                ) : (
                    activities.map((item) => (
                        <Card key={item.id}>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle className="text-base">{item.title}</CardTitle>
                                    <CardDescription>
                                        {format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}
                                        {item.time && `, ${item.time}`}
                                    </CardDescription>
                                </div>
                                <div>
                                    {item.imageUrls && item.imageUrls.length > 0 && <Camera className="h-4 w-4 inline-block mr-2 text-muted-foreground" />}
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/reports/${item.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                                    {item.additionalText && <p className="text-xs text-muted-foreground line-clamp-2 pt-1">Adicional: {item.additionalText}</p>}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
             </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Droplets className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle>Bautismos del Año {getYear(new Date())}</CardTitle>
                            <CardDescription>
                            Lista de miembros bautizados en el año actual.
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Fecha de Bautismo</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 2 }).map((_, i) => (
                                    <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                                    </TableRow>
                                ))
                            ) : baptisms.filter(b => b.source === 'Automático').length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No hay miembros bautizados registrados para este año.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                baptisms.filter(b => b.source === 'Automático').map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}</TableCell>
                                        <TableCell>{item.source}</TableCell>
                                        <TableCell className="text-right">
                                            {item.source === 'Manual' && (
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/reports/edit-baptism?id=${item.id}`}><Pencil className="h-4 w-4" /></Link>
                                                </Button>
                                            )}
                                            {item.source === 'Automático' && (
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/members?edit=${item.id}`}><Pencil className="h-4 w-4" /></Link>
                                                </Button>
                                            )}
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
                        Array.from({ length: 1 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                    ) : baptisms.filter(b => b.source === 'Automático').length === 0 ? (
                         <p className="text-center text-sm text-muted-foreground py-8">No hay miembros bautizados registrados.</p>
                    ) : (
                         baptisms.filter(b => b.source === 'Automático').map((item) => (
                            <Card key={item.id}>
                                <CardContent className="pt-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}
                                            </p>
                                             <p className="text-xs text-muted-foreground">Origen: {item.source}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {item.source === 'Manual' && (
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/reports/edit-baptism?id=${item.id}`}><Pencil className="h-4 w-4" /></Link>
                                                </Button>
                                            )}
                                            {item.source === 'Automático' && (
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/members?edit=${item.id}`}><Pencil className="h-4 w-4" /></Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                         ))
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-20">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Wand2 className="h-6 w-6 text-primary" />
                        <CardTitle>Sugerencias de Actividades</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleGenerateSuggestions(true)} disabled={isGenerating}>
                        <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <CardDescription>
                    Ideas generadas por IA para el próximo mes, basadas en actividades anteriores.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isGenerating ? (
                     <div className="space-y-4">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-5 w-1/3 mt-4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>
                ) : suggestions ? (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold mb-2">Espirituales</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {suggestions.spiritual.map((activity, index) => <li key={`s-${index}`}>{activity}</li>)}
                            </ul>
                        </div>
                         <div>
                            <h3 className="font-semibold mb-2">Temporales</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {suggestions.temporal.map((activity, index) => <li key={`t-${index}`}>{activity}</li>)}
                            </ul>
                        </div>
                    </div>
                ) : (
                     <p className="text-sm text-center text-muted-foreground py-8">
                        No se pudieron generar sugerencias. Verifica tu clave de API de Gemini.
                    </p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
