/**
 * Manus API Service
 * スライド生成機能を提供
 */

const MANUS_API_KEY = process.env.NEXT_PUBLIC_MANUS_API_KEY;
const MANUS_API_URL = 'https://api.manus.app/v1';

export interface SlideRequest {
  topic: string;
  numberOfSlides?: number;
  template?: string;
  additionalInstructions?: string;
}

export interface SlideResponse {
  id: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  slides: Array<{
    title: string;
    content: string;
    imageUrl?: string;
  }>;
}

/**
 * スライドを生成
 */
export async function generateSlides(request: SlideRequest): Promise<SlideResponse> {
  if (!MANUS_API_KEY) {
    throw new Error('Manus API key is not configured');
  }

  const response = await fetch(`${MANUS_API_URL}/presentations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MANUS_API_KEY}`,
    },
    body: JSON.stringify({
      topic: request.topic,
      slide_count: request.numberOfSlides || 10,
      template: request.template || 'modern',
      instructions: request.additionalInstructions,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Manus API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * スライドの生成状態を確認
 */
export async function checkSlideStatus(slideId: string): Promise<SlideResponse> {
  if (!MANUS_API_KEY) {
    throw new Error('Manus API key is not configured');
  }

  const response = await fetch(`${MANUS_API_URL}/presentations/${slideId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MANUS_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check slide status: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * ユリちゃんがスライドを作成するための関数
 */
export async function yuriCreateSlides(topic: string, context?: string): Promise<string> {
  try {
    const request: SlideRequest = {
      topic,
      numberOfSlides: 10,
      template: 'modern',
      additionalInstructions: context ? `コンテキスト: ${context}` : undefined,
    };

    const result = await generateSlides(request);

    if (result.status === 'completed' && result.url) {
      return `スライドを作成しました！ こちらからご確認ください: ${result.url}`;
    } else if (result.status === 'processing') {
      return `スライドを作成中です...少々お待ちください。（ID: ${result.id}）`;
    } else {
      return 'スライドの作成に失敗しました。もう一度お試しください。';
    }
  } catch (error: any) {
    console.error('Slide generation error:', error);
    return `エラーが発生しました: ${error.message}`;
  }
}
