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
  StructuredUserKnowledge,
  ExtractedStructuredKnowledge,
  UserPromise
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
  title: string = '新しい会話',
  source: 'mini' | 'main' = 'main'
): Promise<string> {
  const docRef = await addDoc(collection(db, 'conversations'), {
    userId,
    title,
    isCustomTitle: false,
    source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

/**
 * ユーザーの会話一覧を取得
 * @param source - フィルタオプション: 'mini'=ミニ秘書のみ, 'main'=メインのみ, 'all'または未指定=全て
 */
export async function getConversations(
  userId: string,
  source?: 'mini' | 'main' | 'all'
): Promise<Conversation[]> {
  // インデックス不要：クライアント側でソート
  const q = query(
    collection(db, 'conversations'),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  let conversations = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt),
  } as Conversation))

  // sourceでフィルタ（指定された場合のみ）
  if (source && source !== 'all') {
    conversations = conversations.filter(c => c.source === source)
  }

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
// Structured User Knowledge（構造化ユーザーナレッジ）
// ============================================

/**
 * 構造化ユーザーナレッジを取得
 */
export async function getStructuredKnowledge(userId: string): Promise<StructuredUserKnowledge | null> {
  const docRef = doc(db, 'structuredKnowledge', userId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  const data = docSnap.data()

  // Timestamp -> Date変換
  const convertInterests = (interests: any[]): StructuredUserKnowledge['interests'] => {
    return (interests || []).map(i => ({
      ...i,
      firstMentionedAt: toDate(i.firstMentionedAt),
      lastMentionedAt: toDate(i.lastMentionedAt),
    }))
  }

  const convertDeepMotivations = (motivations: any[]): StructuredUserKnowledge['deepMotivations'] => {
    return (motivations || []).map(m => ({
      ...m,
      detectedAt: toDate(m.detectedAt),
    }))
  }

  const convertRecentContext = (contexts: any[]): StructuredUserKnowledge['recentContext'] => {
    return (contexts || []).map(c => ({
      ...c,
      date: toDate(c.date),
    }))
  }

  return {
    userId,
    basicInfo: data.basicInfo || {},
    interests: convertInterests(data.interests),
    deepMotivations: convertDeepMotivations(data.deepMotivations),
    lifestyle: data.lifestyle || {},
    emotionalPatterns: data.emotionalPatterns || [],
    recentContext: convertRecentContext(data.recentContext),
    skills: data.skills || [],
    personalityTraits: data.personalityTraits || [],
    struggles: data.struggles || [],
    concreteGoals: data.concreteGoals || [],
    preferences: data.preferences || [],
    interests_legacy: data.interests_legacy || [],
    experiences: data.experiences || [],
    personality: data.personality || [],
    challenges: data.challenges || [],
    goals: data.goals || [],
    context: data.context || [],
    updatedAt: toDate(data.updatedAt),
  }
}

/**
 * 構造化ユーザーナレッジを更新（マージ）
 * 新しい情報を既存の情報にマージする
 */
export async function updateStructuredKnowledge(
  userId: string,
  extracted: ExtractedStructuredKnowledge
): Promise<void> {
  const docRef = doc(db, 'structuredKnowledge', userId)
  const existing = await getStructuredKnowledge(userId)
  const now = new Date()

  // 基本情報のマージ
  const mergedBasicInfo = {
    ...(existing?.basicInfo || {}),
    ...(extracted.basicInfo || {}),
  }

  // 興味のマージ（重複トピックは更新、新規は追加）
  const mergedInterests = mergeInterests(
    existing?.interests || [],
    extracted.interests || [],
    now
  )

  // 本質的欲求のマージ（重複は更新、新規は追加）
  const mergedDeepMotivations = mergeDeepMotivations(
    existing?.deepMotivations || [],
    extracted.deepMotivations || [],
    now
  )

  // 生活パターンのマージ
  const mergedLifestyle = {
    ...(existing?.lifestyle || {}),
    ...(extracted.lifestyle || {}),
  }

  // 感情パターンのマージ（最大10件）
  const mergedEmotionalPatterns = mergeEmotionalPatterns(
    existing?.emotionalPatterns || [],
    extracted.emotionalPatterns || []
  )

  // 直近コンテキストの追加（最大5件、古いものから削除）
  const mergedRecentContext = mergeRecentContext(
    existing?.recentContext || [],
    extracted.recentContext,
    now
  )

  // スキルのマージ（重複は更新、新規は追加、最大15件）
  const mergedSkills = mergeSimpleArray(
    existing?.skills || [],
    extracted.skills || [],
    'skill',
    15
  )

  // 性格特性のマージ（重複は更新、新規は追加、最大10件）
  const mergedPersonalityTraits = mergeSimpleArray(
    existing?.personalityTraits || [],
    extracted.personalityTraits || [],
    'trait',
    10
  )

  // 課題のマージ（重複は更新、新規は追加、最大10件）
  const mergedStruggles = mergeSimpleArray(
    existing?.struggles || [],
    extracted.struggles || [],
    'area',
    10
  )

  // 具体的目標のマージ（重複は更新、新規は追加、最大10件）
  const mergedConcreteGoals = mergeConcreteGoals(
    existing?.concreteGoals || [],
    extracted.concreteGoals || []
  )

  // 好みのマージ（矛盾があれば上書き＝最新の発言を優先、最大15件）
  const mergedPreferences = mergePreferences(
    existing?.preferences || [],
    extracted.preferences || []
  )

  const mergedData: Partial<StructuredUserKnowledge> = {
    basicInfo: mergedBasicInfo,
    interests: mergedInterests,
    deepMotivations: mergedDeepMotivations,
    lifestyle: mergedLifestyle,
    emotionalPatterns: mergedEmotionalPatterns,
    recentContext: mergedRecentContext,
    skills: mergedSkills,
    personalityTraits: mergedPersonalityTraits,
    struggles: mergedStruggles,
    concreteGoals: mergedConcreteGoals,
    preferences: mergedPreferences,
    updatedAt: now,
  }

  await setDoc(docRef, mergedData, { merge: true })
}

/**
 * 興味のマージロジック
 * - 同じトピックは深度・言及回数を更新
 * - 新規トピックは追加
 * - 最大20件に制限
 */
function mergeInterests(
  existing: StructuredUserKnowledge['interests'],
  newItems: NonNullable<ExtractedStructuredKnowledge['interests']>,
  now: Date
): StructuredUserKnowledge['interests'] {
  const merged = [...existing]

  for (const newItem of newItems) {
    const existingIndex = merged.findIndex(e => e.topic === newItem.topic)

    if (existingIndex >= 0) {
      // 既存トピックの更新
      const existingItem = merged[existingIndex]
      const newMentionCount = (existingItem.mentionCount || 1) + 1

      // 深度の自動アップグレード
      let newDepth = existingItem.depth
      if (newMentionCount >= 5) {
        newDepth = 'passionate'
      } else if (newMentionCount >= 3) {
        newDepth = 'repeated'
      }
      // 明示的に指定された深度があればそれを優先
      if (newItem.depth === 'passionate') {
        newDepth = 'passionate'
      }

      merged[existingIndex] = {
        ...existingItem,
        motivation: newItem.motivation || existingItem.motivation,
        depth: newDepth,
        lastMentionedAt: now,
        mentionCount: newMentionCount,
      }
    } else {
      // 新規トピックの追加
      merged.push({
        topic: newItem.topic,
        motivation: newItem.motivation,
        depth: newItem.depth || 'mention',
        firstMentionedAt: now,
        lastMentionedAt: now,
        mentionCount: 1,
      })
    }
  }

  // 最大20件に制限（最後に言及されたものを優先）
  return merged
    .sort((a, b) => b.lastMentionedAt.getTime() - a.lastMentionedAt.getTime())
    .slice(0, 20)
}

/**
 * 本質的欲求のマージロジック
 * - 同じ欲求は確信度を更新
 * - 新規は追加
 * - 最大10件に制限
 */
function mergeDeepMotivations(
  existing: StructuredUserKnowledge['deepMotivations'],
  newItems: NonNullable<ExtractedStructuredKnowledge['deepMotivations']>,
  now: Date
): StructuredUserKnowledge['deepMotivations'] {
  const merged = [...existing]

  for (const newItem of newItems) {
    const existingIndex = merged.findIndex(e => e.desire === newItem.desire)

    if (existingIndex >= 0) {
      // 既存欲求の確信度を上げる
      const existingItem = merged[existingIndex]
      let newConfidence = existingItem.confidence
      if (existingItem.confidence === 'low') {
        newConfidence = 'medium'
      } else if (existingItem.confidence === 'medium') {
        newConfidence = 'high'
      }
      // 明示的に指定された確信度があればそれを優先
      if (newItem.confidence === 'high') {
        newConfidence = 'high'
      }

      merged[existingIndex] = {
        ...existingItem,
        derivedFrom: newItem.derivedFrom || existingItem.derivedFrom,
        confidence: newConfidence,
      }
    } else {
      // 新規欲求の追加
      merged.push({
        desire: newItem.desire,
        derivedFrom: newItem.derivedFrom,
        confidence: newItem.confidence || 'low',
        detectedAt: now,
      })
    }
  }

  // 最大10件に制限（高確信度を優先）
  const confidenceOrder = { high: 0, medium: 1, low: 2 }
  return merged
    .sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])
    .slice(0, 10)
}

