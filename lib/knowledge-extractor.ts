/**
 * 会話からユーザーナレッジを抽出するモジュール
 */

import { chatWithAISeamless } from './ai-service'
import type { UserKnowledge } from './firebase/firestore-types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 会話履歴からユーザーに関する情報を抽出
 * @param messages 会話履歴（直近の会話）
 * @returns 抽出されたナレッジ（部分的）
 */
export async function extractKnowledgeFromConversation(
  messages: Message[]
): Promise<Partial<Omit<UserKnowledge, 'userId' | 'updatedAt'>> | null> {
  // 会話が少なすぎる場合はスキップ
  if (messages.length < 4) return null

  // ユーザーのメッセージだけを抽出
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n')

  if (userMessages.length < 50) return null // 内容が少なすぎる場合はスキップ

  const extractionPrompt = `以下のユーザーの発言から、ユーザーについて分かる情報を抽出してJSON形式で返してください。
情報がない項目は空配列[]にしてください。各項目は短いフレーズ（5-15文字程度）で。

【ユーザーの発言】
${userMessages}

【抽出する項目】
- interests: 興味・関心（例: "プログラミング", "英語学習", "ゲーム"）
- experiences: 経験・スキル（例: "Web開発3年", "TOEIC600点", "営業経験あり"）
- personality: 性格・特性（例: "朝型", "計画好き", "完璧主義"）
- challenges: 課題・苦手なこと（例: "継続が苦手", "集中力が続かない"）
- goals: 将来の夢・目標（例: "フリーランスになりたい", "海外で働きたい"）
- context: その他の背景情報（例: "大学生", "仕事が忙しい", "子育て中"）

【重要】
- 明確に分かる情報だけを抽出
- 推測や憶測は含めない
- 各配列は最大3項目まで
- JSON形式のみ返す（説明文不要）

【出力形式】
{"interests":[],"experiences":[],"personality":[],"challenges":[],"goals":[],"context":[]}`

  try {
    const response = await chatWithAISeamless([
      { role: 'user', content: extractionPrompt }
    ], 'gemini')

    if (!response.success || !response.content) {
      console.error('Failed to extract knowledge:', response.error)
      return null
    }

    // JSONを抽出（マークダウンコードブロックがある場合も対応）
    let jsonStr = response.content
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const extracted = JSON.parse(jsonStr)

    // 空の配列を除去して返す
    const result: Partial<Omit<UserKnowledge, 'userId' | 'updatedAt'>> = {}

    if (extracted.interests?.length > 0) result.interests = extracted.interests
    if (extracted.experiences?.length > 0) result.experiences = extracted.experiences
    if (extracted.personality?.length > 0) result.personality = extracted.personality
    if (extracted.challenges?.length > 0) result.challenges = extracted.challenges
    if (extracted.goals?.length > 0) result.goals = extracted.goals
    if (extracted.context?.length > 0) result.context = extracted.context

    // 何も抽出できなかった場合はnull
    if (Object.keys(result).length === 0) return null

    return result
  } catch (error) {
    console.error('Error extracting knowledge:', error)
    return null
  }
}

/**
 * 会話が十分に進んだかチェック（抽出タイミングの判断用）
 */
export function shouldExtractKnowledge(
  messageCount: number,
  lastExtractionCount: number
): boolean {
  // 最低4往復（8メッセージ）以上
  if (messageCount < 8) return false

  // 前回の抽出から6メッセージ以上経過
  if (messageCount - lastExtractionCount < 6) return false

  return true
}
