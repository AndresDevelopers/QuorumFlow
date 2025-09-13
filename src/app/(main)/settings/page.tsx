
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
import { useEffect, useState, useRef } from 'react';
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
import { CalendarIcon, User, Camera, Loader2, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const profileSchema = z.object({
  name: z.string().min(2, { message: "El nombre es requerido." }),
  birthDate: z.date({
    required_error: "La fecha de nacimiento es requerida.",
  }),
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

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscriptionLoading, setSubscriptionLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setIsSubscribed(true);
          }
          setSubscriptionLoading(false);
        });
      }).catch(() => setSubscriptionLoading(false));
    } else {
      setSubscriptionLoading(false);
      setIsSupported(false);
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    const fetchUserData = async () => {
        if (!firebaseUser) return;
        setIsProfileLoading(true);
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          form.reset({
            name: userData.name || firebaseUser.displayName || '',
            birthDate: userData.birthDate ? (userData.birthDate as Timestamp).toDate() : undefined,
          });
          setPreviewUrl(firebaseUser.photoURL || null);
        } else {
            form.reset({
                name: firebaseUser.displayName || '',
            });
            setPreviewUrl(firebaseUser.photoURL || null);
        }
        setIsProfileLoading(false);
      };

    if (firebaseUser) {
      fetchUserData();
    }
  }, [firebaseUser, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo de la imagen es de 20MB.",
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
        }, { merge: true });

        toast({ title: 'Éxito', description: 'Tu perfil ha sido actualizado.' });
        await refreshAuth();
        setSelectedFile(null);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, message: 'Error updating profile' });
        toast({ title: 'Error', description: 'No se pudo actualizar tu perfil.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) {
        toast({ title: 'Error', description: 'No se pudo encontrar el usuario para eliminar.', variant: 'destructive' });
        return;
    }
    
    setIsDeleting(true);

    try {
        await deleteUser(firebaseUser);
        toast({ title: 'Cuenta Eliminada', description: 'Tu cuenta ha sido eliminada exitosamente.' });
        router.push('/login');
    } catch (error: any) {
        logger.error({ error, message: "Error deleting user account" });
        let description = 'Ocurrió un error al eliminar tu cuenta.';
        if (error.code === 'auth/requires-recent-login') {
            description = 'Esta operación es sensible y requiere autenticación reciente. Por favor, cierra sesión y vuelve a iniciar sesión antes de intentarlo de nuevo.';
        }
        toast({ title: 'Error al Eliminar', description, variant: 'destructive' });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleSubscriptionChange = async (checked: boolean) => {
    if (!isSupported || !user) {
        toast({ title: "No se puede cambiar la suscripción", description: "Tu navegador debe ser compatible y debes haber iniciado sesión.", variant: "destructive" });
        return;
    }

    setSubscriptionLoading(true);
    const reg = await navigator.serviceWorker.ready;

    if (checked) {
        try {
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
            toast({ title: "Suscripción exitosa", description: "Recibirás notificaciones." });
        } catch (error) {
            logger.error({ error, message: 'Failed to subscribe user' });
            toast({ title: "Error de suscripción", description: "No se pudieron habilitar las notificaciones.", variant: "destructive" });
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
            toast({ title: "Suscripción cancelada", description: "Ya no recibirás notificaciones." });
        } catch (error) {
            logger.error({ error, message: 'Failed to unsubscribe user' });
            toast({ title: "Error al cancelar", description: "No se pudo cancelar la suscripción a las notificaciones.", variant: "destructive" });
            setIsSubscribed(true);
        }
    }
    setSubscriptionLoading(false);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('Settings')}</h1>
        <p className="text-muted-foreground">
          {t('Manage your account and application settings.')}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
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
                                        captionLayout="dropdown-buttons"
                                        fromYear={1920}
                                        toYear={new Date().getFullYear()}
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                  <Button type="submit" disabled={isSubmitting || isProfileLoading}>
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('Appearance')}</CardTitle>
            <CardDescription>
              {t('Customize the look and feel of the application.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span>{t('Dark Mode')}</span>
                <span className="font-normal leading-snug text-muted-foreground text-xs">
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
        <Card>
          <CardHeader>
            <CardTitle>{t('Notifications')}</CardTitle>
            <CardDescription>
              {t('Configure how you receive notifications.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between">
              <Label htmlFor="notifications-switch" className="flex flex-col space-y-1">
                <span>Activar Notificaciones</span>
                <span className="font-normal leading-snug text-muted-foreground">
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
            {!isSupported && <p className="text-xs text-muted-foreground mt-2">Tu navegador no es compatible con notificaciones.</p>}
          </CardContent>
        </Card>

        <Card className="border-destructive">
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
    </div>
  );
}

    