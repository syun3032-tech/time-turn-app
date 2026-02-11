/**
 * Firestoreデータ構造の型定義
 */

export interface NotificationSettings {
  taskReminders: boolean           // タスクリマインダー通知
  characterCalls: boolean          // キャラクター呼びかけ通知
  reminderFrequency: 'hourly' | 'daily' | 'custom'  // リマインド頻度
  quietHoursStart?: string         // 通知しない時間帯（開始）例: "22:00"
  quietHoursEnd?: string           // 通知しない時間帯（終了）例: "08:00"
}

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  nickname?: string
  birthDate?: string
  occupation?: string
  hobbies?: string
  personalityType?: string
  preferences?: Record<string, any>
  analysisResult?: Record<string, any>
  profileCompleted: boolean
  fcmTokens?: string[]             // FCMトークン（複数デバイス対応）
  notificationSettings?: NotificationSettings  // 通知設定
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

/**
 * ヒアリング進捗
 */
export interface HearingProgress {
  why: boolean
  current: boolean
  target: boolean
  timeline: boolean
}

/**
 * ヒアリング要約
 */
export interface HearingSummary {
  goal: string
  why: string
  current: string
  target: string
  timeline: string
}

/**
 * 会話履歴
 */
export interface Conversation {
  id: string
  userId: string
  title: string
  isCustomTitle: boolean  // ユーザーが編集したらtrue
  goalId?: string         // 紐づく目標（あれば）
  source?: 'mini' | 'main'  // どこで作成された会話か（ミニ秘書 or メイン秘書）
  // ヒアリング状態の永続化
  taskBreakdownStage?: 'normal' | 'hearing' | 'proposal' | 'output'
  hearingProgress?: HearingProgress
  hearingSummary?: HearingSummary
  createdAt: Date
  updatedAt: Date
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

/**
 * ユーザーナレッジ（雑談から抽出した情報）- 従来版
 */
export interface UserKnowledge {
  userId: string
  interests: string[]        // 興味・関心（「プログラミング」「英語学習」など）
  experiences: string[]      // 経験・スキル（「Web開発3年」「TOEIC600点」など）
  personality: string[]      // 性格・特性（「朝型」「計画好き」「完璧主義」など）
  challenges: string[]       // 課題・苦手（「継続が苦手」「集中力が続かない」など）
  goals: string[]           // 将来の夢・目標（「フリーランス」「海外移住」など）
  context: string[]         // その他の文脈情報（「大学生」「仕事忙しい」など）
  updatedAt: Date
}

/**
 * 構造化ユーザーナレッジ（深度・確信度・動機付き）
 * 日常会話から自然にユーザーを知り、蓄積し、活かす「相棒感」を実現
 */
export interface StructuredUserKnowledge {
  userId: string

  // === 基本情報 ===
  basicInfo: {
    occupation?: string        // 大学2年、会社員など
    major?: string            // 専攻（マーケティング、情報工学など）
    partTimeJob?: string      // バイト先（飲食バイト、コンビニなど）
    livingAlone?: boolean     // 一人暮らしかどうか
  }

  // === 興味・関心（構造化） ===
  interests: Array<{
    topic: string             // プログラミング、英語学習など
    motivation?: string       // 自分でサービス作りたい、海外旅行したいなど
    depth: 'mention' | 'repeated' | 'passionate'  // 言及レベル
    firstMentionedAt: Date    // 初めて言及された日時
    lastMentionedAt: Date     // 最後に言及された日時
    mentionCount?: number     // 言及回数
  }>

  // === 本質的欲求（Whyの層） ===
  deepMotivations: Array<{
    desire: string            // 自分の力で稼ぎたい、認められたいなど
    derivedFrom: string       // 「バイトずっとはやだ」発言から、など
    confidence: 'low' | 'medium' | 'high'  // 確信度
    detectedAt: Date          // 検出日時
  }>

  // === 生活パターン ===
  lifestyle: {
    activeHours?: 'morning' | 'afternoon' | 'night'  // 活動時間帯
    busyDays?: string[]       // 忙しい曜日（["火", "木"]など）
    procrastination?: boolean // ギリギリタイプかどうか
    sleepPattern?: 'early' | 'normal' | 'late'  // 睡眠パターン
  }

  // === 感情パターン ===
  emotionalPatterns: Array<{
    trigger: string           // バイトのミス、テスト前など
    reaction: string          // 落ち込む、焦るなど
    effectiveResponse: string // 軽く励ますと回復、具体策を示すと安心など
  }>

  // === 直近コンテキスト（最大5件） ===
  recentContext: Array<{
    date: Date
    summary: string           // マーケのレポートに追われてた、バイトで疲れたなど
    mood: 'good' | 'neutral' | 'low'  // その時の気分
  }>

  // === 既存フィールド（後方互換） ===
  interests_legacy?: string[]
  experiences?: string[]
  personality?: string[]
  challenges?: string[]
  goals?: string[]
  context?: string[]

  updatedAt: Date
}

/**
 * 構造化ナレッジの抽出結果（AI応答からの抽出用）
 */
export interface ExtractedStructuredKnowledge {
  basicInfo?: Partial<StructuredUserKnowledge['basicInfo']>
  interests?: Array<{
    topic: string
    motivation?: string
    depth?: 'mention' | 'repeated' | 'passionate'
  }>
  deepMotivations?: Array<{
    desire: string
    derivedFrom: string
    confidence?: 'low' | 'medium' | 'high'
  }>
  lifestyle?: Partial<StructuredUserKnowledge['lifestyle']>
  emotionalPatterns?: Array<{
    trigger: string
    reaction: string
    effectiveResponse?: string
  }>
  recentContext?: {
    summary: string
    mood: 'good' | 'neutral' | 'low'
  }
}
