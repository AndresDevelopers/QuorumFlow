"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MainLayout } from "@/components/main-layout";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { doc, getDoc } from "firebase/firestore";
import { usersCollection } from "@/lib/collections";

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCheckingRole(false);
      setRole(null);
      return;
    }

    let isMounted = true;
    const fetchRole = async () => {
      setCheckingRole(true);
      try {
        const userDocRef = doc(usersCollection, user.uid);
        const snapshot = await getDoc(userDocRef);
        if (!isMounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          setRole(typeof data.role === "string" ? data.role : null);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Error fetching user role", error);
        if (isMounted) {
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setCheckingRole(false);
        }
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && !checkingRole && user && (!role || role === 'user')) {
      router.replace('/no-permission');
    }
  }, [checkingRole, loading, role, router, user]);

  if (loading || checkingRole) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null; // or a loading spinner
  }

  if (!checkingRole && (!role || role === 'user')) {
    return null;
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
      <AuthProvider>
        <PrivateRoute>
          <SidebarProvider>
            <MainLayout>{children}</MainLayout>
          </SidebarProvider>
        </PrivateRoute>
      </AuthProvider>
  );
}
