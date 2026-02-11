/**
 * 会話からユーザーナレッジを抽出するモジュール
 * 構造化された情報（深度、確信度、動機）を抽出
 */

import { chatWithAISeamless } from './ai-service'
import type { UserKnowledge, ExtractedStructuredKnowledge, StructuredUserKnowledge } from './firebase/firestore-types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 構造化抽出プロンプト
 * 既存プロファイルを考慮して、新しい情報を抽出
 */
const STRUCTURED_EXTRACTION_PROMPT = `以下の会話から、ユーザーについて新しくわかった情報を抽出してください。

[既存プロファイル]
{current_profile_json}

[今回の会話]
{conversation}

以下のJSON形式で出力してください（情報がない項目はnullで）:
{
  "basic_info": {
    "occupation": null,
    "major": null,
    "partTimeJob": null,
    "livingAlone": null
  },
  "interests": [
    {
      "topic": "興味のトピック",
      "motivation": "なぜ興味があるか（わかれば）",
      "depth": "mention"
    }
  ],
  "deep_motivations": [
    {
      "desire": "本質的な欲求（例: 認められたい、自由になりたい）",
      "derivedFrom": "どの発言から推測したか",
      "confidence": "low"
    }
  ],
  "lifestyle": {
    "activeHours": null,
    "busyDays": null,
    "procrastination": null,
    "sleepPattern": null
  },
  "emotional_patterns": [
    {
      "trigger": "何がトリガーか",
      "reaction": "どう反応するか",
      "effectiveResponse": "効果的な対応（わかれば）"
    }
  ],
  "recent_context": {
    "summary": "今回の会話で分かった最近の状況",
    "mood": "good/neutral/low"
  }
}

【抽出のルール】
1. 明確に分かる情報のみ抽出（推測は confidence: "low" をつける）
2. interestのdepthは:
   - "mention": 1回言及
   - "repeated": 複数回言及（既存プロファイルに既にあれば）
   - "passionate": 熱量が高い（「絶対やりたい」「大好き」など）
3. deep_motivationsは「なぜ」「本当は」「実は」「〜したくない」などの発言から抽出
4. 既存プロファイルにある情報は重複して抽出しない
5. JSON形式のみ返す（説明文不要）`

/**
 * 会話履歴から構造化ユーザーナレッジを抽出
 * @param messages 会話履歴（直近の会話）
 * @param existingProfile 既存の構造化プロファイル
 * @returns 抽出された構造化ナレッジ
 */
export async function extractStructuredKnowledge(
  messages: Message[],
  existingProfile?: StructuredUserKnowledge | null
): Promise<ExtractedStructuredKnowledge | null> {
  // 会話が少なすぎる場合はスキップ
  if (messages.length < 4) return null

  // 会話を整形
  const conversation = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : '秘書ちゃん'}: ${m.content}`)
    .join('\n')

  if (conversation.length < 100) return null

  // 既存プロファイルをJSON化
  const existingProfileSummary = existingProfile ? {
    basicInfo: existingProfile.basicInfo,
    interests: existingProfile.interests.map(i => i.topic).slice(0, 5),
    deepMotivations: existingProfile.deepMotivations.map(m => m.desire).slice(0, 3),
    lifestyle: existingProfile.lifestyle,
  } : null

  const prompt = STRUCTURED_EXTRACTION_PROMPT
    .replace('{current_profile_json}', existingProfileSummary ? JSON.stringify(existingProfileSummary, null, 2) : 'なし')
    .replace('{conversation}', conversation)

  try {
    const response = await chatWithAISeamless([
      { role: 'user', content: prompt }
    ], 'gemini')

    if (!response.success || !response.content) {
      console.error('Failed to extract structured knowledge:', response.error)
      return null
    }

    // JSONを抽出（マークダウンコードブロックがある場合も対応）
    let jsonStr = response.content
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const extracted = JSON.parse(jsonStr)

    // 抽出結果を正規化
    const result: ExtractedStructuredKnowledge = {}

    // basicInfo
    if (extracted.basic_info) {
      const bi: ExtractedStructuredKnowledge['basicInfo'] = {}
      if (extracted.basic_info.occupation) bi.occupation = extracted.basic_info.occupation
      if (extracted.basic_info.major) bi.major = extracted.basic_info.major
      if (extracted.basic_info.partTimeJob) bi.partTimeJob = extracted.basic_info.partTimeJob
      if (extracted.basic_info.livingAlone !== null) bi.livingAlone = extracted.basic_info.livingAlone
      if (Object.keys(bi).length > 0) result.basicInfo = bi
    }

    // interests
    if (extracted.interests && Array.isArray(extracted.interests) && extracted.interests.length > 0) {
      result.interests = extracted.interests
        .filter((i: any) => i && i.topic)
        .map((i: any) => ({
          topic: i.topic,
          motivation: i.motivation || undefined,
          depth: i.depth || 'mention',
        }))
    }

    // deepMotivations
    if (extracted.deep_motivations && Array.isArray(extracted.deep_motivations) && extracted.deep_motivations.length > 0) {
      result.deepMotivations = extracted.deep_motivations
        .filter((m: any) => m && m.desire)
        .map((m: any) => ({
          desire: m.desire,
          derivedFrom: m.derivedFrom || '',
          confidence: m.confidence || 'low',
        }))
    }

    // lifestyle
    if (extracted.lifestyle) {
      const ls: ExtractedStructuredKnowledge['lifestyle'] = {}
      if (extracted.lifestyle.activeHours) ls.activeHours = extracted.lifestyle.activeHours
      if (extracted.lifestyle.busyDays) ls.busyDays = extracted.lifestyle.busyDays
      if (extracted.lifestyle.procrastination !== null) ls.procrastination = extracted.lifestyle.procrastination
      if (extracted.lifestyle.sleepPattern) ls.sleepPattern = extracted.lifestyle.sleepPattern
      if (Object.keys(ls).length > 0) result.lifestyle = ls
    }

    // emotionalPatterns
    if (extracted.emotional_patterns && Array.isArray(extracted.emotional_patterns) && extracted.emotional_patterns.length > 0) {
      result.emotionalPatterns = extracted.emotional_patterns
        .filter((p: any) => p && p.trigger && p.reaction)
        .map((p: any) => ({
          trigger: p.trigger,
          reaction: p.reaction,
          effectiveResponse: p.effectiveResponse || undefined,
        }))
    }

    // recentContext
    if (extracted.recent_context && extracted.recent_context.summary) {
      result.recentContext = {
        summary: extracted.recent_context.summary,
        mood: extracted.recent_context.mood || 'neutral',
      }
    }

    // 何も抽出できなかった場合はnull
    if (Object.keys(result).length === 0) return null

    return result
  } catch (error) {
    console.error('Error extracting structured knowledge:', error)
    return null
  }
}

/**
 * 会話履歴からユーザーに関する情報を抽出（従来版・後方互換）
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

/**
 * 構造化抽出のタイミングチェック（より頻繁に抽出）
 */
export function shouldExtractStructuredKnowledge(
  messageCount: number,
  lastExtractionCount: number
): boolean {
  // 最低2往復（4メッセージ）以上
  if (messageCount < 4) return false

  // 前回の抽出から4メッセージ以上経過
  if (messageCount - lastExtractionCount < 4) return false

  return true
}
