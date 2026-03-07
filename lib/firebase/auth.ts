import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup
} from 'firebase/auth'
import { getAuth } from './config'

// Google Calendar API scopes
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
]

/**
 * メールアドレスでサインアップ
 */
export async function signUp(email: string, password: string) {
  try {
    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

/**
 * メールアドレスでログイン
 */
export async function signIn(email: string, password: string) {
  try {
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return { user: userCredential.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

/**
 * Googleでログイン（カレンダースコープ付き）
 */
export async function signInWithGoogle() {
  try {
    const auth = getAuth();
    const provider = new GoogleAuthProvider()
    // カレンダーアクセスのスコープを追加
    CALENDAR_SCOPES.forEach(scope => provider.addScope(scope))
    const userCredential = await signInWithPopup(auth, provider)
    // Google OAuthアクセストークンを取得
    const credential = GoogleAuthProvider.credentialFromResult(userCredential)
    const accessToken = credential?.accessToken || null
    return { user: userCredential.user, accessToken, error: null }
  } catch (error: any) {
    return { user: null, accessToken: null, error: error.message }
  }
}

/**
 * Googleカレンダーを接続（既存ユーザー用・再認証でトークン取得）
 */
export async function connectGoogleCalendar() {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser
    if (!currentUser) {
      return { accessToken: null, error: 'ログインしていません' }
    }
    const provider = new GoogleAuthProvider()
    CALENDAR_SCOPES.forEach(scope => provider.addScope(scope))
    // 再認証でカレンダースコープ付きトークンを取得
    const result = await reauthenticateWithPopup(currentUser, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    const accessToken = credential?.accessToken || null
    return { accessToken, error: null }
  } catch (error: any) {
    // reauthenticateが失敗する場合はsignInWithPopupで再試行
    if (error.code === 'auth/user-mismatch') {
      try {
        const authInstance = getAuth();
        const provider = new GoogleAuthProvider()
        CALENDAR_SCOPES.forEach(scope => provider.addScope(scope))
        const result = await signInWithPopup(authInstance, provider)
        const credential = GoogleAuthProvider.credentialFromResult(result)
        const accessToken = credential?.accessToken || null
        return { accessToken, error: null }
      } catch (retryError: any) {
        return { accessToken: null, error: retryError.message }
      }
    }
    return { accessToken: null, error: error.message }
  }
}

/**
 * ログアウト
 */
export async function signOut() {
  try {
    const auth = getAuth();
    await firebaseSignOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser(): User | null {
  const auth = getAuth();
  return auth.currentUser
}

/**
 * 認証状態の変更を監視
 */
export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getAuth();
  return onAuthStateChanged(auth, callback)
}
