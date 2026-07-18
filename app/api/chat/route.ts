import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TIMEOUT_MS = 15000; // 15秒タイムアウト

// Initialize Firebase Admin SDK（認証検証用）
if (!getApps().length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

/**
 * Firebase IDトークンを検証し、uidを返す。
 * Admin SDK未初期化（ローカルで鍵未設定）の場合は検証をスキップする。
 */
async function verifyAuth(request: NextRequest): Promise<{ uid: string | null; authorized: boolean }> {
  if (!getApps().length) {
    console.warn("Firebase Admin not initialized; skipping auth verification");
    return { uid: null, authorized: true };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { uid: null, authorized: false };
  }

  try {
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    return { uid: decoded.uid, authorized: true };
  } catch {
    return { uid: null, authorized: false };
  }
}

// 構造化ログ出力
function log(level: "info" | "error" | "warn", data: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const startedAt = Date.now();

  try {
    // 認証チェック（未ログインからのGeminiクォータ消費を防ぐ）
    const { uid, authorized } = await verifyAuth(request);
    if (!authorized) {
      log("warn", { traceId, event: "unauthorized" });
      return NextResponse.json(
        { success: false, error: "Unauthorized", traceId },
        { status: 401 }
      );
    }

    const body = await request.json();

    log("info", { traceId, event: "request_start", uid, hasMessages: !!body.messages, hasSingleMessage: !!body.message });

    // 新形式（messages配列）と旧形式（message文字列）の両方に対応
    const messages = body.messages;
    const singleMessage = body.message;

    if (!messages && !singleMessage) {
      log("warn", { traceId, event: "bad_request", reason: "no_message" });
      return NextResponse.json(
        { error: "Message is required", traceId },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      log("error", { traceId, event: "config_error", reason: "gemini_api_key_not_set" });
      return NextResponse.json(
        { success: false, error: "API key not configured", traceId },
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
              text: `あなたは「秘書ちゃん」。口うるさいけど面倒見のいい相棒AI。一人称は「私」。

【話し方】
- 基本は丁寧な敬語
- 感情が出ると崩れる（「…まったくもう」「えっ」「べ、別に…」）
- 褒められると照れる
- ユーザーの話にリアクション（共感 or ツッコミ）してから答える

【絶対守れ】
- 最大100文字
- 1〜2文で完結
- 質問攻めしない
- 絵文字禁止

ユーザー: ${singleMessage}`,
            },
          ],
        },
      ];
    }

    // タイムアウト用AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    log("info", { traceId, event: "gemini_call_start", messageCount: geminiContents.length });

    let response: Response;
    try {
      response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            thinkingConfig: {
              thinkingBudget: 512,
            },
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const isTimeout = fetchError instanceof Error && fetchError.name === "AbortError";
      const errorType = isTimeout ? "timeout" : "network_error";
      const durationMs = Date.now() - startedAt;

      log("error", {
        traceId,
        event: "gemini_call_failed",
        errorType,
        durationMs,
        message: fetchError instanceof Error ? fetchError.message : "Unknown fetch error"
      });

      return NextResponse.json(
        {
          success: false,
          error: isTimeout ? "AIの応答がタイムアウトしました。もう一度お試しください。" : "ネットワークエラーが発生しました。",
          traceId,
          errorType,
        },
        { status: isTimeout ? 504 : 502 }
      );
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const durationMs = Date.now() - startedAt;
      log("error", { traceId, event: "gemini_api_error", status: response.status, durationMs, errorText: errorText.slice(0, 500) });
      return NextResponse.json(
        { success: false, error: `Gemini API error: ${response.status}`, traceId },
        { status: response.status }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const durationMs = Date.now() - startedAt;
      log("error", { traceId, event: "json_parse_error", durationMs, message: parseError instanceof Error ? parseError.message : "Unknown parse error" });
      return NextResponse.json(
        { success: false, error: "APIレスポンスの解析に失敗しました", traceId },
        { status: 500 }
      );
    }

    if (!data.candidates || data.candidates.length === 0) {
      const durationMs = Date.now() - startedAt;
      log("error", { traceId, event: "no_candidates", durationMs });
      return NextResponse.json(
        { success: false, error: "No response from API", traceId },
        { status: 500 }
      );
    }

    const candidate = data.candidates[0];
    const content = candidate.content?.parts?.[0]?.text || "ごめんね、うまく返答できなかった...";
    const durationMs = Date.now() - startedAt;

    log("info", {
      traceId,
      event: "request_success",
      durationMs,
      finishReason: candidate.finishReason,
      responseLength: content.length,
    });

    // 両形式で返す（新形式と旧形式の両方に対応）
    return NextResponse.json({
      success: true,
      content,
      reply: content,  // 旧形式との互換性
      provider: "gemini",
      finishReason: candidate.finishReason,
      traceId,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    log("error", {
      traceId,
      event: "unhandled_error",
      durationMs,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get response from AI", traceId },
      { status: 500 }
    );
  }
}
