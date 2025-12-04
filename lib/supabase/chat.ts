import { supabase } from './client'
import type { Database } from './database.types'

type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

/**
 * 会話履歴を取得
 */
export async function getChatHistory(userId: string, limit: number = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * メッセージを保存
 */
export async function saveChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      role,
      content
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 会話履歴を削除
 */
export async function clearChatHistory(userId: string) {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
