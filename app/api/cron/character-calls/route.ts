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

/**
 * 構造化プロファイルに基づくパーソナライズされたメッセージを生成
 */
interface StructuredKnowledge {
  basicInfo?: {
    occupation?: string;
    partTimeJob?: string;
  };
  interests?: Array<{
    topic: string;
    depth: 'mention' | 'repeated' | 'passionate';
    lastMentionedAt?: { toDate?: () => Date };
  }>;
  lifestyle?: {
    busyDays?: string[];
    activeHours?: 'morning' | 'afternoon' | 'night';
    procrastination?: boolean;
  };
  recentContext?: Array<{
    summary: string;
    mood: 'good' | 'neutral' | 'low';
    date?: { toDate?: () => Date };
  }>;
  deepMotivations?: Array<{
    desire: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
}

function getProactiveMessage(
  profile: StructuredKnowledge,
  timeOfDay: string,
  progressLevel: string
): string | null {
  const now = new Date();
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  const hour = now.getHours();

  // 1. バイトの日の声かけ
  if (profile.lifestyle?.busyDays?.includes(dayOfWeek)) {
    const partTimeJob = profile.basicInfo?.partTimeJob || 'バイト';
    if (hour < 12) {
      return `今日${partTimeJob}ですよね。頑張ってください！`;
    }
    if (hour > 20) {
      return `${partTimeJob}お疲れ様でした。ゆっくり休んでくださいね。`;
    }
    if (hour >= 12 && hour <= 17) {
      return `今日は${partTimeJob}の日ですね。頑張って！`;
    }
  }

  // 2. 直近の気分が低い場合のケア
  if (profile.recentContext && profile.recentContext.length > 0) {
    const recent = profile.recentContext[0];
    if (recent.mood === 'low') {
      const messages = [
        "最近ちょっと大変そうでしたけど…無理しないでくださいね。",
        "調子どうですか？無理せず、ゆっくりいきましょう。",
        "最近忙しそうでしたね。少し休憩しませんか？",
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
    if (recent.mood === 'good') {
      const messages = [
        "最近調子良さそうですね！その調子です。",
        "いい感じですね！今日も頑張りましょう。",
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }

  // 3. 興味の話題に触れる（1週間ぶり）
  if (profile.interests && profile.interests.length > 0) {
    const passionateInterest = profile.interests.find(i => i.depth === 'passionate');
    if (passionateInterest && passionateInterest.lastMentionedAt) {
      const lastMentioned = passionateInterest.lastMentionedAt.toDate?.() || new Date(0);
      const daysSince = (now.getTime() - lastMentioned.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        return `そういえば、${passionateInterest.topic}のあの話、どうなりました？`;
      }
    }
  }

  // 4. 朝型・夜型に合わせた声かけ
  if (profile.lifestyle?.activeHours) {
    if (profile.lifestyle.activeHours === 'morning' && hour >= 5 && hour < 8) {
      return "おはようございます！今日も早起きですね。さすがです。";
    }
    if (profile.lifestyle.activeHours === 'night' && hour >= 22) {
      return "夜型さん、今日も遅くまでお疲れ様です。";
    }
  }

  // 5. ギリギリタイプへの声かけ
  if (profile.lifestyle?.procrastination && timeOfDay === "afternoon") {
    const messages = [
      "今日中にやることリスト、確認しました？",
      "ギリギリになる前に…ちょっと進めておきませんか？",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // 6. 本質的欲求に触れる（たまに）
  if (profile.deepMotivations && profile.deepMotivations.length > 0 && Math.random() < 0.2) {
    const highConfidence = profile.deepMotivations.find(m => m.confidence === 'high');
    if (highConfidence) {
      return `${highConfidence.desire}に向けて、今日も一歩ずつですね。`;
    }
  }

  // パーソナライズできなかった場合はnull
  return null;
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
    let personalizedCount = 0;

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

      // 構造化プロファイルを取得
      let body: string;
      try {
        const structuredDoc = await db.collection("structuredKnowledge").doc(userId).get();
        const structuredProfile = structuredDoc.exists ? structuredDoc.data() as StructuredKnowledge : null;

        // パーソナライズされたメッセージを試みる
        const personalizedMessage = structuredProfile
          ? getProactiveMessage(structuredProfile, timeOfDay, progressLevel)
          : null;

        if (personalizedMessage) {
          body = personalizedMessage;
          personalizedCount++;
        } else {
          // パーソナライズできない場合は従来のメッセージ
          const timeMessages = CHARACTER_CALL_MESSAGES[timeOfDay];
          const progressMessages = PROGRESS_BASED_MESSAGES[progressLevel];
          const useProgressMessage = Math.random() > 0.5 && progressMessages;
          body = useProgressMessage
            ? getRandomMessage(progressMessages)
            : getRandomMessage(timeMessages);
        }
      } catch (profileError) {
        console.error(`Failed to get structured profile for ${userId}:`, profileError);
        // フォールバック
        const timeMessages = CHARACTER_CALL_MESSAGES[timeOfDay];
        body = getRandomMessage(timeMessages);
      }

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
      message: `Sent ${notifications.length} character call notifications (${personalizedCount} personalized)`,
      timeOfDay,
      personalizedCount,
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
