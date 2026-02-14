export type QuickReplyType = 'select' | 'multi' | 'rank'

export interface QuickReply {
  type: QuickReplyType
  options: string[]
}

export interface ParsedResponse {
  content: string
  quickReply: QuickReply | null
}

const SELECT_REGEX = /\[SELECT:\s*(.+?)\]\s*$/
const MULTI_REGEX = /\[MULTI:\s*(.+?)\]\s*$/
const RANK_REGEX = /\[RANK:\s*(.+?)\]\s*$/

export function parseQuickReplies(raw: string): ParsedResponse {
  for (const [regex, type] of [
    [SELECT_REGEX, 'select'],
    [MULTI_REGEX, 'multi'],
    [RANK_REGEX, 'rank'],
  ] as const) {
    const match = raw.match(regex)
    if (match) {
      const options = match[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= 30)
        .slice(0, 6)
      return {
        content: raw.replace(regex, '').trim(),
        quickReply: options.length >= 2 ? { type, options } : null,
      }
    }
  }
  return { content: raw, quickReply: null }
}
