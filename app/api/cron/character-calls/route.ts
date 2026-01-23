import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  CHARACTER_CALL_MESSAGES,
  PROGRESS_BASED_MESSAGES,
  getRandomMessage,
  getTimeOfDay,
  getProgressLevel,
} from "@/lib/notifications/messages";

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirestore();
    const messaging = getMessaging();
    const timeOfDay = getTimeOfDay();
    const today = new Date().toISOString().split("T")[0];

    // Get users with FCM tokens and character calls enabled
    const usersSnapshot = await db
      .collection("users")
      .where("fcmTokens", "!=", null)
      .get();

    const notifications: Promise<void>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const fcmTokens = userData.fcmTokens || [];
      const notificationSettings = userData.notificationSettings;

      // Check if character calls are enabled
      if (!notificationSettings?.characterCalls) {
        continue;
      }

      // Check quiet hours
      if (isQuietHours(notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd)) {
        continue;
      }

      // Get today's tasks for progress calculation
      const tasksSnapshot = await db
        .collection("tasks")
        .where("userId", "==", userId)
        .get();

      const allTasks = tasksSnapshot.docs.map(doc => doc.data());
      const completedTasks = allTasks.filter(t => t.status === "完了");
      const progressLevel = getProgressLevel(completedTasks.length, allTasks.length);

      // Choose message based on time of day and progress
      const timeMessages = CHARACTER_CALL_MESSAGES[timeOfDay];
      const progressMessages = PROGRESS_BASED_MESSAGES[progressLevel];

      // Randomly choose between time-based and progress-based message
      const useProgressMessage = Math.random() > 0.5 && progressMessages;
      const body = useProgressMessage
        ? getRandomMessage(progressMessages)
        : getRandomMessage(timeMessages);

      const title = "秘書ちゃんより";

      // Send notification to all user's devices
      for (const token of fcmTokens) {
        const notificationPromise = messaging.send({
          token,
          notification: {
            title,
            body,
          },
          data: {
            type: "character_call",
            userId,
            tag: "character-call",
            timeOfDay,
          },
          webpush: {
            notification: {
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
            },
          },
        }).catch(error => {
          console.error(`Failed to send notification to token ${token}:`, error);
          if (error.code === 'messaging/registration-token-not-registered') {
            return db.collection("users").doc(userId).update({
              fcmTokens: userData.fcmTokens.filter((t: string) => t !== token),
            });
          }
        });

        notifications.push(notificationPromise as Promise<void>);
      }
    }

    await Promise.all(notifications);

    return NextResponse.json({
      success: true,
      message: `Sent ${notifications.length} character call notifications`,
      timeOfDay,
    });
  } catch (error) {
    console.error("Character call cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(start?: string, end?: string): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}
