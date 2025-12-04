import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBgalHuBt58yfx-Y-KDuKjkBSqEaZTPLOo",
  authDomain: "timeturn-fde25.firebaseapp.com",
  projectId: "timeturn-fde25",
  storageBucket: "timeturn-fde25.firebasestorage.app",
  messagingSenderId: "463816906746",
  appId: "1:463816906746:web:48622dc475dc975fb4b643",
  measurementId: "G-EK1WM1T74E"
};

// Initialize Firebase (シングルトンパターン)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
