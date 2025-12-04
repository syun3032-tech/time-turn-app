/**
 * Firestoreデータ構造の型定義
 */

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  personalityType?: string
  preferences?: Record<string, any>
  analysisResult?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Goal {
  id: string
  userId: string
  title: string
  description?: string
  why?: string
  category?: string
  priority?: 'Low' | 'Medium' | 'High'
  status: '未着手' | '進行中' | '完了' | '保留'
  progress: number
  startDate?: string
  endDate?: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  userId: string
  goalId?: string
  title: string
  description?: string
  status: '未着手' | '進行中' | '完了' | '保留'
  progress: number
  startDate?: string
  endDate?: string
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export interface Milestone {
  id: string
  userId: string
  projectId?: string
  title: string
  description?: string
  status: '未着手' | '進行中' | '完了' | '保留'
  deadline?: string
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  id: string
  userId: string
  milestoneId?: string
  title: string
  description?: string
  estimatedTime?: number
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  deadline?: string
  requiredSkill?: string
  outputType?: string
  status: '未着手' | '進行中' | '完了' | '保留'
  progress: number
  aiCapable: boolean
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export interface MicroTask {
  id: string
  userId: string
  taskId?: string
  title: string
  description?: string
  estimatedTime?: number
  status: '未着手' | '進行中' | '完了' | '保留'
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface DailyLog {
  id: string
  userId: string
  logDate: string
  completedTasks: number
  totalTasks: number
  timeSpent: number
  mood?: number
  notes?: string
  createdAt: Date
}

export interface CompletedTask {
  id: string
  userId: string
  taskId: string
  taskTitle: string
  taskType: 'Goal' | 'Project' | 'Milestone' | 'Task'
  completedAt: Date
  timeSpent?: number
  reflectionNote?: string
  achievementRating?: number
  aiCapable?: boolean
  createdAt: Date
}
