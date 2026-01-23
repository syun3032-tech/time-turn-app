import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { getApp, db } from "./config";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";

let messaging: Messaging | null = null;

// VAPID key should be set from Firebase Console → Cloud Messaging → Web Push certificates
// For now, we'll use a placeholder - you need to generate this in Firebase Console
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/**
 * Initialize Firebase Messaging (client-side only)
 */
export function initMessaging(): Messaging | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!messaging) {
    try {
      const app = getApp();
      if (!app) {
        console.error("Firebase app not initialized");
        return null;
      }
      messaging = getMessaging(app);
    } catch (error) {
      console.error("Failed to initialize Firebase Messaging:", error);
      return null;
    }
  }

  return messaging;
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    const messagingInstance = initMessaging();
    if (!messagingInstance) {
      return null;
    }

    // Register the service worker first
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("FCM Token:", token);
    return token;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Save FCM token to user's Firestore document
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  if (!token) return;

  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error saving FCM token:", error);
  }
}

/**
 * Remove FCM token from user's Firestore document
 */
export async function removeFCMToken(userId: string, token: string): Promise<void> {
  if (!token) return;

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error removing FCM token:", error);
  }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: unknown) => void): () => void {
  const messagingInstance = initMessaging();
  if (!messagingInstance) {
    return () => {};
  }

  return onMessage(messagingInstance, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  return Notification.permission;
}
