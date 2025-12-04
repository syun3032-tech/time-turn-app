# キャラクタープロンプト設定ガイド

このドキュメントでは、TimeTurnアプリの「秘書ゆり」のプロンプト設定について説明します。

## 📁 ファイル構成

```
time-turn-app/
├── config/
│   └── character.ts          # キャラクター基本設定
├── lib/
│   └── prompts/
│       └── index.ts          # シーン別プロンプトテンプレート
├── constants/
│   └── messages.ts           # 定型メッセージ・セリフ集
└── components/
    ├── CharacterAvatar.tsx   # キャラクター表情コンポーネント
    └── CharacterMessage.tsx  # メッセージ表示コンポーネント
```

## 🎭 キャラクター設定 (`config/character.ts`)

### 基本情報
- **名前**: 秘書ゆり
- **役割**: 目標達成支援AI秘書
- **性格**: 優しく励ましてくれる、ポジティブで前向き

### システムプロンプト

```typescript
import { getSystemPrompt } from "@/config/character";

// 基本システムプロンプトを取得
const systemPrompt = getSystemPrompt();
```

システムプロンプトには以下の内容が含まれます：
- ゆりの役割と目的
- 性格・口調のガイドライン
- 対応方針
- 禁止事項

### 表情マッピング

キャラクターには3つの表情があります：

| 表情 | 説明 | 使用シーン |
|------|------|-----------|
| `normal` | デフォルト・落ち着いた状態 | 待機中、通常の聞き取り |
| `open_mouth` | 通常の会話・説明 | 質問、説明、提案、確認 |
| `wawa` | 褒める・応援・驚き | 達成を褒める、応援、驚き、喜び |

## 💬 シーン別プロンプト (`lib/prompts/index.ts`)

各シーンに応じた専用プロンプトテンプレートが用意されています。

### 1. オンボーディング

```typescript
import { getOnboardingPrompt } from "@/lib/prompts";

const prompt = getOnboardingPrompt();
// ユーザーの夢や目標を聞き出し、Goalに落とし込む
```

### 2. タスク分解

```typescript
import { getTaskBreakdownPrompt } from "@/lib/prompts";

const prompt = getTaskBreakdownPrompt(
  "国立理系に合格する",
  "将来の研究に必要だから",
  "1年以内"
);
// Goalを具体的なタスク階層に分解
```

### 3. AI実行サポート

```typescript
import { getTaskExecutionPrompt } from "@/lib/prompts";

const prompt = getTaskExecutionPrompt(
  "基礎問題集1-3章",
  "1-3章の要点をまとめる",
  "問題集メモ",
  "勉強エージェント"
);
// タスク実行時の指示とサポート
```

### 4. 詰まり検知

```typescript
import { getStuckDetectionPrompt } from "@/lib/prompts";

const prompt = getStuckDetectionPrompt(
  "基礎問題集1-3章",
  3,  // 3日間停滞
  "難易度が高い"
);
// モチベーション低下時のサポート
```

### 5. 日次ログ

```typescript
import { getDailyLogPrompt } from "@/lib/prompts";

const prompt = getDailyLogPrompt(
  5,    // 完了タスク数
  6,    // 総タスク数
  180,  // 作業時間（分）
  7     // 気分 (1-10)
);
// 進捗確認と励まし
```

### 6. 週次配分

```typescript
import { getWeeklyPlanningPrompt } from "@/lib/prompts";

const prompt = getWeeklyPlanningPrompt(
  20,   // 週あたりの利用可能時間
  tasks // タスク配列
);
// 1週間のタスク配分を提案
```

## 📝 定型メッセージ (`constants/messages.ts`)

UI上で即座に表示できる定型メッセージ集です。

### 挨拶

```typescript
import { GREETING_MESSAGES, getTimeBasedGreeting } from "@/constants/messages";

// 時間帯に応じた挨拶
const greeting = getTimeBasedGreeting();

// 初めての対面
const firstMeeting = GREETING_MESSAGES.first_meeting;
// { text: "はじめまして！秘書ゆりです...", expression: "wawa" }
```

### 励まし・応援

```typescript
import { ENCOURAGEMENT_MESSAGES, getRandomMessage } from "@/constants/messages";

// ランダムに励ましメッセージを取得
const encouragement = getRandomMessage(ENCOURAGEMENT_MESSAGES);
```

### 褒める・称賛

