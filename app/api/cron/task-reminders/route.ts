import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  TASK_REMINDER_MESSAGES,
  OVERDUE_TASK_MESSAGES,
  getRandomMessage,
  formatTaskMessage,
} from "@/lib/notifications/messages";

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    // Use service account credentials from environment
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      console.warn("Firebase Admin: No service account credentials found");
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
  // Verify this is a legitimate cron request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirestore();
    const messaging = getMessaging();
    const now = new Date();

    // Get users with FCM tokens and notification settings enabled
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

      // Check if task reminders are enabled
      if (!notificationSettings?.taskReminders) {
        continue;
      }

      // Check quiet hours
      if (isQuietHours(notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd)) {
        continue;
      }

      // Get incomplete tasks for this user
      const tasksSnapshot = await db
        .collection("tasks")
        .where("userId", "==", userId)
        .where("status", "in", ["未着手", "進行中"])
        .limit(5)
        .get();

      if (tasksSnapshot.empty) {
        continue;
      }

      // Find overdue or upcoming tasks
      interface TaskData {
        id: string;
        title?: string;
        deadline?: string;
        status?: string;
      }

      const incompleteTasks: TaskData[] = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TaskData));

      const overdueTasks = incompleteTasks.filter(task => {
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline);
        return deadline < now;
      });

      // Choose appropriate message
      let title: string;
      let body: string;

      if (overdueTasks.length > 0) {
        const task = overdueTasks[0];
        const template = getRandomMessage(OVERDUE_TASK_MESSAGES);
        title = "期限切れタスクがあるよ！";
        body = formatTaskMessage(template, task.title || "タスク");
      } else {
        const task = incompleteTasks[0];
        const template = getRandomMessage(TASK_REMINDER_MESSAGES);
        title = "タスクリマインド";
        body = formatTaskMessage(template, task.title || "タスク");
      }

      // Send notification to all user's devices
      for (const token of fcmTokens) {
        const notificationPromise = messaging.send({
          token,
          notification: {
            title,
            body,
          },
          data: {
            type: "task_reminder",
            userId,
            tag: "task-reminder",
          },
          webpush: {
            notification: {
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
            },
          },
        }).catch(error => {
          console.error(`Failed to send notification to token ${token}:`, error);
          // Remove invalid tokens
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
      message: `Processed ${notifications.length} notifications`,
    });
  } catch (error) {
    console.error("Task reminder cron error:", error);
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

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}
