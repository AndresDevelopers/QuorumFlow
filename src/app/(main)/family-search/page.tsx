
'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { getDocs, query, orderBy, addDoc, serverTimestamp, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import {
  familySearchTrainingsCollection,
  familySearchTasksCollection,
  annotationsCollection,
} from '@/lib/collections';
import type { FamilySearchTraining, FamilySearchTask, Annotation, Member } from '@/lib/types';
import { FamilySelector } from '@/components/family-search/family-selector';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Trash2, Library, BookUser, ListTodo, NotebookPen, Users, Pencil } from 'lucide-react';
import logger from '@/lib/logger';
import { VoiceAnnotations } from '@/components/shared/voice-annotations';
import { where, deleteDoc as deleteDocFirestore } from 'firebase/firestore';


const faqData = [
    {
        question: "¿Cómo empiezo a buscar a mis antepasados?",
        answer: "El primer paso es registrar la información que ya conoces sobre ti, tus padres y tus abuelos en el Árbol Familiar. Luego, utiliza la función 'Buscar' para encontrar registros históricos (actas de nacimiento, matrimonio, censos, etc.) que coincidan con la información de tus familiares. Estos registros te darán pistas para encontrar a la siguiente generación."
    },
    {
        question: "¿Qué hago si no encuentro registros para un antepasado?",
        answer: "No te desanimes. Intenta buscar variaciones en los nombres y apellidos, o busca en registros de localidades cercanas. También puedes buscar a los hermanos de tu antepasado; a menudo, los registros de un hermano pueden contener información sobre los padres. Otra herramienta útil es el Catálogo de FamilySearch, donde puedes buscar registros que aún no han sido indexados."
    },
    {
        question: "¿Cómo puedo reservar nombres de antepasados para llevar al templo?",
        answer: "Una vez que encuentres a un antepasado nacido hace más de 110 años que necesite las ordenanzas del templo (lo verás indicado con un ícono de templo verde), puedes solicitar esas ordenanzas. Ve a la página de la persona, haz clic en la pestaña 'Ordenanzas' y sigue los pasos para solicitar y agregar los nombres a tu lista del templo para imprimirlos."
    },
    {
        question: "¿Qué significa 'adjuntar una fuente'?",
        answer: "Adjuntar una fuente significa vincular un registro histórico (como un censo o un acta de nacimiento) a un perfil en tu Árbol Familiar. Esto sirve como prueba de la información (fechas, lugares, relaciones familiares) y ayuda a otros a verificar la exactitud de los datos. Siempre es una buena práctica adjuntar la fuente cada vez que agregas o modificas información."
    }
];

const trainingSchema = z.object({
  familyName: z.string().min(2, 'El nombre de la familia es requerido.'),
  memberId: z.string().optional(),
  memberName: z.string().optional(),
});
const taskSchema = z.object({
  task: z.string().min(5, 'La descripción de la tarea es requerida.'),
});
const annotationSchema = z.object({
  note: z.string().min(5, 'La nota es requerida.'),
});


