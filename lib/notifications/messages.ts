/**
 * 通知メッセージのテンプレート
 */

// タスクリマインダーメッセージ
export const TASK_REMINDER_MESSAGES = [
  "あのタスク、まだやってないよ？",
  "そろそろ{taskTitle}やらなくて大丈夫？",
  "今日やるって言ってたやつ、進んでる？",
  "{taskTitle}の期限が近づいてるよ！",
  "タスクが溜まってきてるね〜",
  "ちょっとだけでも進めてみない？",
  "やることリストにまだ残ってるよ！",
  "{taskTitle}、忘れてない？",
];

// 期限切れタスクメッセージ
export const OVERDUE_TASK_MESSAGES = [
  "期限過ぎちゃったタスクあるよ！大丈夫？",
  "{taskTitle}の期限が過ぎてるんだけど...",
  "期限切れのタスクがあるね。一緒に対処しよう！",
  "やばい、{taskTitle}の締め切り過ぎてる！",
];

// 停滞タスクメッセージ（しばらく更新がない場合）
export const STALLED_TASK_MESSAGES = [
  "最近タスクの更新がないけど、調子どう？",
  "{taskTitle}のこと、どうなってる？",
  "ちょっと進捗確認させて〜！",
  "止まってるタスクがあるみたい。手伝おうか？",
  "何か困ってることある？相談のるよ！",
];

// キャラクター呼びかけメッセージ（時間帯別）
export const CHARACTER_CALL_MESSAGES = {
  morning: [
    "おはよう！今日も一緒にがんばろうね！",
    "朝だよ〜！今日のタスク確認しよ？",
    "おはよ！調子どう？",
    "いい朝だね！何から始める？",
  ],
  afternoon: [
    "お昼過ぎたよ〜！進んでる？",
    "午後もがんばろ！",
    "調子どう？疲れてない？",
    "ちょっと休憩してもいいんだよ？",
  ],
  evening: [
    "夕方だね〜！今日の進捗どう？",
    "そろそろ終わりの時間？お疲れ様！",
    "今日やったこと振り返ってみる？",
    "いい感じに進んでる？",
  ],
  night: [
    "今日もお疲れ様！明日の予定立てる？",
    "夜遅くまでお疲れ〜！無理しないでね！",
    "今日できたこと、ちゃんと褒めてあげて！",
    "ゆっくり休んでね〜！また明日！",
  ],
};

// 進捗ベースのメッセージ
export const PROGRESS_BASED_MESSAGES = {
  noProgress: [
    "まだ何も手をつけてないみたいだけど...どうした？",
    "今日は調子悪い？無理しなくていいからね",
    "ちょっとでいいから始めてみない？",
  ],
  someProgress: [
    "いい感じ！その調子！",
    "ちゃんと進んでるね！えらい！",
    "順調！もうちょっとだね！",
  ],
  almostDone: [
    "もうちょっとで終わりだ！ラストスパート！",
    "あと少し！がんばれ〜！",
    "ほぼ完成じゃん！すごい！",
  ],
  completed: [
    "やったー！全部終わったね！お疲れ様！",
    "完璧！今日は休んでいいよ！",
    "すごい！やりきったね！",
  ],
};

/**
 * ランダムにメッセージを選択
 */
export function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * タスク名を含むメッセージを生成
 */
export function formatTaskMessage(template: string, taskTitle: string): string {
  return template.replace(/{taskTitle}/g, taskTitle);
}

/**
 * 時間帯を判定
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * 進捗率からメッセージタイプを判定
 */
export function getProgressLevel(completedCount: number, totalCount: number):
  'noProgress' | 'someProgress' | 'almostDone' | 'completed' {
  if (totalCount === 0) return 'completed';
  const ratio = completedCount / totalCount;
  if (ratio === 0) return 'noProgress';
  if (ratio < 0.7) return 'someProgress';
  if (ratio < 1) return 'almostDone';
  return 'completed';
}
