import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin, messagingAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { title, body, url, userId } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Si se proporciona userId, enviar solo a ese usuario
    // Si no, enviar a todos los usuarios con notificaciones habilitadas
    let targetUserIds: string[] = [];

    if (userId) {
      targetUserIds = [userId];
    } else {
      // Get all users from Firestore
      const usersSnapshot = await firestoreAdmin
        .collection('c_users')
        .get();

      // Filter users with notifications enabled
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        // Por defecto las notificaciones están activas (notificationsEnabled !== false)
        const notificationsEnabled = userData.notificationsEnabled !== false;

        if (notificationsEnabled) {
          targetUserIds.push(doc.id);
        }
      });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay usuarios con notificaciones habilitadas',
        sentCount: 0,
        failedCount: 0,
      });
    }

    // Get FCM tokens for target users
    const tokensSnapshot = await firestoreAdmin
      .collection('c_push_subscriptions')
      .where('userId', 'in', targetUserIds)
      .get();

    const tokens: string[] = [];
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay tokens FCM registrados para los usuarios objetivo',
        sentCount: 0,
        failedCount: 0,
      });
    }

    // Send push notifications using FCM
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        url: url || '/',
      },
      tokens,
    };

    const response = await messagingAdmin.sendEachForMulticast(message);

    console.log(`Successfully sent ${response.successCount} notifications`);
    console.log(`Failed to send ${response.failureCount} notifications`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error('Failed to send to token:', tokens[idx], resp.error);
        }
      });

      // Remove invalid tokens from Firestore
      const batch = firestoreAdmin.batch();
      for (const token of failedTokens) {
        const tokenDocs = await firestoreAdmin
          .collection('c_push_subscriptions')
          .where('fcmToken', '==', token)
          .get();

        tokenDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Notificaciones enviadas: ${response.successCount} exitosas, ${response.failureCount} fallidas`,
      sentCount: response.successCount,
      failedCount: response.failureCount,
    });
  } catch (error) {
    console.error('Error in send-fcm-notification API:', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
