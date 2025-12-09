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
class SubscriptionRepository {
    constructor(db, pushClient, logger) {
        this.db = db;
        this.pushClient = pushClient;
        this.logger = logger;
        this.collection = this.db.collection("c_push_subscriptions");
    }
    async getActiveSubscriptions() {
        const snapshot = await this.collection.get();
        const subscriptions = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            const subscription = data.subscription;
            if (subscription && subscription.endpoint) {
                subscriptions.push({
                    userId: data.userId,
                    subscription,
                });
            }
        });
        return subscriptions;
    }
    async sendToSubscribers(subscriptions, payload) {
        if (subscriptions.length === 0) {
            this.logger.log("No push subscriptions to notify.");
            return;
        }
        const serializedPayload = JSON.stringify(payload);
        const sendResults = await Promise.allSettled(subscriptions.map(({ subscription, userId }) => this.pushClient
            .sendNotification(subscription, serializedPayload)
            .catch((error) => {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
                this.logger.warn(`Subscription for user ${userId} is invalid. Consider removing it.`);
            }
            else {
                this.logger.error(`Error sending push notification to user ${userId}: ${error}`);
            }
            return null;
        })));
        const rejected = sendResults.filter((result) => result.status === "rejected");
        if (rejected.length > 0) {
            this.logger.warn(`${rejected.length} push notifications were rejected during broadcast.`);
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
    constructor(db, pushClient, logger) {
        this.logger = logger;
        this.userRepository = new UserRepository(db);
        this.notificationRepository = new NotificationRepository(db);
        this.subscriptionRepository = new SubscriptionRepository(db, pushClient, logger);
        this.recordFactory = new NotificationRecordFactory();
    }
    async broadcast(request) {
        this.logger.log(`Broadcasting notification: ${request.title}`);
        const [userIds, subscriptions] = await Promise.all([
            this.userRepository.getAllUserIds(),
            this.subscriptionRepository.getActiveSubscriptions(),
        ]);
        if (userIds.length === 0) {
            this.logger.warn("No users registered in the system to notify.");
        }
        const records = userIds.map((userId) => this.recordFactory.create(userId, request));
        const pushPayload = {
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
exports.NotificationDispatcher = NotificationDispatcher;
//# sourceMappingURL=notification-dispatcher.js.map