/**
 * Google Calendar クライアントユーティリティ
 */

export interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
  location?: string
  description?: string
}

/**
 * 今日のイベントを取得
 */
export async function getTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  return getEvents(accessToken, startOfDay, endOfDay)
}

/**
 * 明日のイベントを取得
 */
export async function getTomorrowEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date()
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)

  return getEvents(accessToken, startOfTomorrow, endOfTomorrow)
}

/**
 * 今週のイベントを取得
 */
export async function getWeekEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000)

  return getEvents(accessToken, startOfDay, endOfWeek)
}

/**
 * 期間を指定してイベント取得
 */
export async function getEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  })

  const response = await fetch(`/api/calendar?${params}`, {
    headers: { 'x-google-access-token': accessToken }
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (data.error === 'TOKEN_EXPIRED') {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(data.error || 'カレンダー取得に失敗しました')
  }

  const data = await response.json()
  return data.events
}

/**
 * イベントを作成
 */
export async function createEvent(
  accessToken: string,
  summary: string,
  startDateTime: string,
  endDateTime?: string,
  description?: string
): Promise<CalendarEvent> {
  const response = await fetch('/api/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-google-access-token': accessToken,
    },
    body: JSON.stringify({ summary, startDateTime, endDateTime, description }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (data.error === 'TOKEN_EXPIRED') {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(data.error || 'イベント作成に失敗しました')
  }

  const data = await response.json()
  return data.event
}

/**
 * イベントを読みやすいテキストに変換（AI用）
 */
export function formatEventsForAI(events: CalendarEvent[]): string {
  if (events.length === 0) return '予定なし'

  return events.map(event => {
    const start = new Date(event.start)
    const timeStr = event.allDay
      ? '終日'
      : `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`

    let text = `- ${timeStr} ${event.summary}`
    if (event.location) text += `（${event.location}）`
    return text
  }).join('\n')
}
