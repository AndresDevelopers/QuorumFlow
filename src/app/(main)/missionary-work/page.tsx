
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type {
  MissionaryAssignment,
  Investigator,
  NewConvertFriendship,
  Convert,
  Member,
} from '@/lib/types';
import { getMembersForSelector } from '@/lib/members-data';
import {
  useEffect,
  useState,
  useTransition,
  useRef,
  useCallback,
} from 'react';
import { getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  HandHeart,
  PlusCircle,
  Link as LinkIcon,
  UserPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import {
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  missionaryAssignmentsCollection,
  investigatorsCollection,
  newConvertFriendsCollection,
  convertsCollection,
} from '@/lib/collections';
import { z } from 'zod';
import logger from '@/lib/logger';
import { useAuth } from '@/contexts/auth-context';
import { subHours, subMonths } from 'date-fns';
import { FriendshipForm } from './FriendshipForm';


const faqData = [
  {
    question: '¿Cuál es el rol del Quórum de Élderes en la obra misional?',
    answer:
      'El Quórum de Élderes, bajo la dirección del obispo, lidera la obra misional en el barrio. Su responsabilidad principal es coordinar los esfuerzos de los miembros para encontrar, enseñar y bautizar a personas interesadas. Esto incluye trabajar de cerca con los misioneros de tiempo completo, organizar actividades misionales y asegurarse de que los nuevos conversos sean integrados y apoyados.',
  },
  {
    question: '¿Cómo trabajamos con los misioneros de tiempo completo?',
    answer:
      'La colaboración es clave. La presidencia del quórum debe reunirse regularmente con los misioneros en las reuniones de correlación misional para coordinar planes. Los miembros del quórum pueden ayudar a los misioneros proveyendo referencias, participando en las lecciones, ofreciendo transporte y abriendo sus hogares para actividades.',
  },
  {
    question:
      '¿Qué significa "asignar amigos" a un nuevo converso y por qué es importante?',
    answer:
      'Asignar amigos (a menudo llamados "compañeros ministrantes" o simplemente amigos del quórum) es crucial para la retención de nuevos miembros. Un nuevo converso necesita apoyo, amistad y guía. Asignar a uno o dos hermanos del quórum para que se hagan amigos del nuevo miembro, lo visiten, lo inviten a actividades y respondan sus preguntas, le ayuda a sentirse parte de la comunidad y a fortalecer su testimonio.',
  },
  {
    question: '¿Qué tipo de asignaciones misionales puede tener el quórum?',
    answer:
      'Las asignaciones pueden ser variadas: acompañar a los misioneros a dar una lección, invitar a un amigo a una actividad de la Iglesia, compartir un mensaje del Evangelio en redes sociales, ayudar a un investigador con una mudanza como acto de servicio, u organizar una noche de hogar abierta a amigos de la Iglesia.',
  },
];

// --- Client-side Data Fetching Functions ---

async function getMissionaryAssignments(): Promise<MissionaryAssignment[]> {
  const q = query(
    missionaryAssignmentsCollection,
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as MissionaryAssignment)
  );
}

async function getInvestigators(): Promise<Investigator[]> {
  const q = query(investigatorsCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const allInvestigators = snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Investigator)
  );

  const twentyFourHoursAgo = subHours(new Date(), 24);

  // Filter out baptized investigators linked more than 24 hours ago
  return allInvestigators.filter(inv => {
    if (inv.status === 'baptized') {
        // If linkedAt exists and is older than 24 hours, filter it out. Otherwise, keep it.
        return inv.linkedAt ? inv.linkedAt.toDate() > twentyFourHoursAgo : true;
    }
    // Always keep active investigators
    return true;
  });
}


async function getNewConvertFriendships(): Promise<NewConvertFriendship[]> {
    const q = query(newConvertFriendsCollection, orderBy('assignedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewConvertFriendship));
}


async function getNewConvertsWithoutFriends(): Promise<Convert[]> {
  const twentyFourMonthsAgo = subMonths(new Date(), 24);
  const convertsSnapshot = await getDocs(
    query(
      convertsCollection,
      where('baptismDate', '>=', Timestamp.fromDate(twentyFourMonthsAgo)),
      orderBy('baptismDate', 'desc')
    )
  );

  return convertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Convert));
}

// --- Components ---

