import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth as getFirebaseAuthInstance, Auth } from "firebase/auth";
import { getFirestore as getFirebaseFirestoreInstance, Firestore } from "firebase/firestore";

// 環境変数からFirebase設定を読み込み
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 設定が不足している場合の警告
if (typeof window !== 'undefined') {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  if (missingKeys.length > 0) {
    console.error(`Firebase config missing: ${missingKeys.join(', ')}. Check your environment variables.`);
  }
}

// Lazy initialization - only on client side
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function initializeFirebase() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!app && firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    authInstance = getFirebaseAuthInstance(app);
    dbInstance = getFirebaseFirestoreInstance(app);
  }
}

// Initialize on import (client side only)
if (typeof window !== 'undefined') {
  initializeFirebase();
}

export function getAuth(): Auth {
  if (!authInstance) {
    initializeFirebase();
    if (!authInstance) {
      throw new Error('Firebase auth not initialized. Check your environment variables.');
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    initializeFirebase();
    if (!dbInstance) {
      throw new Error('Firebase firestore not initialized. Check your environment variables.');
    }
  }
  return dbInstance;
}

export const auth = typeof window !== 'undefined' ? getAuth() : undefined as any;
export const db = typeof window !== 'undefined' ? getDb() : undefined as any;

export function getApp(): FirebaseApp | undefined {
  if (!app) {
    initializeFirebase();
  }
  return app;
}

export default app;
