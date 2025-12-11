import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth as getFirebaseAuthInstance, Auth } from "firebase/auth";
import { getFirestore as getFirebaseFirestoreInstance, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBgalHuBt58yfx-Y-KDuKjkBSqEaZTPLOo",
  authDomain: "timeturn-fde25.firebaseapp.com",
  projectId: "timeturn-fde25",
  storageBucket: "timeturn-fde25.firebasestorage.app",
  messagingSenderId: "463816906746",
  appId: "1:463816906746:web:48622dc475dc975fb4b643",
  measurementId: "G-EK1WM1T74E"
};

// Lazy initialization - only on client side
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function initializeFirebase() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!app) {
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
      throw new Error('Firebase auth not initialized');
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    initializeFirebase();
    if (!dbInstance) {
      throw new Error('Firebase firestore not initialized');
    }
  }
  return dbInstance;
}

export const auth = typeof window !== 'undefined' ? getAuth() : undefined as any;
export const db = typeof window !== 'undefined' ? getDb() : undefined as any;
export default app;
