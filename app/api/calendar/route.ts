import { NextRequest, NextResponse } from 'next/server'

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

/**
 * GET /api/calendar - カレンダーイベント取得
 * Query params: timeMin, timeMax (ISO8601)
 */
export async function GET(request: NextRequest) {
  const accessToken = request.headers.get('x-google-access-token')
  if (!accessToken) {
    return NextResponse.json({ error: 'アクセストークンがありません' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeMin = searchParams.get('timeMin') || new Date().toISOString()
  const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '20')

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 401) {
        return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'カレンダーの再接続が必要です' }, { status: 401 })
      }
      return NextResponse.json({ error: errorData.error?.message || 'カレンダー取得に失敗しました' }, { status: response.status })
    }

    const data = await response.json()
    // 必要な情報だけ返す
    const events = (data.items || []).map((event: any) => ({
      id: event.id,
      summary: event.summary || '（タイトルなし）',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      location: event.location,
      description: event.description,
    }))

    return NextResponse.json({ events })
  } catch (error: any) {
    console.error('Calendar API error:', error)
    return NextResponse.json({ error: 'カレンダーの取得に失敗しました' }, { status: 500 })
  }
}

/**
 * POST /api/calendar - カレンダーイベント作成
 * Body: { summary, startDateTime, endDateTime, description? }
 */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('x-google-access-token')
  if (!accessToken) {
    return NextResponse.json({ error: 'アクセストークンがありません' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { summary, startDateTime, endDateTime, description } = body

    if (!summary || !startDateTime) {
      return NextResponse.json({ error: 'タイトルと開始日時は必須です' }, { status: 400 })
    }

    // 終了日時が指定されていなければ1時間後
    const start = new Date(startDateTime)
    const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 60 * 60 * 1000)

    const eventBody: any = {
      summary,
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Tokyo' },
      end: { dateTime: end.toISOString(), timeZone: 'Asia/Tokyo' },
    }
    if (description) {
      eventBody.description = description
    }

    const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 401) {
        return NextResponse.json({ error: 'TOKEN_EXPIRED', message: 'カレンダーの再接続が必要です' }, { status: 401 })
      }
      return NextResponse.json({ error: errorData.error?.message || 'イベント作成に失敗しました' }, { status: response.status })
    }

    const created = await response.json()
    return NextResponse.json({
      success: true,
      event: {
        id: created.id,
        summary: created.summary,
        start: created.start?.dateTime || created.start?.date,
        end: created.end?.dateTime || created.end?.date,
      }
    })
  } catch (error: any) {
    console.error('Calendar create error:', error)
    return NextResponse.json({ error: 'イベントの作成に失敗しました' }, { status: 500 })
  }
}
