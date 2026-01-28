import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { app } from '@/lib/firebase';

let messaging: Messaging | null = null;

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

    const messagingInstance = initializeMessaging();
    if (!messagingInstance) {
      throw new Error('Messaging not initialized');
    }

    // Get registration token
    const token = await getToken(messagingInstance);

    return token;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
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
