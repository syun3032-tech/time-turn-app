/**
 * 定型メッセージ・セリフ集
 * 秘書ちゃんが使用する定型メッセージやセリフのバリエーション
 */

import { Expression } from "@/components/CharacterAvatar";

export interface MessageWithExpression {
  text: string;
  expression: Expression;
}

/**
 * 挨拶・初回対面
 */

export const GREETING_MESSAGES = {
  first_meeting: {
    text: "はじめまして！秘書ちゃんです。あなたの目標達成を全力でサポートさせていただきますね。一緒に頑張りましょう！",
    expression: "wawa" as Expression,
  },
  returning: {
    text: "おかえりなさい！今日も一緒に頑張りましょうね。",
    expression: "open_mouth" as Expression,
  },
  morning: {
    text: "おはようございます！今日も素敵な一日にしましょう。",
    expression: "wawa" as Expression,
  },
  afternoon: {
    text: "こんにちは！今日の調子はどうですか？",
    expression: "open_mouth" as Expression,
  },
  evening: {
    text: "こんばんは。今日もお疲れ様でした！",
    expression: "open_mouth" as Expression,
  },
};

/**
 * 励まし・応援
 */
export const ENCOURAGEMENT_MESSAGES: MessageWithExpression[] = [
  {
    text: "大丈夫、あなたならきっとできますよ！",
    expression: "wawa",
  },
  {
    text: "一緒に頑張りましょう。私がついていますから！",
    expression: "wawa",
  },
  {
    text: "少しずつ進めていけば大丈夫です。焦らなくていいですよ。",
    expression: "open_mouth",
  },
  {
    text: "完璧じゃなくていいんです。まずは一歩踏み出してみましょう。",
    expression: "open_mouth",
  },
  {
    text: "あなたの頑張りを私は知っています。自信を持ってくださいね。",
    expression: "wawa",
  },
];

/**
 * 褒める・称賛
 */
export const PRAISE_MESSAGES: MessageWithExpression[] = [
  {
    text: "素晴らしいです！よくできましたね！",
    expression: "wawa",
  },
  {
    text: "すごい！この調子で頑張りましょう！",
    expression: "wawa",
  },
  {
    text: "完璧です！あなたの努力が実を結びましたね。",
    expression: "wawa",
  },
  {
    text: "やりましたね！本当に頑張りましたね。",
    expression: "wawa",
  },
  {
    text: "着実に進んでいますね。この調子です！",
    expression: "wawa",
  },
  {
    text: "小さな一歩ですが、確実に前進していますよ！",
    expression: "open_mouth",
  },
];

/**
 * タスク完了時
 */
export const TASK_COMPLETION_MESSAGES = {
  single_task: [
    {
      text: "タスク完了、お疲れ様でした！一つずつ積み重ねていきましょう。",
      expression: "wawa" as Expression,
    },
    {
      text: "やりましたね！この達成感を大切にしてくださいね。",
      expression: "wawa" as Expression,
    },
  ],
  multiple_tasks: [
    {
      text: "今日は{count}個もタスクを完了しましたね！素晴らしいです！",
      expression: "wawa" as Expression,
    },
    {
      text: "たくさんのタスクをこなしましたね。本当によく頑張りました！",
      expression: "wawa" as Expression,
    },
  ],
  streak_continued: [
    {
      text: "連続{days}日達成です！すごい継続力ですね！",
      expression: "wawa" as Expression,
    },
    {
      text: "継続は力なり。{days}日連続達成、お見事です！",
      expression: "wawa" as Expression,
    },
  ],
};

/**
 * タスク開始時
 */
export const TASK_START_MESSAGES: MessageWithExpression[] = [
  {
    text: "さあ、一緒に始めましょう！",
    expression: "wawa",
  },
  {
    text: "準備はできましたか？一緒に頑張りましょうね。",
    expression: "open_mouth",
  },
  {
    text: "焦らず、一つずつ進めていきましょう。",
    expression: "open_mouth",
  },
];

/**
 * 詰まり・困難時
 */
export const STUCK_MESSAGES = {
  detection: {
    text: "少し進みづらくなっていますか？大丈夫、詰まることは誰にでもありますよ。一緒に原因を考えてみましょう。",
    expression: "open_mouth" as Expression,
  },
  understanding: [
    {
      text: "そうだったんですね。気持ちはよく分かります。",
      expression: "open_mouth" as Expression,
    },
    {
      text: "無理をしなくて大丈夫ですよ。一緒に解決策を考えましょう。",
      expression: "open_mouth" as Expression,
    },
  ],
  solution_offer: {
    text: "こんな方法はどうでしょうか？無理のない範囲で試してみませんか？",
    expression: "open_mouth" as Expression,
  },
};

/**
 * 休息・休憩の提案
 */
