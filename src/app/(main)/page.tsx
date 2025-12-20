
'use client';

import Link from 'next/link';
import {
  BookUser,
  FileText,
  Gavel,
  HeartHandshake,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { useI18n } from "@/contexts/i18n-context";
import { getDashboardData, getActivityChartData, getMembersByStatus } from "@/lib/dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { VoiceAnnotations } from "@/components/shared/voice-annotations";
import type { Annotation } from "@/lib/types";
import {
  addDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { annotationsCollection } from "@/lib/collections";
import logger from "@/lib/logger";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";


function StatCardSkeleton() {
  return (
     <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-[50px] mb-2" />
        <Skeleton className="h-3 w-[150px]" />
      </CardContent>
    </Card>
  )
}

// Moved from server actions to be called on the client
async function getAnnotations(source: 'dashboard'): Promise<Annotation[]> {
    try {
        const q = query(
            annotationsCollection,
            where('source', '==', source),
            where('isResolved', '==', false),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Annotation));

        return data;

    } catch (error: any) {
        let errorMessage = "Error fetching annotations.";
        if (error.code === 'failed-precondition') {
            errorMessage = "Query failed. It's likely you're missing a composite index in Firestore. Please check the browser's console for a link to create it.";
        }
        logger.error({ error, message: errorMessage, source });
        console.error(errorMessage, error);
        return [];
    }
}


function DashboardPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [membersData, setMembersData] = useState<any>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return; // Wait for authentication

    async function loadData() {
      setLoading(true);
      const dashboardData = await getDashboardData();
      setData(dashboardData);
      setLoading(false);
    }
    loadData();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return; // Wait for authentication

    async function loadChartData() {
        setLoadingChart(true);
        const data = await getActivityChartData();
        setChartData(data);
        setLoadingChart(false);
    }
    queueMicrotask(() => {
      void loadChartData();
    });
  }, [authLoading, user])

  useEffect(() => {
    if (authLoading || !user) return; // Wait for authentication

    async function loadMembersData() {
        setLoadingMembers(true);
        const data = await getMembersByStatus();
        setMembersData(data);
        setLoadingMembers(false);
    }
    queueMicrotask(() => {
      void loadMembersData();
    });
  }, [authLoading, user])

  const fetchAnnotations = async () => {
    if (authLoading || !user) return; // Wait for authentication
    setLoadingAnnotations(true);
    const result = await getAnnotations('dashboard');
    setAnnotations(result);
    setLoadingAnnotations(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAnnotations();
    });
  }, [authLoading, user])

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await deleteDoc(doc(annotationsCollection, id));
      toast({ title: 'Anotación Eliminada', description: 'La anotación ha sido eliminada permanentemente.' });
      fetchAnnotations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, message: 'Error deleting annotation', id });
      toast({ title: 'Error al Eliminar', description: `Failed to delete annotation: ${errorMessage}`, variant: 'destructive' });
    }
  }

  const {
    convertsCount,
    futureMembersCount,
    ministeringReportRate,
    councilActionsCount,
  } = data || { convertsCount: 0, futureMembersCount: 0, ministeringReportRate: 0, councilActionsCount: 0 };


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? <StatCardSkeleton/> : <Link href="/converts">
          <StatCard
            title={t("Total Converts")}
            value={String(convertsCount)}
            icon={<HeartHandshake className="h-4 w-4 text-muted-foreground" />}
            description={t("in the last 18 months")}
          />
        </Link>}
         {loading ? <StatCardSkeleton/> : <Link href="/future-members">
          <StatCard
            title={t("Future Members")}
            value={String(futureMembersCount)}
            icon={<BookUser className="h-4 w-4 text-muted-foreground" />}
            description={t("with baptism date set")}
          />
        </Link>}
         {loading ? <StatCardSkeleton/> : <Link href="/reports">
          <StatCard
            title={t("Reports Submitted")}
            value={`${ministeringReportRate}%`}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            description={t("of ministering visits completed")}
          />
        </Link>}
         {loading ? <StatCardSkeleton/> : <Link href="/council">
          <StatCard
            title={t("Council Actions")}
            value={String(councilActionsCount)}
            icon={<Gavel className="h-4 w-4 text-muted-foreground" />}
            description={t("Active action items")}
          />
        </Link>}
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
        <Link href="/reports">
          <Card>
            <CardHeader>
              <CardTitle>{t("Activity Overview")}</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <OverviewChart data={chartData} loading={loadingChart} />
            </CardContent>
          </Card>
        </Link>

        <Link href="/members">
          <Card>
            <CardHeader>
              <CardTitle>{t("Members by Status")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                  </div>
                </div>
              ) : membersData ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-600">{t("Active Members")}</span>
                    <span className="text-sm font-bold">{membersData.active.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-yellow-600">{t("Less Active Members")}</span>
                    <span className="text-sm font-bold">{membersData.lessActive.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-red-600">{t("Inactive Members")}</span>
                    <span className="text-sm font-bold">{membersData.inactive.length}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">{t("Total Members")}</span>
                    <span className="text-sm font-bold">{membersData.total}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("No member data available")}</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

       <div className="grid gap-4">
          <VoiceAnnotations
              title="Anotaciones del Quórum"
              description="Añade notas rápidas o recordatorios para el quórum. Marca las que necesiten seguimiento en el consejo."
              source="dashboard"
              annotations={annotations}
              isLoading={loadingAnnotations}
              onAnnotationAdded={fetchAnnotations}
              onAnnotationToggled={fetchAnnotations}
              onDeleteAnnotation={handleDeleteAnnotation}
              currentUserId={user?.uid}
           />
      </div>
    </div>
  );
}

export default function DashboardContainer() {
  return <DashboardPage />;
}