function AssignmentsTab({
  assignments,
  loading,
  onRefresh,
}: {
  assignments: MissionaryAssignment[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ description?: string[] }>({});

  const assignmentSchema = z.object({
    description: z
      .string()
      .min(5, 'La descripción es requerida (mínimo 5 caracteres).'),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const validatedFields = assignmentSchema.safeParse({ description });
    if (!validatedFields.success) {
      setErrors(validatedFields.error.flatten().fieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        await addDoc(missionaryAssignmentsCollection, {
          description: validatedFields.data.description,
          isCompleted: false,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Éxito', description: 'Asignación agregada.' });
        setDialogOpen(false);
        setDescription('');
        onRefresh();
      } catch (error: any) {
        logger.error({ error, message: 'Error adding missionary assignment' });
        toast({
          title: 'Error',
          description: 'No se pudo agregar la asignación.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleToggle = (id: string, status: boolean) => {
    startTransition(async () => {
      try {
        const itemRef = doc(missionaryAssignmentsCollection, id);
        await updateDoc(itemRef, { isCompleted: !status });
        onRefresh();
      } catch (error) {
        logger.error({ error, message: 'Error toggling assignment status' });
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteDoc(doc(missionaryAssignmentsCollection, id));
        toast({ title: 'Éxito', description: 'Asignación eliminada.' });
        onRefresh();
      } catch (error) {
        logger.error({ error, message: 'Error deleting assignment' });
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la asignación.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Asignaciones Misionales</CardTitle>
            <CardDescription>
              Tareas y responsabilidades para apoyar la obra en el barrio.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle className="mr-2" />
                Asignación
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Nueva Asignación</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Acompañar a los misioneros..."
                  />
                  {errors?.description && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.description[0]}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : assignments.length === 0 ? (
          <p className="text-sm text-center py-4 text-muted-foreground">
            No hay asignaciones.
          </p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={item.id}
                    checked={item.isCompleted}
                    onCheckedChange={() => handleToggle(item.id, item.isCompleted)}
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={item.id}
                    className={
                      item.isCompleted
                        ? 'line-through text-muted-foreground'
                        : ''
                    }
                  >
                    {item.description}
                  </Label>
                </div>
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
                        Esta acción eliminará permanentemente la asignación: "{item.description}".
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InvestigatorsTab({
  investigators,
  newConverts,
  loading,
  onRefresh,
}: {
  investigators: Investigator[];
  newConverts: Convert[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isAddOpen, setAddOpen] = useState(false);
  const [isLinkOpen, setLinkOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedInvestigator, setSelectedInvestigator] =
    useState<Investigator | null>(null);

  // States for Add form
  const [name, setName] = useState('');
  const [missionaries, setMissionaries] = useState('');
  const [addErrors, setAddErrors] = useState<{
    name?: string[];
    missionaries?: string[];
  }>({});

  // State for Link form
  const [selectedConvertId, setSelectedConvertId] = useState('');
  const [linkErrors, setLinkErrors] = useState<{ convertId?: string[] }>({});

  const investigatorSchema = z.object({
    name: z.string().min(2, 'El nombre es requerido.'),
    missionaries: z
      .string()
      .min(5, 'El nombre de los misioneros es requerido.'),
  });

  const linkInvestigatorSchema = z.object({
    convertId: z.string().min(1, 'Debe seleccionar un converso.'),
  });

  const handleAddSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddErrors({});
    const validated = investigatorSchema.safeParse({ name, missionaries });
    if (!validated.success) {
      setAddErrors(validated.error.flatten().fieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        await addDoc(investigatorsCollection, {
          name: validated.data.name,
          assignedMissionaries: validated.data.missionaries,
          status: 'active',
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Éxito', description: 'Investigador agregado.' });
        setAddOpen(false);
        setName('');
        setMissionaries('');
        onRefresh();
      } catch (error) {
        logger.error({ error, message: 'Error adding investigator' });
        toast({
          title: 'Error',
          description: 'No se pudo agregar el investigador.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleLinkSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkErrors({});
    if (!selectedInvestigator) return;

    const validated = linkInvestigatorSchema.safeParse({
      convertId: selectedConvertId,
    });
    if (!validated.success) {
      setLinkErrors(validated.error.flatten().fieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        const investigatorRef = doc(
          investigatorsCollection,
          selectedInvestigator.id
        );
        await updateDoc(investigatorRef, {
          status: 'baptized',
          convertId: validated.data.convertId,
          linkedAt: serverTimestamp(),
        });

        const convertRef = doc(convertsCollection, validated.data.convertId);
        await updateDoc(convertRef, {
            missionaryReference: selectedInvestigator.assignedMissionaries,
        });

        toast({
          title: 'Éxito',
          description: 'Investigador vinculado a converso.',
        });
        setLinkOpen(false);
        setSelectedInvestigator(null);
        setSelectedConvertId('');
        onRefresh();
      } catch (error) {
        logger.error({
          error,
          message: 'Error linking investigator to convert',
        });
        toast({
          title: 'Error',
          description: 'No se pudo vincular al investigador.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = (investigator: Investigator) => {
    startTransition(async () => {
        try {
            await deleteDoc(doc(investigatorsCollection, investigator.id));
            toast({ title: 'Éxito', description: 'Investigador eliminado.' });
            onRefresh();
        } catch (error) {
            logger.error({ error, message: 'Error deleting investigator' });
            toast({
                title: 'Error',
                description: 'No se pudo eliminar al investigador.',
                variant: 'destructive',
            });
        }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Investigadores</CardTitle>
            <CardDescription>
              Personas que están aprendiendo sobre el evangelio.
            </CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle className="mr-2" />
                Investigador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddSubmit}>
                <DialogHeader>
                  <DialogTitle>Agregar Investigador</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Familia Pérez"
                    />
                    {addErrors?.name && (
                      <p className="text-sm text-destructive mt-1">
                        {addErrors.name[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="missionaries">Misioneros Asignados</Label>
                    <Input
                      id="missionaries"
                      name="missionaries"
                      value={missionaries}
                      onChange={(e) => setMissionaries(e.target.value)}
                      placeholder="Ej: Elder Smith y Elder Jones"
                    />
                    {addErrors?.missionaries && (
                      <p className="text-sm text-destructive mt-1">
                        {addErrors.missionaries[0]}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : investigators.length === 0 ? (
          <p className="text-sm text-center py-4 text-muted-foreground">
            No hay investigadores activos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Misioneros</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investigators.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.assignedMissionaries}</TableCell>
                  <TableCell>
                    {item.status === 'baptized' ? (
                      <Badge variant="default">Bautizado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className='flex justify-end items-center gap-2'>
                    {item.status === 'active' && (
                      <Dialog
                        open={
                          isLinkOpen && selectedInvestigator?.id === item.id
                        }
                        onOpenChange={(isOpen) => {
                          if (!isOpen) {
                            setSelectedInvestigator(null);
                            setSelectedConvertId('');
                            setLinkErrors({});
                          }
                          setLinkOpen(isOpen);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInvestigator(item);
                              setLinkOpen(true);
                            }}
                          >
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Vincular
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <form onSubmit={handleLinkSubmit}>
                            <DialogHeader>
                              <DialogTitle>
                                Vincular a Nuevo Converso
                              </DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <p>
                                Selecciona el registro del nuevo converso que
                                corresponde a <strong>{item.name}</strong>.
                              </p>
                              <Label htmlFor="convertId">Nuevo Converso</Label>
                              <Select
                                name="convertId"
                                onValueChange={setSelectedConvertId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un converso..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {newConverts.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {linkErrors?.convertId && (
                                <p className="text-sm text-destructive mt-1">
                                  {linkErrors.convertId[0]}
                                </p>
                              )}
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={isPending}>
                                {isPending ? 'Vinculando...' : 'Vincular'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
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
                                Esta acción eliminará permanentemente el registro del investigador <strong>{item.name}</strong>.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleDelete(item)}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Eliminar
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function NewConvertsTab({
  friendships,
  newConverts,
  members,
  loading,
  onRefresh,
}: {
  friendships: NewConvertFriendship[];
  newConverts: Convert[];
  members: Member[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedConvert, setSelectedConvert] = useState<Convert | null>(null);
  const [selectedFriendship, setSelectedFriendship] = useState<NewConvertFriendship | null>(null);

  const handleDelete = (friendshipId: string) => {
    startTransition(async () => {
        try {
            await deleteDoc(doc(newConvertFriendsCollection, friendshipId));
            toast({ title: 'Éxito', description: 'Asignación de amistad eliminada.' });
            onRefresh();
        } catch (error) {
            logger.error({ error, message: 'Error deleting friendship' });
            toast({
                title: 'Error',
                description: 'No se pudo eliminar la asignación de amistad.',
                variant: 'destructive',
            });
        }
    });
  }

  const handleOpenForm = (item: Convert | NewConvertFriendship) => {
    if ('convertName' in item) { // It's a Friendship object
      setSelectedFriendship(item);
      setSelectedConvert(null);
    } else { // It's a Convert object
      setSelectedConvert(item);
      setSelectedFriendship(null);
    }
    setFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedConvert(null);
    setSelectedFriendship(null);
  };

  const handleFormSubmit = () => {
    handleCloseForm();
    onRefresh();
  };


  const getMemberName = (memberId: string) => {
    const m = members.find((mm) => mm.id === memberId);
    return m ? `${m.firstName} ${m.lastName}`.trim() : memberId;
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Amigos para Nuevos Conversos</CardTitle>
        <CardDescription>
          Asigna miembros del quórum para apoyar y fortalecer a los recién
          bautizados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : friendships.length === 0 && newConverts.length === 0 ? (
          <p className="text-sm text-center py-4 text-muted-foreground">
            No hay nuevos conversos para asignar amigos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nuevo Converso</TableHead>
                <TableHead>Amigo(s) del Quórum</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {friendships.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.convertName}
                  </TableCell>
                  <TableCell>{item.friends.map(getMemberName).join(', ')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(item)}>
                            <Pencil className="h-4 w-4" />
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
                                Esta acción eliminará la asignación de amistad para <strong>{item.convertName}</strong>.
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {newConverts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground italic">
                    Pendiente
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenForm(item)}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Asignar Amigo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

    <FriendshipForm
        isOpen={isFormOpen}
        onOpenChange={handleCloseForm}
        onFormSubmit={handleFormSubmit}
        convert={selectedConvert}
        friendship={selectedFriendship}
    />
    </>
  );
}

export default function MissionaryWorkPage() {
  const [assignments, setAssignments] = useState<MissionaryAssignment[]>([]);
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [friendships, setFriendships] = useState<NewConvertFriendship[]>([]);
  const [newConvertsWithoutFriends, setNewConvertsWithoutFriends] = useState<
    Convert[]
  >([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        assignmentsData,
        investigatorsData,
        friendshipsData,
        newConvertsData,
        membersData,
      ] = await Promise.all([
        getMissionaryAssignments(),
        getInvestigators(),
        getNewConvertFriendships(),
        getNewConvertsWithoutFriends(),
        getMembersForSelector(true),
      ]);
      setAssignments(assignmentsData);
      setInvestigators(investigatorsData);
      setFriendships(friendshipsData);
      setNewConvertsWithoutFriends(newConvertsData);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to fetch missionary work data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return; // Wait for authentication
    fetchData();
  }, [authLoading, user, fetchData]);

  const availableNewConverts = newConvertsWithoutFriends.filter(
    (c) => !investigators.some((i) => i.convertId === c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HandHeart className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Obra Misional</h1>
          <p className="text-muted-foreground">
            Coordina y da seguimiento a los esfuerzos misionales del quórum.
          </p>
        </div>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-10">
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          <TabsTrigger value="investigators">Investigadores</TabsTrigger>
          <TabsTrigger value="new_converts">Nuevos Conversos</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments">
          <AssignmentsTab
            assignments={assignments}
            loading={loading}
            onRefresh={fetchData}
          />
        </TabsContent>
        <TabsContent value="investigators">
          <InvestigatorsTab
            investigators={investigators}
            newConverts={availableNewConverts}
            loading={loading}
            onRefresh={fetchData}
          />
        </TabsContent>
        <TabsContent value="new_converts">
          <NewConvertsTab
            friendships={friendships}
            newConverts={newConvertsWithoutFriends.filter(
              (c) => !friendships.some((f) => f.convertId === c.id)
            )}
            members={members}
            loading={loading}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Preguntas Frecuentes</CardTitle>
          <CardDescription>
            Respuestas a dudas comunes sobre el rol del quórum en la obra
            misional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem value={`item-${index}`} key={index}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