/**
 * 感情パターンのマージロジック
 * - 同じトリガーは更新
 * - 新規は追加
 * - 最大10件に制限
 */
function mergeEmotionalPatterns(
  existing: StructuredUserKnowledge['emotionalPatterns'],
  newItems: NonNullable<ExtractedStructuredKnowledge['emotionalPatterns']>
): StructuredUserKnowledge['emotionalPatterns'] {
  const merged = [...existing]

  for (const newItem of newItems) {
    const existingIndex = merged.findIndex(e => e.trigger === newItem.trigger)

    if (existingIndex >= 0) {
      // 既存パターンの更新
      merged[existingIndex] = {
        ...merged[existingIndex],
        reaction: newItem.reaction || merged[existingIndex].reaction,
        effectiveResponse: newItem.effectiveResponse || merged[existingIndex].effectiveResponse,
      }
    } else {
      // 新規パターンの追加
      merged.push({
        trigger: newItem.trigger,
        reaction: newItem.reaction,
        effectiveResponse: newItem.effectiveResponse || '',
      })
    }
  }

  // 最大10件に制限
  return merged.slice(-10)
}

/**
 * 直近コンテキストのマージロジック
 * - 新しいコンテキストを先頭に追加
 * - 最大5件に制限
 */
function mergeRecentContext(
  existing: StructuredUserKnowledge['recentContext'],
  newItem: ExtractedStructuredKnowledge['recentContext'] | undefined,
  now: Date
): StructuredUserKnowledge['recentContext'] {
  if (!newItem) return existing

  const newContext = {
    date: now,
    summary: newItem.summary,
    mood: newItem.mood,
  }

  // 新しいコンテキストを先頭に追加し、最大5件に制限
  return [newContext, ...existing].slice(0, 5)
}

