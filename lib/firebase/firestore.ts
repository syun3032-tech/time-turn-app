import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './config'
import type {
  Goal,
  Project,
  Milestone,
  Task,
  MicroTask,
  ChatMessage,
  DailyLog,
  UserProfile,
  CompletedTask,
  Conversation,
  ConversationMessage,
  HearingProgress,
  HearingSummary,
  UserKnowledge
} from './firestore-types'

// Timestamp変換ヘルパー
const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return new Date()
}

/**
 * Goals
 */
export async function createGoal(userId: string, data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'goals'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function getGoals(userId: string): Promise<Goal[]> {
  const q = query(collection(db, 'goals'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt)
  } as Goal))
}

export async function updateGoal(goalId: string, data: Partial<Goal>) {
  const docRef = doc(db, 'goals', goalId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteGoal(goalId: string) {
  await deleteDoc(doc(db, 'goals', goalId))
}

/**
 * Projects
 */
export async function createProject(userId: string, data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'projects'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function getProjects(userId: string, goalId?: string): Promise<Project[]> {
  let q = query(collection(db, 'projects'), where('userId', '==', userId))
  if (goalId) {
    q = query(q, where('goalId', '==', goalId))
  }
  q = query(q, orderBy('orderIndex', 'asc'))

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt)
  } as Project))
}

export async function updateProject(projectId: string, data: Partial<Project>) {
  await updateDoc(doc(db, 'projects', projectId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, 'projects', projectId))
}

/**
 * Milestones
 */
export async function createMilestone(userId: string, data: Omit<Milestone, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'milestones'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function getMilestones(userId: string, projectId?: string): Promise<Milestone[]> {
  let q = query(collection(db, 'milestones'), where('userId', '==', userId))
  if (projectId) {
    q = query(q, where('projectId', '==', projectId))
  }
  q = query(q, orderBy('orderIndex', 'asc'))

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt)
  } as Milestone))
}

export async function updateMilestone(milestoneId: string, data: Partial<Milestone>) {
  await updateDoc(doc(db, 'milestones', milestoneId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteMilestone(milestoneId: string) {
  await deleteDoc(doc(db, 'milestones', milestoneId))
}

/**
 * Tasks
 */
export async function createTask(userId: string, data: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function getTasks(userId: string, milestoneId?: string): Promise<Task[]> {
  let q = query(collection(db, 'tasks'), where('userId', '==', userId))
  if (milestoneId) {
    q = query(q, where('milestoneId', '==', milestoneId))
  }
  q = query(q, orderBy('orderIndex', 'asc'))

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt)
  } as Task))
}

