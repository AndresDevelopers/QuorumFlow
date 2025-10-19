import type { firestore as FirestoreNamespace } from "firebase-admin";
import * as admin from "firebase-admin";
import type * as webpush from "web-push";

export type NotificationContextType =
  | "convert"
  | "activity"
  | "service"
  | "member"
  | "council"
  | "baptism"
  | "birthday"
  | "investigator"
  | "urgent_family"
  | "missionary_assignment";

export interface NotificationContext {
  contextType?: NotificationContextType;
  contextId?: string;
  actionUrl?: string;
  actionType?: "navigate" | "external";
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
  url?: string;
}

export interface BroadcastNotificationRequest {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: NotificationAction[];
  context?: NotificationContext;
}

interface SubscriptionRecord {
  userId: string;
  subscription: webpush.PushSubscription;
}

interface NotificationRecord {
  userId: string;
  title: string;
  body: string;
  createdAt: admin.firestore.FieldValue;
  isRead: boolean;
  actionUrl?: string;
  actionType?: "navigate" | "external";
  contextType?: NotificationContextType;
  contextId?: string;
}

interface LoggerPort {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

class UserRepository {
  constructor(private readonly db: FirestoreNamespace.Firestore) {}

  async getAllUserIds(): Promise<string[]> {
    const snapshot = await this.db.collection("c_users").select().get();
    return snapshot.docs.map((doc) => doc.id);
  }
}

class NotificationRepository {
  private readonly collection: FirestoreNamespace.CollectionReference;

  constructor(private readonly db: FirestoreNamespace.Firestore) {
    this.collection = this.db.collection("c_notifications");
  }

  async saveMany(records: NotificationRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await Promise.all(records.map((record) => this.collection.add(record)));
  }
}

class SubscriptionRepository {
  private readonly collection: FirestoreNamespace.CollectionReference;

  constructor(
    private readonly db: FirestoreNamespace.Firestore,
    private readonly pushClient: typeof webpush,
    private readonly logger: LoggerPort
  ) {
    this.collection = this.db.collection("c_push_subscriptions");
  }

  async getActiveSubscriptions(): Promise<SubscriptionRecord[]> {
    const snapshot = await this.collection.get();
    const subscriptions: SubscriptionRecord[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const subscription = data.subscription as webpush.PushSubscription | null;
      if (subscription && subscription.endpoint) {
        subscriptions.push({
          userId: data.userId as string,
          subscription,
        });
      }
    });

    return subscriptions;
  }

  async sendToSubscribers(
    subscriptions: SubscriptionRecord[],
    payload: Record<string, unknown>
  ): Promise<void> {
    if (subscriptions.length === 0) {
      this.logger.log("No push subscriptions to notify.");
      return;
    }

    const serializedPayload = JSON.stringify(payload);

    const sendResults = await Promise.allSettled(
      subscriptions.map(({ subscription, userId }) =>
        this.pushClient
          .sendNotification(subscription, serializedPayload)
          .catch((error) => {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              this.logger.warn(
                `Subscription for user ${userId} is invalid. Consider removing it.`
              );
            } else {
              this.logger.error(
                `Error sending push notification to user ${userId}: ${error}`
              );
            }
            return null;
          })
      )
    );

    const rejected = sendResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (rejected.length > 0) {
      this.logger.warn(
        `${rejected.length} push notifications were rejected during broadcast.`
      );
    }
  }
}

class NotificationRecordFactory {
  create(userId: string, request: BroadcastNotificationRequest): NotificationRecord {
    const { context } = request;
    const actionUrl = context?.actionUrl ?? request.url;
    const actionType = context?.actionType ?? (actionUrl ? "navigate" : undefined);

    return {
      userId,
      title: request.title,
      body: request.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
      ...(actionUrl ? { actionUrl } : {}),
      ...(actionType ? { actionType } : {}),
      ...(context?.contextType ? { contextType: context.contextType } : {}),
      ...(context?.contextId ? { contextId: context.contextId } : {}),
    };
  }
}

export class NotificationDispatcher {
  private readonly userRepository: UserRepository;
  private readonly notificationRepository: NotificationRepository;
  private readonly subscriptionRepository: SubscriptionRepository;
  private readonly recordFactory: NotificationRecordFactory;

  constructor(
    db: FirestoreNamespace.Firestore,
    pushClient: typeof webpush,
    private readonly logger: LoggerPort
  ) {
    this.userRepository = new UserRepository(db);
    this.notificationRepository = new NotificationRepository(db);
    this.subscriptionRepository = new SubscriptionRepository(db, pushClient, logger);
    this.recordFactory = new NotificationRecordFactory();
  }

  async broadcast(request: BroadcastNotificationRequest): Promise<void> {
    this.logger.log(`Broadcasting notification: ${request.title}`);

    const [userIds, subscriptions] = await Promise.all([
      this.userRepository.getAllUserIds(),
      this.subscriptionRepository.getActiveSubscriptions(),
    ]);

    if (userIds.length === 0) {
      this.logger.warn("No users registered in the system to notify.");
    }

    const records = userIds.map((userId) =>
      this.recordFactory.create(userId, request)
    );

    const pushPayload: Record<string, unknown> = {
      title: request.title,
      body: request.body,
      url: request.url ?? request.context?.actionUrl,
      tag: request.tag,
      actions: request.actions?.map((action) => ({
        action: action.action,
        title: action.title,
        icon: action.icon,
        url: action.url,
      })),
      data: {
        contextType: request.context?.contextType,
        contextId: request.context?.contextId,
      },
    };

    await Promise.all([
      this.notificationRepository.saveMany(records),
      this.subscriptionRepository.sendToSubscribers(subscriptions, pushPayload),
    ]);
  }
}
