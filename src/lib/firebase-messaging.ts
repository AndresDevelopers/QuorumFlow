import { deleteToken, getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { app } from '@/lib/firebase';

let messaging: Messaging | null = null;

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('Error waiting for service worker registration:', error);
    return null;
  }
}

async function getFcmToken(): Promise<string | null> {
  const messagingInstance = initializeMessaging();
  if (!messagingInstance) {
    throw new Error('Messaging not initialized');
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error('VAPID key not found in environment variables');
    throw new Error('VAPID key not configured');
  }

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  if (!serviceWorkerRegistration) {
    throw new Error('Service worker registration not ready');
  }

  return getToken(messagingInstance, {
    vapidKey,
    serviceWorkerRegistration,
  });
}

// Initialize Firebase Messaging
export const initializeMessaging = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    return await getFcmToken();
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

export const getExistingNotificationToken = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') {
      return null;
    }

    return await getFcmToken();
  } catch (error) {
    console.error('Error getting existing notification token:', error);
    return null;
  }
};

export const deleteNotificationToken = async (): Promise<boolean> => {
  try {
    const messagingInstance = initializeMessaging();
    if (!messagingInstance) {
      return false;
    }

    return await deleteToken(messagingInstance);
  } catch (error) {
    console.error('Error deleting notification token:', error);
    return false;
  }
};

// Listen for foreground messages
export const onMessageListener = () => {
  return new Promise((resolve) => {
    const messagingInstance = initializeMessaging();
    if (!messagingInstance) {
      return;
    }

    onMessage(messagingInstance, (payload) => {
      resolve(payload);
    });
  });
};