/**
 * 汎用的な配列マージ（キーフィールドで重複判定）
 * 同じキーのものは新しい情報で上書き、新規は追加
 */
function mergeSimpleArray<T extends Record<string, any>>(
  existing: T[],
  newItems: T[],
  keyField: keyof T,
  maxItems: number
): T[] {
  const merged = [...existing]

  for (const newItem of newItems) {
    const existingIndex = merged.findIndex(e => e[keyField] === newItem[keyField])
    if (existingIndex >= 0) {
      // 既存を更新（新しい情報で上書き）
      merged[existingIndex] = { ...merged[existingIndex], ...newItem }
    } else {
      merged.push(newItem)
    }
  }

  return merged.slice(-maxItems)
}

/**
 * 具体的目標のマージ
 * 同じ目標は更新、新規は追加、最大10件
 */
function mergeConcreteGoals(
  existing: StructuredUserKnowledge['concreteGoals'],
  newItems: NonNullable<ExtractedStructuredKnowledge['concreteGoals']>
): StructuredUserKnowledge['concreteGoals'] {
  const merged = [...existing]

  for (const newItem of newItems) {
    const existingIndex = merged.findIndex(e => e.goal === newItem.goal)
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        deadline: newItem.deadline || merged[existingIndex].deadline,
      }
    } else {
      merged.push({
        goal: newItem.goal,
        deadline: newItem.deadline,
        status: 'active',
      })
    }
  }

  return merged.slice(-10)
}

