import { addDoc, Timestamp } from "firebase/firestore";
import { notificationsCollection } from "./collections";
import type { AppNotification } from "./types";

/**
 * Helper function to create notifications with navigation context
 * This ensures consistent notification creation across the app
 */
export interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  contextType?: AppNotification['contextType'];
  contextId?: string;
  actionUrl?: string;
  actionType?: 'navigate' | 'external';
}

/**
 * Creates a new notification with optional navigation context
 * @param params - Notification parameters including navigation context
 * @returns Promise<string> - The ID of the created notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const {
    userId,
    title,
    body,
    contextType,
    contextId,
    actionUrl,
    actionType = 'navigate'
  } = params;

  const notification: Omit<AppNotification, 'id'> = {
    userId,
    title,
    body,
    createdAt: Timestamp.now(),
    isRead: false,
    ...(contextType && { contextType }),
    ...(contextId && { contextId }),
    ...(actionUrl && { actionUrl }),
    ...(actionUrl && { actionType })
  };

  const docRef = await addDoc(notificationsCollection, notification);
  return docRef.id;
}

/**
 * Pre-configured notification creators for common use cases
 */
export const NotificationCreators = {
  /**
   * Create notification for new convert
   */
  newConvert: (userId: string, convertName: string, convertId: string) =>
    createNotification({
      userId,
      title: "Nuevo Converso Registrado",
      body: `${convertName} ha sido registrado como nuevo converso`,
      contextType: 'convert',
      contextId: convertId
    }),

  /**
   * Create notification for new activity
   */
  newActivity: (userId: string, activityTitle: string, activityId: string) =>
    createNotification({
      userId,
      title: "Nueva Actividad Programada",
      body: `Se ha programado la actividad: ${activityTitle}`,
      contextType: 'activity',
      contextId: activityId
    }),

  /**
   * Create notification for new service opportunity
   */
  newService: (userId: string, serviceTitle: string, serviceId: string) =>
    createNotification({
      userId,
      title: "Nueva Oportunidad de Servicio",
      body: `Se ha registrado un nuevo servicio: ${serviceTitle}`,
      contextType: 'service',
      contextId: serviceId
    }),

  /**
   * Create notification for council meeting
   */
  councilMeeting: (userId: string, date: string) =>
    createNotification({
      userId,
      title: "Reunión de Consejo Programada",
      body: `Reunión de consejo programada para ${date}`,
      contextType: 'council'
    }),

  /**
   * Create notification for baptism
   */
  newBaptism: (userId: string, memberName: string, baptismId: string) =>
    createNotification({
      userId,
      title: "Nuevo Bautismo Registrado",
      body: `${memberName} ha sido bautizado`,
      contextType: 'baptism',
      contextId: baptismId
    }),

  /**
   * Create notification for birthday reminder
   */
  birthdayReminder: (userId: string, memberName: string, date: string) =>
    createNotification({
      userId,
      title: "Recordatorio de Cumpleaños",
      body: `${memberName} cumple años el ${date}`,
      contextType: 'birthday'
    }),

  /**
   * Create notification for new investigator
   */
  newInvestigator: (userId: string, investigatorName: string, investigatorId: string) =>
    createNotification({
      userId,
      title: "Nuevo Investigador",
      body: `${investigatorName} ha sido registrado como investigador`,
      contextType: 'investigator',
      contextId: investigatorId
    }),

  /**
   * Create notification for member status change
   */
  memberStatusChange: (userId: string, memberName: string, status: string, memberId: string) =>
    createNotification({
      userId,
      title: "Cambio de Estado de Miembro",
      body: `${memberName} ha cambiado su estado a: ${status}`,
      contextType: 'member',
      contextId: memberId
    }),

  /**
   * Create custom notification with external link
   */
  externalLink: (userId: string, title: string, body: string, url: string) =>
    createNotification({
      userId,
      title,
      body,
      actionUrl: url,
      actionType: 'external'
    })
};

/**
 * Bulk create notifications for multiple users
 * @param userIds - Array of user IDs to send notification to
 * @param notificationParams - Notification parameters (excluding userId)
 * @returns Promise<string[]> - Array of created notification IDs
 */
export async function createBulkNotifications(
  userIds: string[],
  notificationParams: Omit<CreateNotificationParams, 'userId'>
): Promise<string[]> {
  const promises = userIds.map(userId =>
    createNotification({ ...notificationParams, userId })
  );
  
  return Promise.all(promises);
}