export default function FamilySearchPage() {
    const { user, loading: authLoading } = useAuth();
    const { t } = useI18n();
    const [trainings, setTrainings] = useState<FamilySearchTraining[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Local translations for FamilySearch
    const translations = {
        title: "Coordinación de FamilySearch",
        description: "Organiza y da seguimiento al trabajo de historia familiar en el quórum.",
        familiesToTrain: "Familias por Capacitar",
        familiesToTrainDescription: "Lista de familias para enseñar sobre FamilySearch.",
        addFamily: "Familia",
        noFamilies: "No hay familias registradas.",
        trainingDeleted: "Capacitación eliminada.",
        generalNotes: "Anotaciones Generales",
        generalNotesDescription: "Notas y recordatorios sobre la obra de historia familiar.",
        addNote: "Anotación",
        noNotes: "No hay anotaciones.",
        noteDeleted: "Anotación eliminada.",
        faq: "Preguntas Frecuentes",
        faqDescription: "Respuestas rápidas a las dudas más comunes sobre FamilySearch.",
        linkedTo: "Vinculado a:",
        saving: "Guardando...",
        save: "Guardar"
    };

    // State for dialogs and forms
    const [isTrainingOpen, setTrainingOpen] = useState(false);
    const [isTaskOpen, setTaskOpen] = useState(false);
    const [loadingAnnotations, setLoadingAnnotations] = useState(true);
    const trainingFormRef = useRef<HTMLFormElement>(null);
    const taskFormRef = useRef<HTMLFormElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const trainingsSnap = await getDocs(query(familySearchTrainingsCollection, orderBy('createdAt', 'desc')));
        setTrainings(trainingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilySearchTraining)));
        setLoading(false);
    }, []);

    const fetchAnnotations = useCallback(async () => {
        setLoadingAnnotations(true);
        try {
            const q = query(
                annotationsCollection,
                where('source', '==', 'family-search'),
                where('isResolved', '==', false),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Annotation));
            setAnnotations(data);
        } catch (error) {
            console.error('Error fetching family-search annotations:', error);
            setAnnotations([]);
        } finally {
            setLoadingAnnotations(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading || !user) return;
        fetchData();
        fetchAnnotations();
    }, [authLoading, user, fetchData, fetchAnnotations]);

    const handleAddTraining = (data: { familyName: string; memberId?: string; memberName?: string }) => {
        const validated = trainingSchema.safeParse(data);

        if (!validated.success) {
            toast({ title: 'Error de Validación', description: validated.error.errors[0].message, variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const trainingData: any = {
                    familyName: data.familyName,
                    createdAt: serverTimestamp()
                };

                // Add member reference if selected from existing members
                if (data.memberId && data.memberName) {
                    trainingData.memberId = data.memberId;
                    trainingData.memberName = data.memberName;
                }

                await addDoc(familySearchTrainingsCollection, trainingData);
                toast({ title: 'Éxito', description: 'Familia agregada para capacitación.' });
                setTrainingOpen(false);
                fetchData();
            } catch (error) {
                logger.error({ error, message: 'Error adding family training' });
                toast({ title: 'Error', description: 'No se pudo agregar la familia.', variant: 'destructive' });
            }
        });
    }

    const handleAddTask = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const task = formData.get('task') as string;
        const validated = taskSchema.safeParse({ task });

        if (!validated.success) {
            toast({ title: 'Error de Validación', description: validated.error.errors[0].message, variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                await addDoc(familySearchTasksCollection, { task, createdAt: serverTimestamp() });
                toast({ title: 'Éxito', description: 'Tarea agregada.' });
                setTaskOpen(false);
                taskFormRef.current?.reset();
                fetchData();
            } catch (error) {
                logger.error({ error, message: 'Error adding task' });
                toast({ title: 'Error', description: 'No se pudo agregar la tarea.', variant: 'destructive' });
            }
        });
    }

    const handleDeleteAnnotation = async (id: string) => {
        try {
            await deleteDocFirestore(doc(annotationsCollection, id));
            toast({ title: 'Éxito', description: 'Anotación eliminada.' });
            fetchAnnotations();
        } catch (error) {
            logger.error({ error, message: 'Error deleting annotation' });
            toast({ title: 'Error', description: 'No se pudo eliminar la anotación.', variant: 'destructive' });
        }
    };

    const handleDelete = (id: string, type: 'training' | 'task') => {
        startTransition(async () => {
            try {
                let docRef;
                let successMessage = '';

                if (type === 'training') {
                    docRef = doc(familySearchTrainingsCollection, id);
                    successMessage = 'Capacitación eliminada.';
                } else {
                    docRef = doc(familySearchTasksCollection, id);
                    successMessage = 'Tarea eliminada.';
                }

                await deleteDoc(docRef);
                toast({ title: 'Éxito', description: successMessage });
                fetchData();

            } catch (error) {
                 const errorMessage = (error as Error).message;
                 logger.error({ error: errorMessage, message: `Error deleting ${type}` });
                 toast({ 
                    title: 'Error', 
                    description: `No se pudo eliminar el elemento: ${errorMessage}`, 
                    variant: 'destructive' 
                });
            }
        });
    };


  return (
    <div className="space-y-6">
       <div className="flex items-center gap-3">
            <Library className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-3xl font-bold">{translations.title}</h1>
                <p className="text-muted-foreground">
                    {translations.description}
                </p>
            </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-1">
            {/* Familias por Capacitar */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <BookUser className="h-6 w-6 text-primary" />
                           <div>
                                <CardTitle>{translations.familiesToTrain}</CardTitle>
                                <CardDescription>{translations.familiesToTrainDescription}</CardDescription>
                           </div>
                        </div>
                        <Dialog open={isTrainingOpen} onOpenChange={setTrainingOpen}>
                            <DialogTrigger asChild><Button size="sm"><PlusCircle className="mr-2"/> Familia</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Agregar Familia para Capacitación</DialogTitle>
                                    <DialogDescription>
                                        Puedes seleccionar un miembro existente o agregar una familia manualmente.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <FamilySelector 
                                        onFamilySelect={handleAddTraining}
                                        disabled={isPending}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-24 w-full" /> : trainings.length === 0 ? <p className="text-sm text-center py-4 text-muted-foreground">No hay familias registradas.</p> : (
                        <ul className="space-y-3">{trainings.map(item => (
                            <li key={item.id} className="flex items-center justify-between text-sm border-b pb-2">
                                <div className="flex-1">
                                    <p className="font-medium">{item.familyName}</p>
                                    {item.memberName && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            Vinculado a: {item.memberName}
                                        </p>
                                    )}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, 'training')} disabled={isPending}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </li>
                        ))}</ul>
                    )}
                </CardContent>
            </Card>


             {/* Anotaciones */}
            <VoiceAnnotations 
                title="Anotaciones de FamilySearch"
                description="Notas y recordatorios sobre la obra de historia familiar con reconocimiento de voz."
                source="family-search"
                annotations={annotations}
                isLoading={loadingAnnotations}
                onAnnotationAdded={fetchAnnotations}
                onAnnotationToggled={fetchAnnotations}
                onDeleteAnnotation={handleDeleteAnnotation}
            />
            
            {/* FAQ */}
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Preguntas Frecuentes</CardTitle>
                     <CardDescription>Respuestas rápidas a las dudas más comunes sobre FamilySearch.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {faqData.map((faq, index) => (
                             <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger>{faq.question}</AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </div>


    </div>
  );
}
