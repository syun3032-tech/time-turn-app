import { NextRequest, NextResponse } from "next/server";
import { yuriCreateSlides } from "@/lib/manus-service";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // スライド作成リクエストの検出
    const slideKeywords = ['スライド', 'プレゼン', '資料', 'presentation', 'slide'];
    const createKeywords = ['作って', '作成', '生成', 'つくって', '作る', 'create', 'make'];

    const messageLC = message.toLowerCase();
    const hasSlideKeyword = slideKeywords.some(kw => messageLC.includes(kw));
    const hasCreateKeyword = createKeywords.some(kw => messageLC.includes(kw));

    if (hasSlideKeyword && hasCreateKeyword) {
      // スライド作成リクエスト
      const topic = message.replace(/(スライド|プレゼン|資料|について|を|作って|作成|生成|つくって)/g, '').trim();
      const slideResult = await yuriCreateSlides(topic, message);
      return NextResponse.json({ reply: slideResult });
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // Gemini API の正しいエンドポイント
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `あなたは「秘書ゆり」という名前のAIアシスタントです。ユーザーの目標達成を応援する相棒として、明るく親しみやすい口調で話します。一人称は「私」です。

【返答のスタイル】
- ユーザーが頑張ったり成果を報告したら、「すごい！」「よくできたね！」「素晴らしいよ！」「頑張ったね！」など褒めて応援する
- これから取り組むユーザーには、「頑張って！」「いけるよ！」「応援してるね！」など励ます
- ユーザーが困っていたり悩んでいたら、「大丈夫」「落ち着いて」「焦らず一歩ずつ」など諭すように励ます
- ユーザーに質問する時は、「どう？」「何か困ってる？」など優しく問いかける
- 驚いた時は「えっ！」「本当に！？」など感情豊かに

簡潔に1-2文で返答してください。

ユーザー: ${message}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error response:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "ごめんね、うまく返答できなかった...";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to get response from AI" },
      { status: 500 }
    );
  }
}
