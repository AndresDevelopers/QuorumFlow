
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { getDocs, query, orderBy, deleteDoc, doc, writeBatch, getDoc, setDoc, collection } from 'firebase/firestore';
import { ministeringCollection, ministeringHistoryCollection } from '@/lib/collections';
import type { Companionship } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';

import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, History, Settings, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { isSameMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

function getCompanionshipCompletion(companionship: Companionship): number {
    const totalFamilies = companionship.families.length;
    if (totalFamilies === 0) return 100;
    const visitedFamilies = companionship.families.filter(f => f.visitedThisMonth).length;
    return Math.round((visitedFamilies / totalFamilies) * 100);
}

async function getCompanionships(): Promise<Companionship[]> {
  const q = query(ministeringCollection, orderBy('companions'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Companionship)
  );
}

function StatusBadge({ companionship }: { companionship: Companionship }) {
    const isAnyFamilyUrgent = companionship.families.some(f => f.isUrgent);
    
    if (isAnyFamilyUrgent) {
      return <Badge variant="destructive">Urgente</Badge>;
    }
    
    const completion = getCompanionshipCompletion(companionship);
    
    if (completion === 100) {
        return <Badge variant="default">Al día</Badge>;
    }
    
    return <Badge variant="secondary">Pendiente</Badge>;
}

function StatCard({ title, value, previousValue, icon }: { title: string, value: string, previousValue?: string, icon: React.ReactNode }) {
    const currentValue = parseFloat(value);
    const prevValue = previousValue ? parseFloat(previousValue) : null;
    let diff: number | null = null;
    if (prevValue !== null) {
        diff = currentValue - prevValue;
    }

    const DiffIcon = diff === null ? null : diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
    const diffColor = diff === null ? '' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground';

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}%</div>
                {previousValue !== undefined && (
                    <p className="text-xs text-muted-foreground flex items-center">
                        {diff !== null && DiffIcon && <DiffIcon className={`h-4 w-4 mr-1 ${diffColor}`} />}
                        {diff !== null ? `${Math.abs(diff).toFixed(0)}%` : ''}
                        {` vs. ${previousValue}% el mes pasado`}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

export default function MinisteringPage() {
  const [companionships, setCompanionships] = useState<Companionship[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isResetting, startResetting] = useTransition();

  const [overallCompletion, setOverallCompletion] = useState(0);
  const [lastMonthCompletion, setLastMonthCompletion] = useState<number | null>(null);

  const calculateOverallCompletion = (comps: Companionship[]) => {
      const totalFamilies = comps.reduce((acc, comp) => acc + comp.families.length, 0);
      const totalVisited = comps.reduce((acc, comp) => acc + comp.families.filter(f => f.visitedThisMonth).length, 0);
      return totalFamilies > 0 ? Math.round((totalVisited / totalFamilies) * 100) : 0;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        let comps = await getCompanionships();
        const now = new Date();
        
        // --- Monthly Reset and History Logic ---
        const lastResetStr = localStorage.getItem('ministeringLastReset');
        const lastReset = lastResetStr ? new Date(lastResetStr) : new Date(0);

        if (!isSameMonth(now, lastReset)) {
            startResetting(async () => {
                const previousMonthCompletion = calculateOverallCompletion(comps);
                const prevMonthId = format(subMonths(now, 1), 'yyyy-MM');

                // Save previous month's data
                await setDoc(doc(ministeringHistoryCollection, prevMonthId), {
                    percentage: previousMonthCompletion,
                    year: format(subMonths(now, 1), 'yyyy'),
                    month: format(subMonths(now, 1), 'MM'),
                });

                // Reset current month's data
                const batch = writeBatch(doc(ministeringCollection).firestore);
                comps.forEach(comp => {
                    const updatedFamilies = comp.families.map(f => ({ ...f, visitedThisMonth: false }));
                    const compRef = doc(ministeringCollection, comp.id);
                    batch.update(compRef, { families: updatedFamilies });
                });
                await batch.commit();

                localStorage.setItem('ministeringLastReset', now.toISOString());
                
                // Re-fetch data after reset
                comps = await getCompanionships(); 
                
                toast({ title: "Nuevo Mes", description: "El seguimiento de la ministración se ha reiniciado." });
            });
        }
        
        setCompanionships(comps);
        setOverallCompletion(calculateOverallCompletion(comps));
        
        // Fetch last month's data for comparison
        const lastMonthId = format(subMonths(now, 1), 'yyyy-MM');
        const historyDoc = await getDoc(doc(ministeringHistoryCollection, lastMonthId));
        if (historyDoc.exists()) {
            setLastMonthCompletion(historyDoc.data().percentage);
        } else {
            setLastMonthCompletion(0); // Default to 0 if no history
        }

    } catch (error) {
      logger.error({error}, "Failed to fetch companionships or process reset");
      toast({ title: "Error", description: "No se pudieron cargar los datos de ministración.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [authLoading, user, loadData]);

  return (
    <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
            {loading ? <Skeleton className="h-28 w-full" /> : (
                <StatCard 
                    title="Ministración este Mes"
                    value={overallCompletion.toFixed(0)}
                    previousValue={lastMonthCompletion?.toFixed(0)}
                    icon={<History className="h-4 w-4 text-muted-foreground" />}
                />
            )}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Compañerismos</CardTitle>
                    <CardDescription>
                        Gestiona los compañerismos, su estado y registra actividades.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end">
                     <Button asChild>
                      <Link href="/ministering/add">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Compañerismo
                      </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Detalle de Compañerismos</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop View: Table */}
            <div className="hidden md:block">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Compañeros</TableHead>
                    <TableHead>Familias Asignadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[150px]">Progreso</TableHead>
                    <TableHead className="text-right">
                        Acciones
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading || isResetting ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                 <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                            </TableRow>
                        ))
                    ) : companionships.map((item) => (
                    <TableRow key={item.id} className={item.families.some(f => f.isUrgent) ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-medium">
                          {item.companions.map((c, i) => (
                            <div key={i}>
                              <span>{c}</span>
                              {i < item.companions.length - 1 && <hr className="my-1" />}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {item.families.map((f, i) => (
                            <div key={i}>
                              <span>{f.name}</span>
                              {i < item.families.length - 1 && <hr className="my-1" />}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge companionship={item} />
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                                <Progress value={getCompanionshipCompletion(item)} className="h-2" />
                                <span className="text-xs text-muted-foreground">{getCompanionshipCompletion(item)}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/ministering/${item.id}`}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Gestionar
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
                {loading || isResetting ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
                ) : companionships.map((item) => (
                     <Card key={item.id} className={item.families.some(f => f.isUrgent) ? 'border-destructive' : ''}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">
                                      {item.companions.map((c, i) => (
                                        <div key={i}>
                                          <span>{c}</span>
                                          {i < item.companions.length - 1 && <hr className="my-1" />}
                                        </div>
                                      ))}
                                    </CardTitle>
                                    <CardDescription>
                                        <div className="flex items-center gap-2 mt-1">
                                            <StatusBadge companionship={item} />
                                        </div>
                                    </CardDescription>
                                </div>
                               <Button variant="outline" size="sm" asChild>
                                    <Link href={`/ministering/${item.id}`}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Gestionar
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           <div>
                               <p className="font-semibold text-muted-foreground">Familias Asignadas</p>
                               {item.families.map((f, i) => (
                                <div key={i}>
                                  <p>{f.name}</p>
                                  {i < item.families.length - 1 && <hr className="my-1" />}
                                </div>
                              ))}
                           </div>
                           <div>
                               <p className="font-semibold text-muted-foreground">Progreso</p>
                               <div className="flex items-center gap-2">
                                    <Progress value={getCompanionshipCompletion(item)} className="h-2" />
                                    <span className="text-xs text-muted-foreground">{getCompanionshipCompletion(item)}%</span>
                                </div>
                           </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!loading && companionships.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    No hay compañerismos registrados.
                </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
