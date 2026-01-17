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
  CompletedTask
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