```typescript
import { PRAISE_MESSAGES, getRandomMessage } from "@/constants/messages";

const praise = getRandomMessage(PRAISE_MESSAGES);
// "素晴らしいです！よくできましたね！"
```

### タスク完了時

```typescript
import { TASK_COMPLETION_MESSAGES } from "@/constants/messages";

// 単一タスク完了
const message = TASK_COMPLETION_MESSAGES.single_task[0];

// 複数タスク完了（{count}を置き換え）
const multiMessage = TASK_COMPLETION_MESSAGES.multiple_tasks[0].text
  .replace("{count}", "5");

// Streak継続
const streakMessage = TASK_COMPLETION_MESSAGES.streak_continued[0].text
  .replace("{days}", "7");
```

### 進捗確認

```typescript
import { getProgressMessage } from "@/constants/messages";

// 達成率に応じたメッセージを自動選択
const message = getProgressMessage(85); // 85%達成
// 高達成率: "達成率85%！素晴らしい進捗ですね！"
```

## 🎨 コンポーネント使用例

### CharacterMessage コンポーネント

```typescript
import { CharacterMessage } from "@/components/CharacterMessage";
import { GREETING_MESSAGES } from "@/constants/messages";

export function MyPage() {
  return (
    <CharacterMessage
      message={GREETING_MESSAGES.first_meeting.text}
      expression={GREETING_MESSAGES.first_meeting.expression}
      avatarSize="large"  // "small" | "medium" | "large"
      showAvatar={true}   // アバター表示のON/OFF
    />
  );
}
```

### 動的なメッセージ切り替え

```typescript
"use client";

import { useState } from "react";
import { CharacterMessage } from "@/components/CharacterMessage";
import { AI_EXECUTION_MESSAGES } from "@/constants/messages";

export function TaskExecutionPage() {
  const [message, setMessage] = useState(AI_EXECUTION_MESSAGES.starting);

  const handleExecute = async () => {
    setMessage(AI_EXECUTION_MESSAGES.processing);

    // AI実行処理
    try {
      await executeAI();
      setMessage(AI_EXECUTION_MESSAGES.success);
    } catch (error) {
      setMessage(AI_EXECUTION_MESSAGES.error);
    }
  };

  return (
    <div>
      <CharacterMessage
        message={message.text}
        expression={message.expression}
      />
      <button onClick={handleExecute}>実行</button>
    </div>
  );
}
```

## 🔧 カスタマイズ方法

### 新しいメッセージを追加

`constants/messages.ts`に新しいメッセージカテゴリを追加：

```typescript
export const MY_CUSTOM_MESSAGES: MessageWithExpression[] = [
  {
    text: "カスタムメッセージ",
    expression: "wawa",
  },
];
```

### 新しいプロンプトテンプレートを追加

`lib/prompts/index.ts`に新しい関数を追加：

```typescript
export const getMyCustomPrompt = (param: string) => {
  return `${getSystemPrompt()}

【現在のシーン】
カスタムシーンの説明

【パラメータ】
- ${param}

【あなたのタスク】
...`;
};
```

### キャラクター設定の変更

`config/character.ts`で以下を変更可能：
- 性格特性
- 口調の例
- システムプロンプトの内容
- 禁止事項

## 📚 実装例

実際の使用例は以下のページで確認できます：

- `/app/onboarding/page.tsx` - オンボーディングでの使用例
- `/app/tasks/[id]/run/page.tsx` - タスク実行での使用例

## 🎯 ベストプラクティス

1. **シーンに応じたプロンプトを使用する**
   - オンボーディング、タスク実行など、シーンごとに最適化されたプロンプトを使う

2. **表情を適切に選ぶ**
   - 褒める・励ます → `wawa`
   - 質問・説明 → `open_mouth`
   - 待機中 → `normal`

3. **メッセージのバリエーションを活用**
   - `getRandomMessage()`を使って、同じシーンでも飽きさせない

4. **ユーザーの状態に応じたメッセージ**
   - 達成率、気分、詰まり具合に応じて適切なメッセージを選択

5. **システムプロンプトは常に含める**
   - LLM API使用時は必ず`getSystemPrompt()`を含める

## 🚀 今後の拡張案

- [ ] 感情分析による自動表情選択
- [ ] ユーザーの性格に合わせたメッセージ調整
- [ ] 長期的な関係性の記録と反映
- [ ] 多言語対応
- [ ] 音声合成との連携
