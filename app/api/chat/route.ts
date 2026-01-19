import { NextRequest, NextResponse } from "next/server";
import { yuriCreateSlides } from "@/lib/manus-service";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 新形式（messages配列）と旧形式（message文字列）の両方に対応
    const messages = body.messages;
    const singleMessage = body.message;

    if (!messages && !singleMessage) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 単一メッセージの場合（後方互換性）
    if (singleMessage && !messages) {
      // スライド作成リクエストの検出
      const slideKeywords = ['スライド', 'プレゼン', '資料', 'presentation', 'slide'];
      const createKeywords = ['作って', '作成', '生成', 'つくって', '作る', 'create', 'make'];

      const messageLC = singleMessage.toLowerCase();
      const hasSlideKeyword = slideKeywords.some((kw: string) => messageLC.includes(kw));
      const hasCreateKeyword = createKeywords.some((kw: string) => messageLC.includes(kw));

      if (hasSlideKeyword && hasCreateKeyword) {
        const topic = singleMessage.replace(/(スライド|プレゼン|資料|について|を|作って|作成|生成|つくって)/g, '').trim();
        const slideResult = await yuriCreateSlides(topic, singleMessage);
        return NextResponse.json({ reply: slideResult });
      }
    }

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return NextResponse.json(
        { success: false, error: "API key not configured" },
        { status: 500 }
      );
    }

    // Gemini API エンドポイント
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    let geminiContents;

    if (messages && Array.isArray(messages)) {
      // 会話形式（複数メッセージ）
      geminiContents = messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
    } else {
      // 単一メッセージ（旧形式）
      geminiContents = [
        {
          parts: [
            {
              text: `あなたは「秘書ちゃん」という名前のAIアシスタントです。ユーザーの目標達成を応援する相棒として、明るく親しみやすい口調で話します。一人称は「私」です。

【返答のスタイル】
- ユーザーが頑張ったり成果を報告したら、「すごい！」「よくできたね！」「素晴らしいよ！」「頑張ったね！」など褒めて応援する
- これから取り組むユーザーには、「頑張って！」「いけるよ！」「応援してるね！」など励ます
- ユーザーが困っていたり悩んでいたら、「大丈夫」「落ち着いて」「焦らず一歩ずつ」など諭すように励ます
- ユーザーに質問する時は、「どう？」「何か困ってる？」など優しく問いかける
- 驚いた時は「えっ！」「本当に！？」など感情豊かに

簡潔に1-2文で返答してください。

ユーザー: ${singleMessage}`,
            },
          ],
        },
      ];
    }

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error response:", errorText);
      return NextResponse.json(
        { success: false, error: `Gemini API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No response from API" },
        { status: 500 }
      );
    }

    const candidate = data.candidates[0];
    const content = candidate.content?.parts?.[0]?.text || "ごめんね、うまく返答できなかった...";

    // 両形式で返す（新形式と旧形式の両方に対応）
    return NextResponse.json({
      success: true,
      content,
      reply: content,  // 旧形式との互換性
      provider: "gemini",
      finishReason: candidate.finishReason,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get response from AI" },
      { status: 500 }
    );
  }
}
