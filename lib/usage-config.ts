/**
 * API利用制限の設定
 *
 * このファイルは後で変更される可能性があります。
 * 変更履歴はdocs/USAGE_LIMIT.mdを参照してください。
 *
 * @see docs/USAGE_LIMIT.md
 */

// === 利用制限設定 ===
export const USAGE_LIMITS = {
  // 1日あたりの最大往復回数（βテスト用）
  DAILY_MESSAGE_LIMIT: 40,

  // 制限リセット時刻（日本時間0時）
  RESET_HOUR_JST: 0,
} as const;

// === コスト計算用の参考値 ===
export const COST_REFERENCE = {
  // 使用モデル
  MODEL: 'gemini-2.5-flash',

  // 1リクエストあたりの推定トークン（プラン3適用後）
  TOKENS_PER_REQUEST: {
    INPUT: 1550,
    OUTPUT: 1000,
  },

  // 料金（USD per 1M tokens）
  PRICE_PER_MILLION_TOKENS: {
    INPUT: 0.15,
    OUTPUT: 0.60,
  },

  // 1日40往復の推定コスト
  ESTIMATED_DAILY_COST_YEN: 5, // 約5円/日
  ESTIMATED_MONTHLY_COST_YEN: 150, // 約150円/月（毎日MAX利用時）
} as const;

// === ヘルパー関数 ===

/**
 * 今日の日付文字列を取得（日本時間基準）
 */
export function getTodayDateString(): string {
  const now = new Date();
  // 日本時間に変換
  const jstOffset = 9 * 60; // JST is UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jstDate = new Date(utc + (jstOffset * 60000));

  return jstDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 制限到達時のメッセージ
 */
export function getLimitReachedMessage(): string {
  return `今日のお話し上限に達しちゃいました...！
明日またお話ししましょうね！

（1日${USAGE_LIMITS.DAILY_MESSAGE_LIMIT}回まで）`;
}
