/**
 * 会話からユーザーナレッジを抽出するモジュール
 * 構造化された情報（深度、確信度、動機）を抽出
 */

import { chatWithAISeamless } from './ai-service'
import type { ExtractedStructuredKnowledge, StructuredUserKnowledge } from './firebase/firestore-types'

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

以下のJSON形式で出力してください（情報がない項目はnullで、配列は空配列[]で）:
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
  },
  "skills": [
    {
      "skill": "スキルや経験（例: Web開発3年, TOEIC600点, 料理得意）",
      "level": "beginner/intermediate/advanced"
    }
  ],
  "personality_traits": [
    {
      "trait": "性格・特性（例: 完璧主義, 負けず嫌い, 飽き性, 心配性）",
      "evidence": "どの発言から判断したか"
    }
  ],
  "struggles": [
    {
      "area": "課題・苦手なこと（例: 継続が苦手, 朝起きれない, 人前で話すのが苦手）",
      "detail": "具体的な状況（わかれば）"
    }
  ],
  "concrete_goals": [
    {
      "goal": "具体的な目標（例: フリーランスになりたい, TOEIC800点, 5kg痩せたい）",
      "deadline": "期限（わかれば）"
    }
  ],
  "preferences": [
    {
      "category": "カテゴリ（食べ物/音楽/映画/場所/ゲーム/動物など）",
      "like": "具体的なもの（例: ぶどう, ロック, ホラー映画）",
      "sentiment": "like/dislike"
    }
  ]
}

【抽出のルール】
1. 明確に分かる情報のみ抽出（推測は confidence: "low" をつける）
2. interestのdepthは:
   - "mention": 1回言及
   - "repeated": 複数回言及（既存プロファイルに既にあれば）
   - "passionate": 熱量が高い（「絶対やりたい」「大好き」など）
3. deep_motivationsは「なぜ」「本当は」「実は」「〜したくない」などの発言から抽出
4. 既存プロファイルにある情報は重複して抽出しない
5. 好きなもの・嫌いなものはpreferencesに入れる（「〇〇好き」「〇〇嫌い」「〇〇苦手」など）
6. 性格や行動パターンに関する発言はpersonality_traitsに入れる
7. JSON形式のみ返す（説明文不要）`

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

  // 既存プロファイルをJSON化（重複抽出を防ぐため）
  const existingProfileSummary = existingProfile ? {
    basicInfo: existingProfile.basicInfo,
    interests: existingProfile.interests.map(i => i.topic).slice(0, 5),
    deepMotivations: existingProfile.deepMotivations.map(m => m.desire).slice(0, 3),
    lifestyle: existingProfile.lifestyle,
    skills: (existingProfile.skills || []).map(s => s.skill).slice(0, 5),
    personalityTraits: (existingProfile.personalityTraits || []).map(p => p.trait).slice(0, 5),
    struggles: (existingProfile.struggles || []).map(s => s.area).slice(0, 5),
    concreteGoals: (existingProfile.concreteGoals || []).map(g => g.goal).slice(0, 5),
    preferences: (existingProfile.preferences || []).map(p => `${p.like}(${p.sentiment})`).slice(0, 5),
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

    // skills
    if (extracted.skills && Array.isArray(extracted.skills) && extracted.skills.length > 0) {
      result.skills = extracted.skills
        .filter((s: any) => s && s.skill)
        .map((s: any) => ({
          skill: s.skill,
          level: s.level || undefined,
        }))
    }

    // personalityTraits
    if (extracted.personality_traits && Array.isArray(extracted.personality_traits) && extracted.personality_traits.length > 0) {
      result.personalityTraits = extracted.personality_traits
        .filter((p: any) => p && p.trait)
        .map((p: any) => ({
          trait: p.trait,
          evidence: p.evidence || undefined,
        }))
    }

    // struggles
    if (extracted.struggles && Array.isArray(extracted.struggles) && extracted.struggles.length > 0) {
      result.struggles = extracted.struggles
        .filter((s: any) => s && s.area)
        .map((s: any) => ({
          area: s.area,
          detail: s.detail || undefined,
        }))
    }

    // concreteGoals
    if (extracted.concrete_goals && Array.isArray(extracted.concrete_goals) && extracted.concrete_goals.length > 0) {
      result.concreteGoals = extracted.concrete_goals
        .filter((g: any) => g && g.goal)
        .map((g: any) => ({
          goal: g.goal,
          deadline: g.deadline || undefined,
        }))
    }

    // preferences
    if (extracted.preferences && Array.isArray(extracted.preferences) && extracted.preferences.length > 0) {
      result.preferences = extracted.preferences
        .filter((p: any) => p && p.like && p.category)
        .map((p: any) => ({
          category: p.category,
          like: p.like,
          sentiment: p.sentiment || 'like',
        }))
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
