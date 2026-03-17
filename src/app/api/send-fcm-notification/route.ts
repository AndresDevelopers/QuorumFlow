import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin, messagingAdmin } from '@/lib/firebase-admin';

// Firestore 'in' operator supports max 30 items
const FIRESTORE_IN_LIMIT = 30;

/**
 * Fetch FCM tokens for a list of user IDs.
 * Returns every active token registered for the target users.
 */
async function getFCMTokensForUsers(userIds: string[]): Promise<string[]> {
  const tokens: string[] = [];

  for (let i = 0; i < userIds.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = userIds.slice(i, i + FIRESTORE_IN_LIMIT);
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
        data: {
          url: url ?? '/',
          title,
          body,
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title,
            body,
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: 'quorumflow-notification',
          },
          fcmOptions: {
            link: url ?? '/',
          },
        },
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