export async function updateTask(taskId: string, data: Partial<Task>) {
  await updateDoc(doc(db, 'tasks', taskId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteTask(taskId: string) {
  await deleteDoc(doc(db, 'tasks', taskId))
}

/**
 * Chat Messages
 */
export async function saveChatMessage(userId: string, role: 'user' | 'assistant', content: string) {
  const docRef = await addDoc(collection(db, 'chatMessages'), {
    userId,
    role,
    content,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

export async function getChatMessages(userId: string, limitCount: number = 100): Promise<ChatMessage[]> {
  const q = query(
    collection(db, 'chatMessages'),
    where('userId', '==', userId),
    limit(limitCount)
  )
  const snapshot = await getDocs(q)

  // クライアントサイドでソート
  const messages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt)
  } as ChatMessage))

  // createdAtでソート
  return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function clearChatHistory(userId: string) {
  const q = query(collection(db, 'chatMessages'), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)
}

/**
 * Completed Tasks
 */
export async function saveCompletedTask(
  userId: string,
  data: Omit<CompletedTask, 'id' | 'userId' | 'createdAt'>
) {
  const docRef = await addDoc(collection(db, 'completedTasks'), {
    ...data,
    userId,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

export async function getCompletedTasks(userId: string, limitCount: number = 50): Promise<CompletedTask[]> {
  const q = query(
    collection(db, 'completedTasks'),
    where('userId', '==', userId),
    limit(limitCount)
  )
  const snapshot = await getDocs(q)

  const tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    completedAt: toDate(doc.data().completedAt),
    createdAt: toDate(doc.data().createdAt)
  } as CompletedTask))

  // completedAtでソート（新しい順）
  return tasks.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
}

export async function deleteCompletedTaskByTaskId(userId: string, taskId: string): Promise<void> {
  const q = query(
    collection(db, 'completedTasks'),
    where('userId', '==', userId),
    where('taskId', '==', taskId)
  )
  const snapshot = await getDocs(q)
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)
}

/**
 * User Profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'userProfiles', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return {
    ...docSnap.data(),
    createdAt: toDate(docSnap.data().createdAt),
    updatedAt: toDate(docSnap.data().updatedAt)
  } as UserProfile
}

export async function createUserProfile(
  userId: string,
  email: string,
  data: Partial<Omit<UserProfile, 'uid' | 'email' | 'createdAt' | 'updatedAt'>>
) {
  const docRef = doc(db, 'userProfiles', userId)
  await setDoc(docRef, {
    uid: userId,
    email,
    ...data,
    profileCompleted: data.profileCompleted ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Omit<UserProfile, 'uid' | 'email' | 'createdAt' | 'updatedAt'>>
) {
  const docRef = doc(db, 'userProfiles', userId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

/**
 * Task Tree (タスクツリー全体をユーザーごとに保存)
 */
export async function getTaskTreeFromFirestore(userId: string): Promise<any[] | null> {
  const docRef = doc(db, 'taskTrees', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return docSnap.data().tree || []
}

export async function saveTaskTreeToFirestore(userId: string, tree: any[]): Promise<void> {
  const docRef = doc(db, 'taskTrees', userId)
  await setDoc(docRef, {
    tree,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

/**
 * Usage Tracking（API利用制限）
 * @see lib/usage-config.ts
 * @see docs/USAGE_LIMIT.md
 */
import { getTodayDateString, USAGE_LIMITS } from '../usage-config'

export interface UsageData {
  date: string
  count: number
  limit: number
  updatedAt?: Date
}

/**
 * ユーザーの今日の利用状況を取得
 */
export async function getUserUsage(userId: string): Promise<UsageData> {
  const today = getTodayDateString()
  const docRef = doc(db, 'userUsage', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return {
      date: today,
      count: 0,
      limit: USAGE_LIMITS.DAILY_MESSAGE_LIMIT,
    }
  }

  const data = docSnap.data()

  // 日付が変わっていたらリセット
  if (data.date !== today) {
    return {
      date: today,
      count: 0,
      limit: USAGE_LIMITS.DAILY_MESSAGE_LIMIT,
    }
  }

  return {
    date: data.date,
    count: data.count || 0,
    limit: USAGE_LIMITS.DAILY_MESSAGE_LIMIT,
    updatedAt: toDate(data.updatedAt),
  }
}

/**
 * 利用回数をインクリメント
 */
export async function incrementUsage(userId: string): Promise<UsageData> {
  const today = getTodayDateString()
  const docRef = doc(db, 'userUsage', userId)
  const docSnap = await getDoc(docRef)

  let newCount = 1

  if (docSnap.exists()) {
    const data = docSnap.data()
    // 日付が同じなら加算、違うならリセット
    if (data.date === today) {
      newCount = (data.count || 0) + 1
    }
  }

  await setDoc(docRef, {
    date: today,
    count: newCount,
    updatedAt: serverTimestamp(),
  })

  return {
    date: today,
    count: newCount,
    limit: USAGE_LIMITS.DAILY_MESSAGE_LIMIT,
  }
}

/**
 * 利用制限に達しているかチェック
 */
export async function checkUsageLimit(userId: string): Promise<{
  isLimitReached: boolean
  usage: UsageData
}> {
  const usage = await getUserUsage(userId)
  return {
    isLimitReached: usage.count >= USAGE_LIMITS.DAILY_MESSAGE_LIMIT,
    usage,
  }
}

/**
 * Login Streak（連続ログイン日数）
 * ログイン時に呼び出して連続日数を更新
 */
export interface LoginStreakData {
  lastLoginDate: string
  loginStreak: number
}

/**
 * ログイン時に連続日数を更新
 * - 今日既にログイン済み → 何もしない
 * - 昨日ログインしてた → streak + 1
 * - 2日以上空いた → streak = 1 にリセット
 */
export async function updateLoginStreak(userId: string): Promise<LoginStreakData> {
  const today = getTodayDateString()
  const docRef = doc(db, 'userUsage', userId)
  const docSnap = await getDoc(docRef)

  // 昨日の日付を計算
  const todayDate = new Date()
  const jstOffset = 9 * 60
  const utc = todayDate.getTime() + (todayDate.getTimezoneOffset() * 60000)
  const jstDate = new Date(utc + (jstOffset * 60000))
  jstDate.setDate(jstDate.getDate() - 1)
  const yesterday = jstDate.toISOString().split('T')[0]

  let lastLoginDate = ''
  let loginStreak = 1

  if (docSnap.exists()) {
    const data = docSnap.data()
    lastLoginDate = data.lastLoginDate || ''
    loginStreak = data.loginStreak || 1

    // 今日既にログイン済み → 何もしない
    if (lastLoginDate === today) {
      return { lastLoginDate, loginStreak }
    }

    // 昨日ログインしてた → streak + 1
    if (lastLoginDate === yesterday) {
      loginStreak = loginStreak + 1
    } else {
      // 2日以上空いた → リセット
      loginStreak = 1
    }
  }

  // 更新
  await setDoc(docRef, {
    lastLoginDate: today,
    loginStreak,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  return { lastLoginDate: today, loginStreak }
}

/**
 * 連続ログイン日数を取得（表示用）
 */
export async function getLoginStreak(userId: string): Promise<LoginStreakData> {
  const today = getTodayDateString()
  const docRef = doc(db, 'userUsage', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return { lastLoginDate: '', loginStreak: 0 }
  }

  const data = docSnap.data()
  const lastLoginDate = data.lastLoginDate || ''
  let loginStreak = data.loginStreak || 0

  // 昨日の日付を計算
  const todayDate = new Date()
  const jstOffset = 9 * 60
  const utc = todayDate.getTime() + (todayDate.getTimezoneOffset() * 60000)
  const jstDate = new Date(utc + (jstOffset * 60000))
  jstDate.setDate(jstDate.getDate() - 1)
  const yesterday = jstDate.toISOString().split('T')[0]

  // 今日か昨日以外の場合は0を返す（連続が途切れている）
  if (lastLoginDate !== today && lastLoginDate !== yesterday) {
    loginStreak = 0
  }

  return { lastLoginDate, loginStreak }
}

/**
 * Conversations（会話履歴）
 */

/**
 * 新規会話を作成
 */
export async function createConversation(
  userId: string,
  title: string = '新しい会話'
): Promise<string> {
  const docRef = await addDoc(collection(db, 'conversations'), {
    userId,
    title,
    isCustomTitle: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

/**
 * ユーザーの会話一覧を取得
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  // インデックス不要：クライアント側でソート
  const q = query(
    collection(db, 'conversations'),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  const conversations = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt),
  } as Conversation))

  // updatedAtで降順ソート
  return conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

/**
 * 会話のタイトルを更新
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
  isCustomTitle: boolean = true
): Promise<void> {
  const docRef = doc(db, 'conversations', conversationId)
  await updateDoc(docRef, {
    title,
    isCustomTitle,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 会話のヒアリング状態を更新
 */
export async function updateConversationHearingState(
  conversationId: string,
  state: {
    taskBreakdownStage?: 'normal' | 'hearing' | 'proposal' | 'output'
    hearingProgress?: HearingProgress
    hearingSummary?: HearingSummary
  }
): Promise<void> {
  const docRef = doc(db, 'conversations', conversationId)
  await updateDoc(docRef, {
    ...state,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 会話にメッセージを追加
 */
export async function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<string> {
  // メッセージを追加
  const messagesRef = collection(db, 'conversations', conversationId, 'messages')
  const docRef = await addDoc(messagesRef, {
    role,
    content,
    createdAt: serverTimestamp(),
  })

  // 会話のupdatedAtを更新
  const convRef = doc(db, 'conversations', conversationId)
  await updateDoc(convRef, {
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

/**
 * 会話のメッセージ一覧を取得
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    conversationId,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
  } as ConversationMessage))
}

/**
 * 会話を削除
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  // サブコレクションのメッセージも削除
  const messagesRef = collection(db, 'conversations', conversationId, 'messages')
  const messagesSnapshot = await getDocs(messagesRef)
  const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)

  // 会話本体を削除
  await deleteDoc(doc(db, 'conversations', conversationId))
}

/**
 * 会話に目標を紐づけ
 */
export async function linkConversationToGoal(
  conversationId: string,
  goalId: string
): Promise<void> {
  const docRef = doc(db, 'conversations', conversationId)
  await updateDoc(docRef, {
    goalId,
    updatedAt: serverTimestamp(),
  })
}

// ============================================
// User Knowledge（ユーザー理解のためのナレッジ）
// ============================================

/**
 * ユーザーナレッジを取得
 */
export async function getUserKnowledge(userId: string): Promise<UserKnowledge | null> {
  const docRef = doc(db, 'userKnowledge', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  const data = docSnap.data()
  return {
    userId,
    interests: data.interests || [],
    experiences: data.experiences || [],
    personality: data.personality || [],
    challenges: data.challenges || [],
    goals: data.goals || [],
    context: data.context || [],
    updatedAt: toDate(data.updatedAt),
  }
}

/**
 * ユーザーナレッジを更新（マージ）
 * 新しい情報を既存の情報にマージする
 */
export async function updateUserKnowledge(
  userId: string,
  newKnowledge: Partial<Omit<UserKnowledge, 'userId' | 'updatedAt'>>
): Promise<void> {
  const docRef = doc(db, 'userKnowledge', userId)
  const existing = await getUserKnowledge(userId)

  // 既存の情報とマージ（重複を除去）
  const mergeArrays = (existing: string[], newItems: string[]): string[] => {
    const combined = [...existing, ...newItems]
    // 重複を除去し、最新の10件に制限
    return [...new Set(combined)].slice(-10)
  }

  const mergedData = {
    interests: mergeArrays(existing?.interests || [], newKnowledge.interests || []),
    experiences: mergeArrays(existing?.experiences || [], newKnowledge.experiences || []),
    personality: mergeArrays(existing?.personality || [], newKnowledge.personality || []),
    challenges: mergeArrays(existing?.challenges || [], newKnowledge.challenges || []),
    goals: mergeArrays(existing?.goals || [], newKnowledge.goals || []),
    context: mergeArrays(existing?.context || [], newKnowledge.context || []),
    updatedAt: serverTimestamp(),
  }

  await setDoc(docRef, mergedData, { merge: true })
}

/**
 * ユーザーナレッジをプロンプト用に整形
 */
export function formatKnowledgeForPrompt(knowledge: UserKnowledge | null): string {
  if (!knowledge) return ''

  const sections: string[] = []

  if (knowledge.interests.length > 0) {
    sections.push(`興味・関心: ${knowledge.interests.join('、')}`)
  }
  if (knowledge.experiences.length > 0) {
    sections.push(`経験・スキル: ${knowledge.experiences.join('、')}`)
  }
  if (knowledge.personality.length > 0) {
    sections.push(`性格・特性: ${knowledge.personality.join('、')}`)
  }
  if (knowledge.challenges.length > 0) {
    sections.push(`課題・苦手: ${knowledge.challenges.join('、')}`)
  }
  if (knowledge.goals.length > 0) {
    sections.push(`将来の目標: ${knowledge.goals.join('、')}`)
  }
  if (knowledge.context.length > 0) {
    sections.push(`背景: ${knowledge.context.join('、')}`)
  }

  if (sections.length === 0) return ''

  return `
【ユーザーについて知っていること】
${sections.join('\n')}
※この情報を踏まえて、パーソナライズされた会話をしてください。
`
}
