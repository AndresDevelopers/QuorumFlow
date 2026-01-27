
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { usersCollection } from '@/lib/collections';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UserProfileData {
    birthDate?: Timestamp;
    memberId?: string | null;
}

export default function ProfilePage() {
    const { t } = useI18n();
    const { user, loading: authLoading } = useAuth();
    const [profileData, setProfileData] = useState<UserProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) return;
            setLoadingProfile(true);
            try {
                const userDocRef = doc(usersCollection, user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setProfileData(userDoc.data() as UserProfileData);
                }
            } catch (error) {
                console.error("Error fetching user profile data:", error);
            } finally {
                setLoadingProfile(false);
            }
        };

        if (user) {
            fetchUserData();
        }
    }, [user]);
    
    const loading = authLoading || loadingProfile;

  return (
    <section className="page-section">
       <div className="flex flex-col gap-2">
        <h1 className="text-balance text-fluid-title font-semibold">{t('Profile')}</h1>
        <p className="text-balance text-fluid-subtitle text-muted-foreground">
          {t('View and manage your profile information.')}
        </p>
      </div>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center text-center">
            {loading ? (
                <Skeleton className="h-24 w-24 rounded-full mb-4" />
            ) : (
                <Avatar className="h-24 w-24 mb-4">
                    {user?.photoURL ? (
                        <Image
                            src={user.photoURL}
                            alt={user.displayName ?? "User Avatar"}
                            width={100}
                            height={100}
                            className="rounded-full"
                            data-ai-hint="profile picture"
                        />
                    ) : (
                        <AvatarFallback>{user?.initials}</AvatarFallback>
                    )}
                </Avatar>
            )}
            
            {loading ? (
                <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                </div>
            ) : (
                <>
                    <CardTitle className="text-2xl">{user?.displayName}</CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                    {profileData?.birthDate && (
                        <CardDescription>
                            Nacimiento: {format(profileData.birthDate.toDate(), 'd LLLL yyyy', { locale: es })}
                        </CardDescription>
                    )}
                    {profileData?.memberId && (
                        <CardDescription>
                            Cédula de miembro: {profileData.memberId}
                        </CardDescription>
                    )}
                </>
            )}

        </CardHeader>
        <CardContent>
            {/* Additional profile information could go here */}
        </CardContent>
      </Card>
    </section>
  );
}
