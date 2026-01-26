'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { activitiesCollection } from '@/lib/collections';
import type { Activity } from '@/lib/types';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { Camera, FileText, Pencil, PlusCircle } from 'lucide-react';
import { endOfYear, format, getYear, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import logger from '@/lib/logger';

async function getAvailableActivityYears(): Promise<number[]> {
  const snapshot = await getDocs(query(activitiesCollection, orderBy('date', 'desc')));
  const yearSet = new Set<number>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as { date?: Timestamp };
    if (data.date) yearSet.add(getYear(data.date.toDate()));
  });

  yearSet.add(getYear(new Date()));

  return Array.from(yearSet).sort((a, b) => b - a);
}

async function getActivitiesForYear(year: number): Promise<Activity[]> {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 0, 1));

  const startTimestamp = Timestamp.fromDate(start);
  const endTimestamp = Timestamp.fromDate(end);

  const activityQuery = query(
    activitiesCollection,
    where('date', '>=', startTimestamp),
    where('date', '<=', endTimestamp),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(activityQuery);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Activity));
}

export default function ActivitiesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[] | null>(null);
  const currentYear = getYear(new Date());
  const yearParam = Number(searchParams.get('year'));
  const selectedYear = Number.isInteger(yearParam) && yearParam >= 1900 && yearParam <= 2100 ? yearParam : currentYear;
  const yearOptions = (availableYears && availableYears.length > 0)
    ? availableYears.map(String)
    : [String(selectedYear)];

  const handleYearChange = (year: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', year);
    router.replace(`/reports/activities?${params.toString()}`);
  };

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getActivitiesForYear(selectedYear);
      setActivities(data);
    } catch (error) {
      logger.error({ error, message: 'Error loading activities for year', year: selectedYear });
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchActivities();
  }, [authLoading, user, fetchActivities]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const years = await getAvailableActivityYears();
        if (cancelled) return;
        setAvailableYears(years);

        if (years.length > 0 && !years.includes(selectedYear)) {
          const params = new URLSearchParams(searchParams.toString());
          params.set('year', String(years[0]));
          router.replace(`/reports/activities?${params.toString()}`);
        }
      } catch (error) {
        if (cancelled) return;
        logger.error({ error, message: 'Error loading available activity years' });
        setAvailableYears([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, searchParams, selectedYear]);

  return (
    <section className="page-section space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-fluid-title font-semibold">
          {t('activities.pageTitle')}
        </h1>
        <p className="text-balance text-fluid-subtitle text-muted-foreground">
          {t('activities.pageDescription')}
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Actividades Registradas</CardTitle>
                <CardDescription>
                  Registro de las actividades del año {selectedYear}.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <Select
                  value={String(selectedYear)}
                  onValueChange={handleYearChange}
                  disabled={availableYears === null}
                >
                  <SelectTrigger aria-label="Filtrar por año">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button asChild>
                <Link href="/reports/add">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Actividad
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                                        <Image
                                          src={url}
                                          alt={`Imagen ${index + 1} de ${item.title}`}
                                          width={800}
                                          height={600}
                                          className="w-full h-auto object-contain rounded-md"
                                          data-ai-hint="activity photo"
                                        />
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
                        {item.additionalText && (
                          <p className="text-xs text-muted-foreground truncate">
                            Texto adicional: {item.additionalText}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.imageUrls && item.imageUrls.length > 0 && (
                          <Camera className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                        )}
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
                      {item.imageUrls && item.imageUrls.length > 0 && (
                        <Camera className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                      )}
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/reports/${item.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      {item.additionalText && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
                          Adicional: {item.additionalText}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
