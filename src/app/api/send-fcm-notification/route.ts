import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin, messagingAdmin } from '@/lib/firebase-admin';

// Firestore 'in' operator supports max 30 items
const FIRESTORE_IN_LIMIT = 30;

/**
 * Fetch FCM tokens for a list of user IDs.
 * Strategy:
 *  1. Fetch documents by document ID (userId is the doc ID)
 *  2. Fallback: query by userId field for any docs not found above
 */
async function getFCMTokensForUsers(userIds: string[]): Promise<string[]> {
  const tokens: string[] = [];
  const foundUserIds = new Set<string>();

  // Strategy 1: Direct document lookup by ID (most reliable)
  // Process in batches because getAll has no hard limit but batching is good practice
  const batchSize = 100;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const docRefs = batch.map((uid) =>
      firestoreAdmin.collection('c_push_subscriptions').doc(uid)
    );
    const docs = await firestoreAdmin.getAll(...docRefs);
    docs.forEach((d) => {
      if (d.exists) {
        const data = d.data();
        if (data?.fcmToken) {
          tokens.push(data.fcmToken as string);
          foundUserIds.add(d.id);
        }
      }
    });
  }

  // Strategy 2: Query by userId field for any remaining users
  // (covers documents stored with a different ID than the UID)
  const remainingIds = userIds.filter((uid) => !foundUserIds.has(uid));
  for (let i = 0; i < remainingIds.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = remainingIds.slice(i, i + FIRESTORE_IN_LIMIT);
    const snapshot = await firestoreAdmin
      .collection('c_push_subscriptions')
      .where('userId', 'in', chunk)
      .get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken as string);
      }
    });
  }

  // Deduplicate tokens in case a user has multiple entries
  return [...new Set(tokens)];
}

export async function POST(request: NextRequest) {
  try {
    const { title, body, url, userId } = await request.json() as {
      title?: string;
      body?: string;
      url?: string;
      userId?: string;
    };

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    let targetUserIds: string[] = [];

    if (userId) {
      targetUserIds = [userId];
    } else {
      // Broadcast: get all users with push notifications enabled
      const usersSnapshot = await firestoreAdmin.collection('c_users').get();
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        // pushNotificationsEnabled must be explicitly true
        if (userData.pushNotificationsEnabled === true) {
          targetUserIds.push(doc.id);
        }
      });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay usuarios con notificaciones push habilitadas',
        sentCount: 0,
        failedCount: 0,
      });
    }

    const tokens = await getFCMTokensForUsers(targetUserIds);

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${targetUserIds.length} usuario(s) con notificaciones activas pero sin token FCM registrado. El usuario debe activar notificaciones desde el dispositivo.`,
        sentCount: 0,
        failedCount: 0,
      });
    }

    // FCM sendEachForMulticast supports max 500 tokens per call
    const FCM_BATCH_LIMIT = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const allFailedTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
      const tokenBatch = tokens.slice(i, i + FCM_BATCH_LIMIT);
      const message = {
        notification: { title, body },
        data: { url: url ?? '/' },
        tokens: tokenBatch,
      };

      const response = await messagingAdmin.sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            allFailedTokens.push(tokenBatch[idx]);
            console.error('[FCM] Failed token:', tokenBatch[idx], resp.error?.code);
          }
        });
      }
    }

    // Clean up invalid/expired tokens
    if (allFailedTokens.length > 0) {
      const batch = firestoreAdmin.batch();
      for (const token of allFailedTokens) {
        const tokenDocs = await firestoreAdmin
          .collection('c_push_subscriptions')
          .where('fcmToken', '==', token)
          .get();
        tokenDocs.forEach((doc) => batch.delete(doc.ref));
      }
      await batch.commit();
      console.log(`[FCM] Cleaned up ${allFailedTokens.length} invalid token(s)`);
    }

    console.log(`[FCM] Sent: ${totalSuccess} ok, ${totalFailure} failed`);

    return NextResponse.json({
      success: true,
      message: `Notificaciones enviadas: ${totalSuccess} exitosas, ${totalFailure} fallidas`,
      sentCount: totalSuccess,
      failedCount: totalFailure,
    });
  } catch (error) {
    console.error('[FCM] Error in send-fcm-notification API:', error);
    return NextResponse.json(
      {
        error: 'Failed to send push notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