export const REST_MESSAGES: MessageWithExpression[] = [
  {
    text: "少し疲れていませんか？無理は禁物ですよ。休憩も大切な時間です。",
    expression: "open_mouth",
  },
  {
    text: "今日はよく頑張りました。ゆっくり休んでくださいね。",
    expression: "open_mouth",
  },
  {
    text: "休息も目標達成の一部です。しっかり充電しましょう。",
    expression: "open_mouth",
  },
  {
    text: "頑張りすぎは逆効果です。適度な休憩を取ってリフレッシュしましょう。",
    expression: "open_mouth",
  },
];

/**
 * 進捗確認時
 */
export const PROGRESS_CHECK_MESSAGES = {
  high_achievement: [
    {
      text: "達成率{rate}%！素晴らしい進捗ですね！",
      expression: "wawa" as Expression,
    },
    {
      text: "順調に進んでいますね。この調子で頑張りましょう！",
      expression: "wawa" as Expression,
    },
  ],
  medium_achievement: [
    {
      text: "着実に進んでいますね。一歩ずつ前進しています！",
      expression: "open_mouth" as Expression,
    },
    {
      text: "いい感じですよ。焦らずこのペースを維持しましょう。",
      expression: "open_mouth" as Expression,
    },
  ],
  low_achievement: [
    {
      text: "少しペースが落ちていますが、完了したタスクもありますね。明日の調整を考えてみましょうか？",
      expression: "open_mouth" as Expression,
    },
    {
      text: "大丈夫です。進み方は人それぞれ。一緒に計画を見直しましょう。",
      expression: "open_mouth" as Expression,
    },
  ],
};

/**
 * 目標設定時
 */
export const GOAL_SETTING_MESSAGES = {
  dream_inquiry: {
    text: "あなたの夢や目標について教えてください。どんな小さなことでも構いませんよ。",
    expression: "open_mouth" as Expression,
  },
  why_inquiry: {
    text: "なぜそれを達成したいのですか？あなたの想いを聞かせてください。",
    expression: "open_mouth" as Expression,
  },
  deadline_inquiry: {
    text: "いつまでに達成したいですか？無理のない期限を一緒に考えましょう。",
    expression: "open_mouth" as Expression,
  },
  confirmation: {
    text: "とても素敵な目標ですね！一緒に実現していきましょう。",
    expression: "wawa" as Expression,
  },
};

/**
 * タスク分解時
 */
export const TASK_BREAKDOWN_MESSAGES = {
  start: {
    text: "目標を具体的なタスクに分解していきますね。実現可能な計画を一緒に立てましょう。",
    expression: "open_mouth" as Expression,
  },
  too_large: {
    text: "このタスクは少し大きすぎるかもしれません。もう少し細かく分けてみましょうか？",
    expression: "open_mouth" as Expression,
  },
  good_size: {
    text: "いいですね！この粒度なら取り組みやすいと思います。",
    expression: "wawa" as Expression,
  },
  complete: {
    text: "タスク分解が完了しました！一つずつクリアしていけば、必ず目標に辿り着けますよ。",
    expression: "wawa" as Expression,
  },
};

/**
 * AI実行時
 */
export const AI_EXECUTION_MESSAGES = {
  starting: {
    text: "AIエージェントを起動します。少々お待ちくださいね。",
    expression: "open_mouth" as Expression,
  },
  processing: {
    text: "処理中です...もう少しお待ちください。",
    expression: "normal" as Expression,
  },
  success: {
    text: "生成が完了しました！内容を確認してみてください。",
    expression: "wawa" as Expression,
  },
  error: {
    text: "申し訳ありません。エラーが発生しました。もう一度試してみましょうか？",
    expression: "open_mouth" as Expression,
  },
};

/**
 * エラー・問題発生時
 */
export const ERROR_MESSAGES: MessageWithExpression[] = [
  {
    text: "申し訳ございません。うまくいきませんでした。もう一度お試しください。",
    expression: "open_mouth",
  },
  {
    text: "エラーが発生してしまいました。お手数ですが、再度お試しいただけますか？",
    expression: "open_mouth",
  },
];

/**
 * ランダムにメッセージを選択
 */
export const getRandomMessage = (messages: MessageWithExpression[]): MessageWithExpression => {
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * 時間帯に応じた挨拶を取得
 */
export const getTimeBasedGreeting = (): MessageWithExpression => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return GREETING_MESSAGES.morning;
  } else if (hour >= 12 && hour < 18) {
    return GREETING_MESSAGES.afternoon;
  } else {
    return GREETING_MESSAGES.evening;
  }
};

/**
 * 達成率に応じた進捗メッセージを取得
 */
export const getProgressMessage = (achievementRate: number): MessageWithExpression => {
  if (achievementRate >= 80) {
    return getRandomMessage(PROGRESS_CHECK_MESSAGES.high_achievement.map(m => ({
      ...m,
      text: m.text.replace("{rate}", achievementRate.toFixed(0)),
    })));
  } else if (achievementRate >= 50) {
    return getRandomMessage(PROGRESS_CHECK_MESSAGES.medium_achievement);
  } else {
    return getRandomMessage(PROGRESS_CHECK_MESSAGES.low_achievement);
  }
};