/**
 * 好み・嗜好のマージ
 * 同じカテゴリ+同じものは最新のsentimentで上書き（矛盾解消）
 * 最大15件
 */
function mergePreferences(
  existing: StructuredUserKnowledge['preferences'],
  newItems: NonNullable<ExtractedStructuredKnowledge['preferences']>
): StructuredUserKnowledge['preferences'] {
  const merged = [...existing]

  for (const newItem of newItems) {
    // 同じもの（like）を探す
    const existingIndex = merged.findIndex(
      e => e.like === newItem.like
    )
    if (existingIndex >= 0) {
      // sentimentが変わったら上書き（「ぶどう好き→ぶどう嫌い」の矛盾解消）
      merged[existingIndex] = {
        category: newItem.category || merged[existingIndex].category,
        like: newItem.like,
        sentiment: newItem.sentiment,
      }
    } else {
      merged.push({
        category: newItem.category,
        like: newItem.like,
        sentiment: newItem.sentiment,
      })
    }
  }

  return merged.slice(-15)
}

/**
 * 従来のUserKnowledgeから構造化ナレッジにマイグレーション
 * 旧userKnowledgeコレクションから直接読み取り、structuredKnowledgeに変換
 */
export async function migrateToStructuredKnowledge(userId: string): Promise<void> {
  // 旧コレクションから直接読み取り
  const legacyRef = doc(db, 'userKnowledge', userId)
  const legacySnap = await getDoc(legacyRef)
  if (!legacySnap.exists()) return

  const legacyData = legacySnap.data()

  const existingStructured = await getStructuredKnowledge(userId)
  if (existingStructured && existingStructured.interests.length > 0) {
    // すでにマイグレーション済み
    return
  }

  const now = new Date()

  // 従来の興味を構造化興味に変換
  const legacyInterests: string[] = legacyData.interests || []
  const structuredInterests: StructuredUserKnowledge['interests'] =
    legacyInterests.map((topic: string) => ({
      topic,
      depth: 'mention' as const,
      firstMentionedAt: now,
      lastMentionedAt: now,
      mentionCount: 1,
    }))

  const migrated: Partial<StructuredUserKnowledge> = {
    basicInfo: {},
    interests: structuredInterests,
    deepMotivations: [],
    lifestyle: {},
    emotionalPatterns: [],
    recentContext: [],
    interests_legacy: legacyData.interests,
    experiences: legacyData.experiences,
    personality: legacyData.personality,
    challenges: legacyData.challenges,
    goals: legacyData.goals,
    context: legacyData.context,
    updatedAt: now,
  }

  const docRef = doc(db, 'structuredKnowledge', userId)
  await setDoc(docRef, migrated)
}

/**
 * User Promises（約束追跡）
 */
export async function createUserPromise(
  userId: string,
  data: Omit<UserPromise, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'remindedCount'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'promises'), {
    ...data,
    userId,
    remindedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function getActivePromises(userId: string): Promise<UserPromise[]> {
  const q = query(
    collection(db, 'promises'),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt)
  } as UserPromise))
}

export async function updateUserPromise(promiseId: string, data: Partial<UserPromise>) {
  await updateDoc(doc(db, 'promises', promiseId), {
    ...data,
    updatedAt: serverTimestamp()
  })
}
