
'use client';

import { useTheme } from 'next-themes';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/contexts/i18n-context';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/contexts/auth-context';
import { deleteUser, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import logger from '@/lib/logger';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, getDoc, updateDoc, Timestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { usersCollection, pushSubscriptionsCollection, storage } from '@/lib/collections';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, CalendarIcon, User, Camera, Loader2, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import RoleManagement from '@/components/role-management';
import {
  canManageSettings,
  canViewSettings,
  normalizeRole,
  type UserRole,
} from '@/lib/roles';
import { navigationItems } from '@/lib/navigation';

const profileSchema = z.object({
  name: z.string().min(2, { message: "El nombre es requerido." }),
  birthDate: z.date({
    required_error: "La fecha de nacimiento es requerida.",
  }),
  memberId: z.string().trim().optional(),
});

type FormValues = z.infer<typeof profileSchema>;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const { user, firebaseUser, refreshAuth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMainPageSaving, setIsMainPageSaving] = useState(false);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [isSubscriptionLoading, setSubscriptionLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [hasSettingsAccess, setHasSettingsAccess] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [mainPage, setMainPage] = useState<string>('/');
  const [visiblePages, setVisiblePages] = useState<string[]>([]);
  const roleFriendlyNames = useMemo<Record<UserRole, string>>(
    () => ({
      user: 'Miembro',
      counselor: 'Consejero',
      president: 'Presidente',
      secretary: 'Secretario',
      other: 'Otro',
    }),
    []
  );


  useEffect(() => {
    if (!hasSettingsAccess) {
      setSubscriptionLoading(false);
      setIsSupported(false);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true);
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.pushManager
            .getSubscription()
            .then((sub) => {
              if (sub) {
                setIsSubscribed(true);
              }
              setSubscriptionLoading(false);
            })
            .catch(() => setSubscriptionLoading(false));
        })
        .catch(() => setSubscriptionLoading(false));
    } else {
      setSubscriptionLoading(false);
      setIsSupported(false);
    }
  }, [hasSettingsAccess]);

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      memberId: '',
    },
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!firebaseUser) {
        setIsCheckingRole(false);
        setHasSettingsAccess(false);
        setCanManageRoles(false);
        return;
      }

      setIsProfileLoading(true);
      setIsCheckingRole(true);

      try {
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        let normalizedRole: UserRole = 'user';

        if (userDoc.exists()) {
          const userData = userDoc.data();
          normalizedRole = normalizeRole(userData.role);
          const userVisiblePages = Array.isArray(userData.visiblePages) ? userData.visiblePages : navigationItems.map(item => item.href);
          setVisiblePages(userVisiblePages);
          
          // If current main page is not in visible pages, select first visible page
          const currentMainPage = userData.mainPage || '/';
          if (!userVisiblePages.includes(currentMainPage) && userVisiblePages.length > 0) {
            setMainPage(userVisiblePages[0]);
          } else {
            setMainPage(currentMainPage);
          }
          
          form.reset({
            name: userData.name || firebaseUser.displayName || '',
            birthDate: userData.birthDate
              ? (userData.birthDate as Timestamp).toDate()
              : undefined,
            memberId: userData.memberId || '',
          });
        } else {
          form.reset({
            name: firebaseUser.displayName || '',
            memberId: '',
          });
        }

        setPreviewUrl(firebaseUser.photoURL || null);
        setUserRole(normalizedRole);

        const canView = canViewSettings(normalizedRole);
        setHasSettingsAccess(canView);
        setCanManageRoles(canManageSettings(normalizedRole));

        if (!canView) {
          return;
        }
      } catch (error) {
        logger.error({ error, message: 'Error loading settings profile data' });
        setHasSettingsAccess(false);
        setCanManageRoles(false);
        toast({
          title: t('settings.toast.profileLoadErrorTitle'),
          description: t('settings.toast.profileLoadErrorDescription'),
          variant: 'destructive',
        });
      } finally {
        setIsCheckingRole(false);
        setIsProfileLoading(false);
      }
    };

    fetchUserData();
  }, [firebaseUser, form, toast]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t('settings.toast.fileTooLargeTitle'),
        description: t('settings.toast.fileTooLargeDescription'),
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  
  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const onProfileSubmit = async (values: FormValues) => {
    if (!firebaseUser) return;
    setIsSubmitting(true);
    let finalPhotoURL = firebaseUser.photoURL || null;

    try {
        if (selectedFile) {
            const storageRef = ref(storage, `profile_pictures/users/${firebaseUser.uid}/${Date.now()}_${selectedFile.name}`);
            await uploadBytes(storageRef, selectedFile);
            finalPhotoURL = await getDownloadURL(storageRef);

            if (firebaseUser.photoURL && firebaseUser.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
                const oldImageRef = ref(storage, firebaseUser.photoURL);
                await deleteObject(oldImageRef).catch(err => logger.warn({ err, message: "Could not delete old profile picture"}));
            }
        } else if (!previewUrl && firebaseUser.photoURL) {
             if (firebaseUser.photoURL.startsWith('https://firebasestorage.googleapis.com')) {
                const oldImageRef = ref(storage, firebaseUser.photoURL);
                await deleteObject(oldImageRef).catch(err => logger.warn({ err, message: "Image to be removed could not be deleted"}));
            }
            finalPhotoURL = null;
        }

        await updateProfile(firebaseUser, { 
            displayName: values.name,
            photoURL: finalPhotoURL,
        });
        
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        await setDoc(userDocRef, {
            name: values.name,
            birthDate: Timestamp.fromDate(values.birthDate),
            photoURL: finalPhotoURL,
            mainPage: mainPage,
            memberId: values.memberId?.trim() || null,
        }, { merge: true });

        toast({
          title: t('settings.toast.profileUpdatedTitle'),
          description: t('settings.toast.profileUpdatedDescription'),
        });
        await refreshAuth();
        setSelectedFile(null);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, message: 'Error updating profile' });
        toast({
          title: t('settings.toast.profileUpdateErrorTitle'),
          description: t('settings.toast.profileUpdateErrorDescription'),
          variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) {
        toast({
          title: t('settings.toast.deleteUserMissingTitle'),
          description: t('settings.toast.deleteUserMissingDescription'),
          variant: 'destructive',
        });
        return;
    }
    
    setIsDeleting(true);

    try {
        await deleteUser(firebaseUser);
        toast({
          title: t('settings.toast.accountDeletedTitle'),
          description: t('settings.toast.accountDeletedDescription'),
        });
        router.push('/login');
    } catch (error: any) {
        logger.error({ error, message: "Error deleting user account" });
        let description = t('settings.toast.accountDeleteErrorDescription');
        if (error.code === 'auth/requires-recent-login') {
            description = t('settings.toast.accountDeleteReauthDescription');
        }
        toast({
          title: t('settings.toast.accountDeleteErrorTitle'),
          description,
          variant: 'destructive',
        });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleSubscriptionChange = async (checked: boolean) => {
    if (!isSupported || !user) {
        toast({
          title: t('settings.toast.subscriptionUnavailableTitle'),
          description: t('settings.toast.subscriptionUnavailableDescription'),
          variant: 'destructive',
        });
        return;
    }

    setSubscriptionLoading(true);
    const reg = await navigator.serviceWorker.ready;

    if (checked) {
        try {
            const currentSub = await reg.pushManager.getSubscription();
            if (currentSub) {
                // Already subscribed, ensure DB has it
                await setDoc(doc(pushSubscriptionsCollection, user.uid), {
                    subscription: JSON.parse(JSON.stringify(currentSub)),
                    userId: user.uid
                }, { merge: true });

                setIsSubscribed(true);
                toast({
                  title: t('settings.toast.subscriptionSuccessTitle'),
                  description: t('settings.toast.subscriptionSuccessDescription'),
                });

                // Enviar notificación de prueba
                if (Notification.permission === 'granted') {
                  new Notification('¡Notificaciones Activadas!', {
                    body: 'Ahora recibirás alertas sobre servicios y necesidades urgentes.',
                    icon: '/logo.svg',
                    badge: '/logo.svg'
                  });
                }
            } else {
                // Request permission first
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    toast({
                      title: t('settings.toast.subscriptionPermissionDeniedTitle'),
                      description: t('settings.toast.subscriptionPermissionDeniedDescription'),
                      variant: 'destructive',
                    });
                    setIsSubscribed(false);
                    setSubscriptionLoading(false);
                    return;
                }

                const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidPublicKey) throw new Error("VAPID public key not found");

                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                });

                await setDoc(doc(pushSubscriptionsCollection, user.uid), {
                    subscription: JSON.parse(JSON.stringify(sub)),
                    userId: user.uid
                }, { merge: true });

                setIsSubscribed(true);
                toast({
                  title: t('settings.toast.subscriptionSuccessTitle'),
                  description: t('settings.toast.subscriptionSuccessDescription'),
                });

                // Enviar notificación de prueba
                if (Notification.permission === 'granted') {
                  new Notification('¡Notificaciones Activadas!', {
                    body: 'Ahora recibirás alertas sobre servicios y necesidades urgentes.',
                    icon: '/logo.svg',
                    badge: '/logo.svg'
                  });
                }
            }
        } catch (error) {
            logger.error({ error, message: 'Failed to subscribe user' });
            toast({
              title: t('settings.toast.subscriptionErrorTitle'),
              description: t('settings.toast.subscriptionErrorDescription'),
              variant: 'destructive',
            });
            setIsSubscribed(false);
        }
    } else {
        try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                await sub.unsubscribe();
            }
            await deleteDoc(doc(pushSubscriptionsCollection, user.uid));
            setIsSubscribed(false);
            toast({
              title: t('settings.toast.subscriptionCanceledTitle'),
              description: t('settings.toast.subscriptionCanceledDescription'),
            });
        } catch (error) {
            logger.error({ error, message: 'Failed to unsubscribe user' });
            toast({
              title: t('settings.toast.subscriptionCancelErrorTitle'),
              description: t('settings.toast.subscriptionCancelErrorDescription'),
              variant: 'destructive',
            });
            setIsSubscribed(true);
        }
    }
    setSubscriptionLoading(false);
  };

  const handleMainPageChange = async (value: string) => {
    if (!firebaseUser || value === mainPage) {
      setMainPage(value);
      return;
    }

    setMainPage(value);
    setIsMainPageSaving(true);

    try {
      await setDoc(
        doc(usersCollection, firebaseUser.uid),
        { mainPage: value },
        { merge: true }
      );
      toast({
        title: t('settings.toast.mainPageUpdatedTitle'),
        description: t('settings.toast.mainPageUpdatedDescription'),
      });
    } catch (error) {
      logger.error({ error, message: 'Error updating main page' });
      toast({
        title: t('settings.toast.mainPageUpdateErrorTitle'),
        description: t('settings.toast.mainPageUpdateErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsMainPageSaving(false);
    }
  };


  if (isCheckingRole) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!hasSettingsAccess) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-5 w-5" />
            Acceso restringido
          </CardTitle>
          <CardDescription className="text-amber-800 dark:text-amber-200">
            Tu rol actual es {roleFriendlyNames[userRole]}. Solo la presidencia del cuórum
            (secretario, presidente o consejeros) puede abrir y configurar esta sección.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-amber-800 dark:text-amber-200">
            Puedes navegar por el resto de la aplicación con normalidad. Para ajustes de
            configuración, contacta al secretario del cuórum.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="page-section">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-fluid-title font-semibold">
          {t('Settings')}
        </h1>
        <p className="text-balance text-fluid-subtitle text-muted-foreground">
          {t('Manage your account and application settings.')}
        </p>
      </header>
      <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('Profile')}</CardTitle>
            <CardDescription>
              Actualiza tu información de perfil.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onProfileSubmit)}>
              <CardContent className="space-y-4">
                {isProfileLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <>
                       <FormItem className="flex flex-col items-center">
                            <FormControl>
                                <div className="relative group">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={previewUrl ?? undefined} alt={user?.displayName || 'User'} />
                                        <AvatarFallback>
                                            {isSubmitting ? <Loader2 className="animate-spin" /> : <User className="h-10 w-10" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Button type="button" variant="ghost" size="icon" className="h-full w-full text-white" onClick={() => !isSubmitting && fileInputRef.current?.click()}>
                                        <Camera className="h-8 w-8" />
                                       </Button>
                                    </div>
                                    {previewUrl && !isSubmitting && (
                                        <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                                        onClick={removeImage}
                                        >
                                        <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </FormControl>
                            <Input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageChange}
                                disabled={isSubmitting}
                            />
                            <FormMessage />
                        </FormItem>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Nombre</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="birthDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Nacimiento</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={'outline'}
                                        className={cn(
                                            'w-full pl-3 text-left font-normal',
                                            !field.value && 'text-muted-foreground'
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, 'd LLLL yyyy', { locale: es })
                                        ) : (
                                            <span>Selecciona una fecha</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date > new Date() || date < new Date('1900-01-01')
                                        }
                                        initialFocus
                                        locale={es}
                                        captionLayout="dropdown"
                                        fromYear={1920}
                                        toYear={new Date().getFullYear()}
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="memberId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>ID o cédula de miembro (opcional)</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Ej: 123456" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isProfileLoading}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Página Principal</CardTitle>
            <CardDescription>
              Selecciona la página que se mostrará al iniciar sesión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="main-page-select" className="text-sm font-medium">
                Página de inicio
              </Label>
              <select
                id="main-page-select"
                value={mainPage}
                onChange={(e) => handleMainPageChange(e.target.value)}
                disabled={isMainPageSaving || isProfileLoading}
                aria-label="Seleccionar página de inicio"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {navigationItems
                  .filter((item) => visiblePages.includes(item.href))
                  .map((item) => (
                    <option key={item.href} value={item.href}>
                      {item.label}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Esta será la primera página que verás al iniciar sesión.
              </p>
              {isMainPageSaving && (
                <p className="text-xs text-muted-foreground">Guardando...</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('Appearance')}</CardTitle>
            <CardDescription>
              {t('Customize the look and feel of the application.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span className="text-sm font-medium sm:text-base">{t('Dark Mode')}</span>
                <span className="text-xs font-normal leading-snug text-muted-foreground sm:text-sm">
                  {t('Toggle between light and dark themes.')}
                </span>
              </Label>
              <Switch
                id="dark-mode"
                checked={theme === 'dark'}
                onCheckedChange={(checked) =>
                  setTheme(checked ? 'dark' : 'light')
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('Notifications')}</CardTitle>
            <CardDescription>
              {t('Configure how you receive notifications.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="notifications-switch" className="flex flex-col space-y-1">
                <span className="text-sm font-medium sm:text-base">Activar Notificaciones</span>
                <span className="text-xs font-normal leading-snug text-muted-foreground sm:text-sm">
                  Recibe alertas sobre servicios y necesidades urgentes.
                </span>
              </Label>
              <Switch
                id="notifications-switch"
                checked={isSubscribed}
                onCheckedChange={handleSubscriptionChange}
                disabled={!isSupported || isSubscriptionLoading}
              />
            </div>
            {!isSupported && (
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                Tu navegador no es compatible con notificaciones.
              </p>
            )}
          </CardContent>
        </Card>
        {canManageRoles && (
          <div className="xl:col-span-full">
            <RoleManagement />
          </div>
        )}

        <Card className="border-destructive xl:col-span-full">
            <CardHeader>
                <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                <CardDescription>
                    Estas acciones son permanentes y no se pueden deshacer.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">Eliminar mi cuenta</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta y tu acceso a la aplicación.
                            Sin embargo, los datos que hayas ingresado (como reportes, actividades, etc.) permanecerán en el sistema.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}>
                            {isDeleting ? "Eliminando..." : "Sí, eliminar mi cuenta"}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
      </div>
    </section>
  );
}
