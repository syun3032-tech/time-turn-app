/**
 * AI接続サービス
 * OpenAI API (GPT-4) または Anthropic API (Claude) に接続
 */

import { getEnhancedTaskBreakdownPrompt } from "./prompts";
import { getSystemPrompt } from "@/config/character";
import { generateTaskTreeContext } from "./task-tree-utils";
import { TaskBreakdownContext } from "@/types/task-tree";

// 使用するAIプロバイダー
export type AIProvider = "openai" | "anthropic" | "gemini";

// APIキーのモード（コスト管理のため）
export type APIKeyMode = "chat" | "task_breakdown";

/**
 * AIにタスク分解を依頼
 */
export async function requestTaskBreakdown(
  context: TaskBreakdownContext,
  provider: AIProvider = "gemini"
) {
  // コンテキストを文字列化
  const contextString = generateTaskTreeContext(context);

  // プロンプトを生成
  const prompt = getEnhancedTaskBreakdownPrompt(contextString);

  // プロバイダーに応じてAPI呼び出し（タスク分解モード）
  if (provider === "openai") {
    return await callOpenAI(prompt, "task_breakdown");
  } else if (provider === "anthropic") {
    return await callAnthropic(prompt, "task_breakdown");
  } else {
    return await callGemini(prompt, "task_breakdown");
  }
}

/**
 * OpenAI API (GPT-4) を呼び出し
 */
async function callOpenAI(prompt: string, mode: APIKeyMode = "chat") {
  // モードに応じてAPIキーを選択
  const apiKey = mode === "chat"
    ? process.env.NEXT_PUBLIC_OPENAI_API_KEY
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY_TASK || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI APIキーが設定されていません。環境変数 NEXT_PUBLIC_OPENAI_API_KEY を設定してください。"
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview", // または "gpt-4", "gpt-3.5-turbo"
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0].message.content,
      provider: "openai" as AIProvider,
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "openai" as AIProvider,
    };
  }
}

/**
 * Anthropic API (Claude) を呼び出し
 */
async function callAnthropic(prompt: string, mode: APIKeyMode = "chat") {
  // モードに応じてAPIキーを選択
  const apiKey = mode === "chat"
    ? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
    : process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY_TASK || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Anthropic APIキーが設定されていません。環境変数 NEXT_PUBLIC_ANTHROPIC_API_KEY を設定してください。"
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022", // または "claude-3-opus-20240229"
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API Error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content[0].text,
      provider: "anthropic" as AIProvider,
    };
  } catch (error) {
    console.error("Anthropic API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "anthropic" as AIProvider,
    };
  }
}

/**
 * Google Gemini API を呼び出し
 */
async function callGemini(prompt: string, _mode: APIKeyMode = "chat") {
  // サーバーサイドAPI Route経由で呼び出し（CORSエラー回避）
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "API request failed");
    }

    // デバッグ用: finish_reasonをログ出力
    if (data.finishReason) {
      console.log("Gemini API finish_reason:", data.finishReason);
    }

    return {
      success: true,
      content: data.content,
      provider: "gemini" as AIProvider,
      finishReason: data.finishReason,
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "gemini" as AIProvider,
    };
  }
}

/**
 * 会話形式でAIと対話（複数ターン対応）
 */
export async function chatWithAI(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  provider: AIProvider = "gemini"
) {
  if (provider === "openai") {
    return await chatWithOpenAI(messages);
  } else if (provider === "anthropic") {
    return await chatWithAnthropic(messages);
  } else {
    return await chatWithGemini(messages);
  }
}

/**
 * OpenAIとの会話
 */
async function chatWithOpenAI(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI APIキーが設定されていません。");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0].message.content,
      provider: "openai" as AIProvider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "openai" as AIProvider,
    };
  }
}

/**
 * Anthropicとの会話
 */
async function chatWithAnthropic(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Anthropic APIキーが設定されていません。");
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API Error: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content[0].text,
      provider: "anthropic" as AIProvider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "anthropic" as AIProvider,
    };
  }
}

/**
 * Geminiとの会話
 */
async function chatWithGemini(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  // サーバーサイドAPI Route経由で呼び出し（CORSエラー回避）
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "API request failed");
    }

    // デバッグ用: finish_reasonをログ出力
    if (data.finishReason) {
      console.log("Gemini API finish_reason:", data.finishReason);
    }

    return {
      success: true,
      content: data.content,
      provider: "gemini" as AIProvider,
      finishReason: data.finishReason,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "gemini" as AIProvider,
    };
  }
}

/**
 * シームレスな会話（自動モード切り替え）
 * ユーザーの意図を検出し、チャットとタスク分解を自然に切り替える
 *
 * @param messages 会話履歴
 * @param provider AIプロバイダー
 * @param forceMode 強制的にモードを指定する場合
 */
