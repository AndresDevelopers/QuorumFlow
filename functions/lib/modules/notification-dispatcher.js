"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcher = void 0;
const admin = __importStar(require("firebase-admin"));
class UserRepository {
    constructor(db) {
        this.db = db;
    }
    async getAllUserIds() {
        const snapshot = await this.db.collection("c_users").select().get();
        return snapshot.docs.map((doc) => doc.id);
    }
}
class NotificationRepository {
    constructor(db) {
        this.db = db;
        this.collection = this.db.collection("c_notifications");
    }
    async saveMany(records) {
        if (records.length === 0) {
            return;
        }
        await Promise.all(records.map((record) => this.collection.add(record)));
    }
}
class FcmRepository {
    constructor(db, messaging, logger) {
        this.db = db;
        this.messaging = messaging;
        this.logger = logger;
        this.collection = this.db.collection("c_push_subscriptions");
    }
    async getActiveTokens() {
        const snapshot = await this.collection.get();
        const tokens = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            const fcmToken = data.fcmToken;
            if (fcmToken) {
                tokens.push({
                    userId: data.userId,
                    fcmToken,
                });
            }
        });
        return tokens;
    }
    async getTokensForUsers(userIds) {
        if (userIds.length === 0)
            return [];
        // Firestore 'in' query supports max 30 elements; batch if needed
        const batches = [];
        for (let i = 0; i < userIds.length; i += 30) {
            const batch = userIds.slice(i, i + 30);
            batches.push(this.collection
                .where("userId", "in", batch)
                .get()
                .then((snap) => {
                const results = [];
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (data.fcmToken) {
                        results.push({ userId: data.userId, fcmToken: data.fcmToken });
                    }
                });
                return results;
            }));
        }
        const results = await Promise.all(batches);
        return results.flat();
    }
    async sendToTokens(tokens, payload) {
        if (tokens.length === 0) {
            this.logger.log("No FCM tokens to notify.");
            return;
        }
        const rawTokens = tokens.map((t) => t.fcmToken);
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
                            // Icon must be a drawable resource name registered in the app
                            // icon: "ic_notification",
                            clickAction: "FLUTTER_NOTIFICATION_CLICK",
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
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code;
                        if (code === "messaging/registration-token-not-registered" ||
                            code === "messaging/invalid-registration-token") {
                            failedTokens.push(chunk[idx]);
                            this.logger.warn(`Invalid FCM token removed: ${chunk[idx]}`);
                        }
                        else {
                            this.logger.error(`FCM send error for token ${chunk[idx]}: ${resp.error?.message}`);
                        }
                    }
                });
                // Remove invalid tokens from Firestore
                if (failedTokens.length > 0) {
                    await this.removeInvalidTokens(failedTokens);
                }
            }
            catch (error) {
                this.logger.error(`Error sending FCM multicast: ${error}`);
            }
        }
    }
    async removeInvalidTokens(tokens) {
        try {
            const batch = this.db.batch();
            for (const token of tokens) {
                const docs = await this.collection.where("fcmToken", "==", token).get();
                docs.forEach((doc) => batch.delete(doc.ref));
            }
            await batch.commit();
        }
        catch (error) {
            this.logger.error(`Error removing invalid FCM tokens: ${error}`);
        }
    }
}
class NotificationRecordFactory {
    create(userId, request) {
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
class NotificationDispatcher {
    constructor(db, messaging, logger) {
        this.logger = logger;
        this.userRepository = new UserRepository(db);
        this.notificationRepository = new NotificationRepository(db);
        this.fcmRepository = new FcmRepository(db, messaging, logger);
        this.recordFactory = new NotificationRecordFactory();
    }
    async broadcast(request) {
        this.logger.log(`Broadcasting notification: ${request.title}`);
        const [userIds, fcmTokens] = await Promise.all([
            this.userRepository.getAllUserIds(),
            this.fcmRepository.getActiveTokens(),
        ]);
        if (userIds.length === 0) {
            this.logger.warn("No users registered in the system to notify.");
        }
        const records = userIds.map((userId) => this.recordFactory.create(userId, request));
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
    async broadcastToUsers(userIds, request, pushUserIds) {
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
exports.NotificationDispatcher = NotificationDispatcher;
//# sourceMappingURL=notification-dispatcher.js.map