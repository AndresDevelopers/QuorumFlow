
"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDocs, collection, query, where, orderBy, writeBatch } from "firebase/firestore";
import { pushSubscriptionsCollection, notificationsCollection } from "@/lib/collections";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AppNotification } from "@/lib/types";
import { formatRelative } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "./ui/skeleton";

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        notificationsCollection,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const userNotifications = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as AppNotification)
      );
      setNotifications(userNotifications);
      setHasUnread(userNotifications.some(n => !n.isRead));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleMarkAsRead = async () => {
    if (!user || !hasUnread) return;

    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(doc(notificationsCollection).firestore);
      unreadNotifications.forEach(n => {
        const docRef = doc(notificationsCollection, n.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
      setHasUnread(false);
      // Optimistically update UI
      setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    } catch (error) {
        console.error("Error marking notifications as read:", error);
    }
  };

  // Generate navigation URL based on notification context
  const getNavigationUrl = (notification: AppNotification): string | null => {
    // If explicit actionUrl is provided, use it
    if (notification.actionUrl) {
      return notification.actionUrl;
    }

    // Generate URL based on contextType and contextId
    if (!notification.contextType) {
      return null;
    }

    switch (notification.contextType) {
      case 'convert':
        return notification.contextId ? `/converts/${notification.contextId}` : null;
      case 'activity':
        return '/reports';
      case 'service':
        return notification.contextId ? `/services/${notification.contextId}` : null;
      case 'member':
        return notification.contextId ? `/members/${notification.contextId}` : null;
      case 'council':
        return `/council`;
      case 'baptism':
        return notification.contextId ? `/baptisms/${notification.contextId}` : null;
      case 'birthday':
        return `/birthdays`;
      case 'investigator':
        return notification.contextId ? `/investigators/${notification.contextId}` : null;
      case 'urgent_family':
        return '/ministering/urgent';
      case 'missionary_assignment':
        return '/missionary-work';
      default:
        return null;
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    const url = getNavigationUrl(notification);
    
    if (url) {
      // Mark notification as read when clicked
      if (!notification.isRead) {
        try {
          const docRef = doc(notificationsCollection, notification.id);
          await setDoc(docRef, { ...notification, isRead: true }, { merge: true });
          
          // Update local state
          setNotifications(prev => 
            prev.map(n => n.id === notification.id ? {...n, isRead: true} : n)
          );
          
          // Update unread status
          const stillHasUnread = notifications.some(n => n.id !== notification.id && !n.isRead);
          setHasUnread(stillHasUnread);
        } catch (error) {
          console.error("Error marking notification as read:", error);
        }
      }

      // Navigate based on action type
      if (notification.actionType === 'external' && url.startsWith('http')) {
        window.open(url, '_blank');
      } else {
        router.push(url);
      }
    }
  };


  return (
    <Popover onOpenChange={(isOpen) => { if (isOpen) fetchNotifications(); else handleMarkAsRead(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle notifications"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-sm">Notificaciones</h4>
        </div>
        <div className="space-y-2">
            {loading ? (
                <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </>
            ) : notifications.length > 0 ? (
                notifications.map((notif) => {
                    const url = getNavigationUrl(notif);
                    const isClickable = !!url;
                    
                    return (
                        <div 
                            key={notif.id} 
                            className={`text-sm p-2 rounded-md transition-colors ${
                                isClickable 
                                    ? 'hover:bg-muted cursor-pointer border border-transparent hover:border-border' 
                                    : 'hover:bg-muted/50'
                            } ${!notif.isRead ? 'bg-primary/5 border-primary/20' : ''}`}
                            onClick={() => isClickable && handleNotificationClick(notif)}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className={`font-semibold ${!notif.isRead ? 'text-primary' : ''}`}>
                                        {notif.title}
                                    </p>
                                    <p className="text-muted-foreground text-xs">{notif.body}</p>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        {formatRelative(notif.createdAt.toDate(), new Date(), { locale: es })}
                                    </p>
                                </div>
                                {isClickable && (
                                    <div className="ml-2 flex-shrink-0">
                                        {notif.actionType === 'external' ? (
                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                            <div className="h-3 w-3 rounded-full bg-primary/20" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {!notif.isRead && (
                                <div className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
                            )}
                        </div>
                    );
                })
            ) : (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Mail className="h-8 w-8 mb-2" />
                    <p className="text-sm">No tienes notificaciones</p>
                </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
