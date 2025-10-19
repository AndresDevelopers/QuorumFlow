'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Calendar, MapPin, Users, FileText, Camera } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import type { Member } from '@/lib/types';
import { OrdinanceLabels } from '@/lib/types';
import { getMemberById } from '@/lib/members-data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig = {
  active: {
    label: 'Activo',
    variant: 'default' as const,
    color: 'text-green-600'
  },
  less_active: {
    label: 'Menos Activo',
    variant: 'secondary' as const,
    color: 'text-yellow-600'
  },
  inactive: {
    label: 'Inactivo',
    variant: 'destructive' as const,
    color: 'text-red-600'
  }
};

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberId = params.id as string;

  useEffect(() => {
    const fetchMember = async () => {
      if (!memberId || !user) return;

      setLoading(true);
      setError(null);

      try {
        const memberData = await getMemberById(memberId);
        if (memberData) {
          setMember(memberData);
        } else {
          setError(t('memberProfile.notFound'));
        }
      } catch (err) {
        console.error('Error fetching member:', err);
        setError(t('memberProfile.error'));
        toast({
          title: 'Error',
          description: t('memberProfile.error'),
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMember();
  }, [memberId, user, t, toast]);

  const handleBackToMembers = () => {
    router.push('/members');
  };

  const handleEditMember = () => {
    router.push(`/members?edit=${memberId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBackToMembers}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('memberProfile.backToMembers')}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">{error || t('memberProfile.notFound')}</h3>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = statusConfig[member.status];

  return (
    <section className="page-section">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToMembers}
          className="w-full sm:w-auto sm:self-start"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('memberProfile.backToMembers')}
        </Button>
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-balance text-fluid-title font-semibold tracking-tight">{t('memberProfile.title')}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {member.firstName} {member.lastName}
          </p>
        </div>
      </div>

      {/* Profile Photo and Basic Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-shrink-0">
              {member.photoURL ? (
                <img
                  src={member.photoURL}
                  alt={`${member.firstName} ${member.lastName}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-background"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-background">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">{member.firstName} {member.lastName}</h2>
                <Badge variant={statusInfo.variant} className="mt-2">
                  {statusInfo.label}
                </Badge>
              </div>

              {member.phoneNumber && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{member.phoneNumber}</span>
                </div>
              )}

              {member.birthDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(member.birthDate.toDate(), 'd MMMM yyyy', { locale: es })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('memberProfile.personalInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('memberProfile.firstName')}
              </label>
              <p className="text-sm">{member.firstName}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('memberProfile.lastName')}
              </label>
              <p className="text-sm">{member.lastName}</p>
            </div>

            {member.birthDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('memberProfile.birthDate')}
                </label>
                <p className="text-sm">
                  {format(member.birthDate.toDate(), 'd MMMM yyyy', { locale: es })}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('memberProfile.status')}
              </label>
              <div className="mt-1">
                <Badge variant={statusInfo.variant}>
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {t('memberProfile.contactInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('memberProfile.phoneNumber')}
              </label>
              <p className="text-sm">
                {member.phoneNumber || t('memberProfile.noPhone')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Church Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('memberProfile.churchInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {member.baptismDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('memberProfile.baptismDate')}
                </label>
                <p className="text-sm">
                  {format(member.baptismDate.toDate(), 'd MMMM yyyy', { locale: es })}
                </p>
              </div>
            )}

            {member.baptismPhotos && member.baptismPhotos.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('memberProfile.baptismPhotos')}
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {member.baptismPhotos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`Bautismo ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ordinances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('memberProfile.ordinances')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.ordinances && member.ordinances.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.ordinances.map((ordinance) => (
                  <Badge key={ordinance} variant="outline">
                    {OrdinanceLabels[ordinance]}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('memberProfile.noOrdinances')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ministering */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('memberProfile.ministering')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.ministeringTeachers && member.ministeringTeachers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.ministeringTeachers.map((teacher, index) => (
                  <Badge key={index} variant="secondary">
                    {teacher}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('memberProfile.noMinisteringTeachers')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
