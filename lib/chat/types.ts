import type { ChecklistItem } from "@/types/task-tree";
import type { QuickReply } from "@/lib/parse-quick-replies";

// ノードタイプの型定義
export type NodeType = "Goal" | "Project" | "Milestone" | "Task";

// 単一アクションの型
export interface ActionItem {
  type:
    | "add_goal"
    | "add_project"
    | "add_milestone"
    | "add_task"
    | "add_memo"
    | "add_checklist"
    | "set_completion"
    | "add_calendar_event"
    | "add_promise";
  parentId?: string;
  parentTitle?: string;
  title?: string;
  taskTitle?: string;
  nodeType?: NodeType;
  nodeId?: string;
  memo?: string; // ノード追加時のメモ、またはメモ追加時の内容
  checklistItems?: string[]; // チェックリスト項目のテキスト配列
  selected?: boolean; // 複数選択時の選択状態
  success?: boolean;
  // カレンダーイベント用
  calendarStart?: string;
  calendarEnd?: string;
  calendarDescription?: string;
  // 約束追跡用
  promiseDeadline?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ActionItem[]; // 複数アクション対応
  actionsConfirmed?: boolean; // アクション全体の確認状態
  quickReply?: QuickReply;
  emote?: "normal" | "happy" | "smug" | "calm"; // AIが選んだ表情
}

// チャットからタスクツリーを操作するためのインターフェース
// （タスクページのインラインハンドラ / lib/chat/task-actions.ts が実装する）
export interface TaskTreeActions {
  addNode: (
    parentId: string | null,
    title: string,
    nodeType: NodeType,
    memo?: string
  ) => string | void;
  updateMemo: (nodeId: string, memo: string) => void;
  updateChecklist: (nodeId: string, newItems: ChecklistItem[]) => void;
  setCompletion: (nodeId: string, completion: string) => void;
}
