
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDocs, query, orderBy, Timestamp, where, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { activitiesCollection, baptismsCollection, futureMembersCollection, annualReportsCollection } from '@/lib/collections';
import type { Activity, Baptism, AnnualReportAnswers } from '@/lib/types';
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
import { suggestActivities, type SuggestedActivities } from '@/ai/flows/suggest-activities-flow';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
            source: 'Automático'
        } as Baptism
    });

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
    
    const allBaptisms = [...fromFutureMembers, ...fromManual];
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

  const [answers, setAnswers] = useState<Partial<AnnualReportAnswers>>({});
  const [loadingAnswers, setLoadingAnswers] = useState(true);

  const currentYear = getYear(new Date());
  const activitiesForCurrentYear = activities.filter(a => getYear(a.date.toDate()) === currentYear);

  const fetchInitialData = useCallback(async () => {
      setLoading(true);
      setLoadingAnswers(true);
      const year = getYear(new Date());

      const [activitiesData, baptismsData, answersData] = await Promise.all([
          getActivities(), 
          getBaptismsForCurrentYear(),
          getAnnualReportAnswers(year)
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

    fetchInitialData().then((activitiesData) => {
        handleGenerateSuggestions(activitiesData);
    });
  }, [authLoading, user, fetchInitialData]);

  const handleGenerateSuggestions = (currentActivities: Activity[] = activities) => {
    startGenerating(async () => {
        try {
            const currentYearActivities = currentActivities
                .filter(a => getYear(a.date.toDate()) === getYear(new Date()))
                .map(a => a.title);

            const result = await suggestActivities({ existingActivities: currentYearActivities });
            setSuggestions(result);
        } catch (error) {
            console.error("Error generating suggestions:", error);
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
      const collection = item.source === 'Manual' ? baptismsCollection : futureMembersCollection;
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
    const year = String(getYear(new Date()));
    try {
        const docRef = doc(annualReportsCollection, year);
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
        const generateReportCallable = httpsCallable(functions, 'generateReport');
        const result = await generateReportCallable({ year: getYear(new Date()) });
        
        const data = result.data as { fileContents: string };
        const byteCharacters = atob(data.fileContents);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        saveAs(blob, `Reporte_Anual_${getYear(new Date())}.docx`);
        toast({ title: "Éxito", description: "El reporte se ha generado correctamente." });

      } catch (error) {
        logger.error({ error, message: "Error calling generateReport cloud function" });
        toast({
          title: "Error al Generar Reporte",
          description: "No se pudo generar el reporte. Verifica la consola para más detalles.",
          variant: "destructive",
          duration: 9000
        });
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
                    <CardTitle>Actividades del Año {currentYear}</CardTitle>
                    <CardDescription>
                    Registro de todas las actividades del quórum para el año actual.
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
                    ) : activitiesForCurrentYear.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No hay actividades registradas para este año.
                        </TableCell>
                        </TableRow>
                    ) : (
                        activitiesForCurrentYear.map((item) => (
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
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta acción eliminará permanentemente la actividad: <strong>{item.title}</strong>.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteActivity(item.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
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
                ) : activitiesForCurrentYear.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay actividades registradas.</p>
                ) : (
                    activitiesForCurrentYear.map((item) => (
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
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>Esta acción eliminará permanentemente la actividad: <strong>{item.title}</strong>.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteActivity(item.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
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
                            Lista de bautismos realizados en el año actual, incluyendo los manuales.
                            </CardDescription>
                        </div>
                    </div>
                    <Button asChild>
                        <Link href="/reports/add-baptism">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Bautismo
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
                            ) : baptisms.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No hay bautismos registrados para este año.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                baptisms.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{format(item.date.toDate(), 'd LLLL yyyy', { locale: es })}</TableCell>
                                        <TableCell>{item.source}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>Esta acción eliminará permanentemente el registro de bautismo de <strong>{item.name}</strong>.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteBaptism(item)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
                    ) : baptisms.length === 0 ? (
                         <p className="text-center text-sm text-muted-foreground py-8">No hay bautismos registrados.</p>
                    ) : (
                         baptisms.map((item) => (
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
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta acción eliminará permanentemente el registro de bautismo de <strong>{item.name}</strong>.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteBaptism(item)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
                    <Button variant="ghost" size="icon" onClick={() => handleGenerateSuggestions()} disabled={isGenerating}>
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
