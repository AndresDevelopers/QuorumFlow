'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { doc, setDoc } from 'firebase/firestore';
import { pushSubscriptionsCollection } from '@/lib/collections';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
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

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) return;

    try {
      const { getDoc } = await import('firebase/firestore');
      const subscriptionDoc = await getDoc(doc(pushSubscriptionsCollection, user.uid));

      if (subscriptionDoc.exists()) {
        const data = subscriptionDoc.data();
        setIsSubscribed(!!data.fcmToken);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  }, [user]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      void checkSubscription();
    }
  }, [checkSubscription]);

  const subscribeToPush = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "No se puede activar las notificaciones en este momento.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Solicitar permiso
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        toast({
          title: "Permiso Denegado",
          description: "No se otorgó permiso para enviar notificaciones.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Importar dinámicamente Firebase Messaging
      const { initializeMessaging } = await import('@/lib/firebase-messaging');
      const { getToken } = await import('firebase/messaging');

      const messaging = initializeMessaging();
      if (!messaging) {
        throw new Error('No se pudo inicializar Firebase Messaging');
      }

      // Obtener el token FCM
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY
      });

      if (!fcmToken) {
        throw new Error('No se pudo obtener el token FCM');
      }

      // Guardar el token FCM en Firestore
      await setDoc(doc(pushSubscriptionsCollection, user.uid), {
        userId: user.uid,
        fcmToken,
        createdAt: new Date(),
        userAgent: navigator.userAgent
      });

      setIsSubscribed(true);
      toast({
        title: "Notificaciones Activadas",
        description: "Recibirás notificaciones push en este dispositivo.",
      });

      // Enviar notificación de prueba
      if (Notification.permission === 'granted') {
        new Notification('¡Notificaciones Activadas!', {
          body: 'Ahora recibirás recordatorios importantes de la aplicación.',
          icon: '/logo.svg',
          badge: '/logo.svg'
        });
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: "Error",
        description: "No se pudo activar las notificaciones. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setShowPermissionDialog(false);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Importar dinámicamente Firebase Messaging
      const { initializeMessaging } = await import('@/lib/firebase-messaging');
      const { deleteToken } = await import('firebase/messaging');

      const messaging = initializeMessaging();
      if (messaging) {
        // Eliminar el token FCM
        await deleteToken(messaging);
      }

      // Eliminar de Firestore
      await setDoc(doc(pushSubscriptionsCollection, user.uid), {
        userId: user.uid,
        fcmToken: null,
        unsubscribedAt: new Date()
      });

      setIsSubscribed(false);
      toast({
        title: "Notificaciones Desactivadas",
        description: "Ya no recibirás notificaciones push en este dispositivo.",
      });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast({
        title: "Error",
        description: "No se pudo desactivar las notificaciones.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported || !user) {
    return null;
  }

  return (
    <>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={() => {
          if (isSubscribed) {
            unsubscribeFromPush();
          } else {
            setShowPermissionDialog(true);
          }
        }}
        disabled={isLoading}
      >
        {isSubscribed ? (
          <>
            <BellOff className="mr-2 h-4 w-4" />
            Desactivar Notificaciones
          </>
        ) : (
          <>
            <Bell className="mr-2 h-4 w-4" />
            Activar Notificaciones
          </>
        )}
      </Button>

      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activar Notificaciones Push</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas recibir notificaciones push en este dispositivo? Te enviaremos recordatorios importantes sobre:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Cumpleaños de miembros</li>
                <li>Servicios próximos</li>
                <li>Necesidades urgentes de ministración</li>
                <li>Actividades del quórum</li>
                <li>Asignaciones de la obra misional</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={subscribeToPush}>
              Activar Notificaciones
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