export async function chatWithAISeamless(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  provider: AIProvider = "gemini",
  forceMode?: "chat" | "task_breakdown"
) {
  // モード検出
  const mode = forceMode || detectMode(messages);

  // キャラクターのベースプロンプトを常に保持
  const characterBase = getSystemPrompt();

  // 会話履歴を準備
  let enhancedMessages = [...messages];

  if (mode === "task_breakdown") {
    // タスク分解モード：特化したプロンプトを追加
    // ただし、キャラクターの口調は維持
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      // 最後のユーザーメッセージにタスク分解の指示を付加
      const taskInstructions = `
【内部指示：タスク分解モード】
以下のユーザーの目標について、段階的にヒアリングを行い、最適なタスク分解を提案してください。
ただし、秘書ちゃんとしての口調とキャラクターは保ったまま、自然に対話してください。

ステップ：
1. まず、ユーザーの言葉を受け止め、言い換えて確認
2. なぜやりたいのか、丁寧に聞く（軸合わせ）
3. 現状とギャップを特定
4. ネックになっているところを確認
5. リソース確認
6. 段階的に具体化していく

ユーザーの入力:
${lastUserMessage.content}
`;

      enhancedMessages = [
        { role: "user", content: `${characterBase}\n\n${taskInstructions}` },
      ];
    }
  } else {
    // 通常チャットモード：初回のみキャラクターベースを追加
    if (messages.length === 1) {
      enhancedMessages = [
        { role: "user", content: `${characterBase}\n\nユーザー: ${messages[0].content}` },
      ];
    }
  }

  // APIキーモードを決定（タスク分解は専用APIキーを使用）
  const apiKeyMode: APIKeyMode = mode === "task_breakdown" ? "task_breakdown" : "chat";

  // プロバイダーに応じて呼び出し（適切なAPIキーモードで）
  if (provider === "openai") {
    return await chatWithOpenAIWithMode(enhancedMessages, apiKeyMode);
  } else if (provider === "anthropic") {
    return await chatWithAnthropicWithMode(enhancedMessages, apiKeyMode);
  } else {
    return await chatWithGeminiWithMode(enhancedMessages, apiKeyMode);
  }
}

/**
 * ユーザーの意図を検出（チャット vs タスク分解）
 */
function detectMode(messages: Array<{ role: "user" | "assistant"; content: string }>): "chat" | "task_breakdown" {
  const lastUserMessage = messages[messages.length - 1];
  if (!lastUserMessage || lastUserMessage.role !== "user") {
    return "chat";
  }

  const content = lastUserMessage.content.toLowerCase();

  // タスク分解を示すキーワード
  const taskBreakdownKeywords = [
    "やりたい", "成したい", "達成したい", "目標",
    "勉強したい", "学びたい", "習得したい",
    "始めたい", "作りたい", "実現したい",
    "タスク", "分解", "計画", "ステップ"
  ];

  // キーワードが含まれているかチェック
  const hasTaskKeyword = taskBreakdownKeywords.some(keyword => content.includes(keyword));

  return hasTaskKeyword ? "task_breakdown" : "chat";
}

// モード付きAPI呼び出し関数
async function chatWithOpenAIWithMode(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  mode: APIKeyMode
) {
  const apiKey = mode === "chat"
    ? process.env.NEXT_PUBLIC_OPENAI_API_KEY
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY_TASK || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI APIキーが設定されていません。");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: messages,
        temperature: 0.7,
        max_tokens: mode === "task_breakdown" ? 3000 : 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0].message.content,
      provider: "openai" as AIProvider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "openai" as AIProvider,
    };
  }
}

async function chatWithAnthropicWithMode(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  mode: APIKeyMode
) {
  const apiKey = mode === "chat"
    ? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
    : process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY_TASK || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Anthropic APIキーが設定されていません。");
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: mode === "task_breakdown" ? 4000 : 3000,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API Error: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content[0].text,
      provider: "anthropic" as AIProvider,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "anthropic" as AIProvider,
    };
  }
}

async function chatWithGeminiWithMode(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  _mode: APIKeyMode
) {
  // サーバーサイドAPI Route経由で呼び出し（CORSエラー回避）
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "API request failed");
    }

    // デバッグ用: finish_reasonをログ出力
    if (data.finishReason) {
      console.log("Gemini API finish_reason:", data.finishReason);
    }

    return {
      success: true,
      content: data.content,
      provider: "gemini" as AIProvider,
      finishReason: data.finishReason,
    };
  } catch (error) {
    console.error("Chat API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "gemini" as AIProvider,
    };
  }
}
