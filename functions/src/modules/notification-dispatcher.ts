import type { firestore as FirestoreNamespace } from "firebase-admin";
import * as admin from "firebase-admin";

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
  | "missionary_assignment"
  | "observations"
  | "family_search"
  | "future_member";

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

interface FcmTokenRecord {
  userId: string;
  fcmToken: string;
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
  constructor(private readonly db: FirestoreNamespace.Firestore) { }

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

class FcmRepository {
  private readonly collection: FirestoreNamespace.CollectionReference;

  constructor(
    private readonly db: FirestoreNamespace.Firestore,
    private readonly messaging: admin.messaging.Messaging,
    private readonly logger: LoggerPort
  ) {
    this.collection = this.db.collection("c_push_subscriptions");
  }

  async getActiveTokens(): Promise<FcmTokenRecord[]> {
    const snapshot = await this.collection.get();
    const tokens: FcmTokenRecord[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const fcmToken = data.fcmToken as string | null;
      if (fcmToken) {
        tokens.push({
          userId: data.userId as string,
          fcmToken,
        });
      }
    });

    return tokens;
  }

  async getTokensForUsers(userIds: string[]): Promise<FcmTokenRecord[]> {
    if (userIds.length === 0) return [];
    // Firestore 'in' query supports max 30 elements; batch if needed
    const batches: Promise<FcmTokenRecord[]>[] = [];
    for (let i = 0; i < userIds.length; i += 30) {
      const batch = userIds.slice(i, i + 30);
      batches.push(
        this.collection
          .where("userId", "in", batch)
          .get()
          .then((snap) => {
            const results: FcmTokenRecord[] = [];
            snap.forEach((doc) => {
              const data = doc.data();
              if (data.fcmToken) {
                results.push({ userId: data.userId as string, fcmToken: data.fcmToken as string });
              }
            });
            return results;
          })
      );
    }
    const results = await Promise.all(batches);
    return results.flat();
  }

  async sendToTokens(
    tokens: FcmTokenRecord[],
    payload: { title: string; body: string; url?: string; tag?: string }
  ): Promise<void> {
    if (tokens.length === 0) {
      this.logger.log("No FCM tokens to notify.");
      return;
    }

    const rawTokens = [...new Set(tokens.map((t) => t.fcmToken))];

    // FCM sendEachForMulticast supports up to 500 tokens per request
    const chunkSize = 500;
    for (let i = 0; i < rawTokens.length; i += chunkSize) {
      const chunk = rawTokens.slice(i, i + chunkSize);
      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          // ── Android ──────────────────────────────────────────────────────
          android: {
            priority: "high",
            notification: {
              title: payload.title,
              body: payload.body,
              tag: payload.tag,
              defaultVibrateTimings: true,
              defaultSound: true,
            },
            data: {
              url: payload.url ?? "/",
              tag: payload.tag ?? "",
            },
          },
          // ── iOS (APNs) ────────────────────────────────────────────────────
          apns: {
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                badge: 1,
                sound: "default",
              },
            },
            fcmOptions: {
              analyticsLabel: payload.tag ?? "quorumflow",
            },
          },
          // ── Web (PWA) ─────────────────────────────────────────────────────
          webpush: {
            headers: {
              Urgency: "high",
            },
            notification: {
              title: payload.title,
              body: payload.body,
              tag: payload.tag,
              icon: "/logo.svg",
              badge: "/logo.svg",
            },
            fcmOptions: {
              link: payload.url ?? "/",
            },
          },
          // ── Data payload (available on all platforms) ─────────────────────
          data: {
            url: payload.url ?? "/",
            tag: payload.tag ?? "",
            title: payload.title,
            body: payload.body,
          },
        });

        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              failedTokens.push(chunk[idx]);
              this.logger.warn(`Invalid FCM token removed: ${chunk[idx]}`);
            } else {
              this.logger.error(`FCM send error for token ${chunk[idx]}: ${resp.error?.message}`);
            }
          }
        });

        // Remove invalid tokens from Firestore
        if (failedTokens.length > 0) {
          await this.removeInvalidTokens(failedTokens);
        }
      } catch (error) {
        this.logger.error(`Error sending FCM multicast: ${error}`);
      }
    }
  }

  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      const batch = this.db.batch();
      for (const token of tokens) {
        const docs = await this.collection.where("fcmToken", "==", token).get();
        docs.forEach((doc) => batch.delete(doc.ref));
      }
      await batch.commit();
    } catch (error) {
      this.logger.error(`Error removing invalid FCM tokens: ${error}`);
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
  private readonly fcmRepository: FcmRepository;
  private readonly recordFactory: NotificationRecordFactory;

  constructor(
    db: FirestoreNamespace.Firestore,
    messaging: admin.messaging.Messaging,
    private readonly logger: LoggerPort
  ) {
    this.userRepository = new UserRepository(db);
    this.notificationRepository = new NotificationRepository(db);
    this.fcmRepository = new FcmRepository(db, messaging, logger);
    this.recordFactory = new NotificationRecordFactory();
  }

  async broadcast(request: BroadcastNotificationRequest): Promise<void> {
    this.logger.log(`Broadcasting notification: ${request.title}`);

    const [userIds, fcmTokens] = await Promise.all([
      this.userRepository.getAllUserIds(),
      this.fcmRepository.getActiveTokens(),
    ]);

    if (userIds.length === 0) {
      this.logger.warn("No users registered in the system to notify.");
    }

    const records = userIds.map((userId) =>
      this.recordFactory.create(userId, request)
    );

    await Promise.all([
      this.notificationRepository.saveMany(records),
      this.fcmRepository.sendToTokens(fcmTokens, {
        title: request.title,
        body: request.body,
        url: request.url ?? request.context?.actionUrl,
        tag: request.tag,
      }),
    ]);
  }

  /**
   * Broadcast to specific users only (filtered by userId list).
   * Used by scheduled functions that already determine eligible users.
   */
  async broadcastToUsers(
    userIds: string[],
    request: BroadcastNotificationRequest,
    pushUserIds?: string[]
  ): Promise<void> {
    if (userIds.length === 0 && (!pushUserIds || pushUserIds.length === 0)) {
      return;
    }

    const inAppUserIds = userIds;
    const fcmTargetUserIds = pushUserIds ?? userIds;

    const [records, fcmTokens] = await Promise.all([
      Promise.resolve(inAppUserIds.map((uid) => this.recordFactory.create(uid, request))),
      this.fcmRepository.getTokensForUsers(fcmTargetUserIds),
    ]);

    await Promise.all([
      this.notificationRepository.saveMany(records),
      this.fcmRepository.sendToTokens(fcmTokens, {
        title: request.title,
        body: request.body,
        url: request.url ?? request.context?.actionUrl,
        tag: request.tag,
      }),
    ]);
  }
}
