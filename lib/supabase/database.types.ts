export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          personality_type: string | null
          preferences: Json
          analysis_result: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          personality_type?: string | null
          preferences?: Json
          analysis_result?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          personality_type?: string | null
          preferences?: Json
          analysis_result?: Json
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          why: string | null
          category: string | null
          priority: 'Low' | 'Medium' | 'High' | null
          status: '未着手' | '進行中' | '完了' | '保留'
          progress: number
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          why?: string | null
          category?: string | null
          priority?: 'Low' | 'Medium' | 'High' | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          why?: string | null
          category?: string | null
          priority?: 'Low' | 'Medium' | 'High' | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          goal_id: string | null
          title: string
          description: string | null
          status: '未着手' | '進行中' | '完了' | '保留'
          progress: number
          start_date: string | null
          end_date: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id?: string | null
          title: string
          description?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          start_date?: string | null
          end_date?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string | null
          title?: string
          description?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          start_date?: string | null
          end_date?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      milestones: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          title: string
          description: string | null
          status: '未着手' | '進行中' | '完了' | '保留'
          deadline: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          title: string
          description?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          deadline?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          deadline?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          milestone_id: string | null
          title: string
          description: string | null
          estimated_time: number | null
          difficulty: 'Easy' | 'Medium' | 'Hard' | null
          deadline: string | null
          required_skill: string | null
          output_type: string | null
          status: '未着手' | '進行中' | '完了' | '保留'
          progress: number
          ai_capable: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          milestone_id?: string | null
          title: string
          description?: string | null
          estimated_time?: number | null
          difficulty?: 'Easy' | 'Medium' | 'Hard' | null
          deadline?: string | null
          required_skill?: string | null
          output_type?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          ai_capable?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          milestone_id?: string | null
          title?: string
          description?: string | null
          estimated_time?: number | null
          difficulty?: 'Easy' | 'Medium' | 'Hard' | null
          deadline?: string | null
          required_skill?: string | null
          output_type?: string | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          progress?: number
          ai_capable?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      micro_tasks: {
        Row: {
          id: string
          user_id: string
          task_id: string | null
          title: string
          description: string | null
          estimated_time: number | null
          status: '未着手' | '進行中' | '完了' | '保留'
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id?: string | null
          title: string
          description?: string | null
          estimated_time?: number | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string | null
          title?: string
          description?: string | null
          estimated_time?: number | null
          status?: '未着手' | '進行中' | '完了' | '保留'
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
      daily_logs: {
        Row: {
          id: string
          user_id: string
          log_date: string
          completed_tasks: number
          total_tasks: number
          time_spent: number
          mood: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          log_date: string
          completed_tasks?: number
          total_tasks?: number
          time_spent?: number
          mood?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          log_date?: string
          completed_tasks?: number
          total_tasks?: number
          time_spent?: number
          mood?: number | null
          notes?: string | null
          created_at?: string
        }
      }
    }
  }
}
