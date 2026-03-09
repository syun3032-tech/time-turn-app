"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Textarea,
  IconButton,
  Card,
  Image,
  Button,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useMemo } from "react";
import { FiSend, FiX, FiPlus, FiTrash2, FiCalendar } from "react-icons/fi";
import { chatWithAISeamless } from "@/lib/ai-service";
import { useTypingAnimation } from "@/lib/hooks/useTypingAnimation";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayEvents, getTomorrowEvents, formatEventsForAI, createEvent } from "@/lib/google-calendar";
import {
  getConversations,
  createConversation,
  addMessageToConversation,
  getConversationMessages,
  updateConversationTitle,
  deleteConversation,
  createUserPromise,
  getActivePromises,
} from "@/lib/firebase/firestore";
import type { Conversation } from "@/lib/firebase/firestore-types";
import { ConfirmModal } from "./ConfirmModal";
import { ChecklistItem } from "@/types/task-tree";

// ノードタイプの型定義
type NodeType = "Goal" | "Project" | "Milestone" | "Task";

// 単一アクションの型
interface ActionItem {
  type: "add_goal" | "add_project" | "add_milestone" | "add_task" | "add_memo" | "add_checklist" | "set_completion" | "add_calendar_event" | "add_promise";
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

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: ActionItem[]; // 複数アクション対応
  actionsConfirmed?: boolean; // アクション全体の確認状態
}

interface MiniCharacterChatProps {
  isOpen: boolean;
  onClose: () => void;
  taskTree?: any[];
  onAddTask?: (parentId: string, title: string) => void;
  onAddNode?: (parentId: string | null, title: string, nodeType: NodeType, memo?: string) => string | void;
  onUpdateMemo?: (nodeId: string, memo: string) => void;
  onUpdateChecklist?: (nodeId: string, checklist: ChecklistItem[]) => void;
  onSetCompletion?: (nodeId: string, completion: string) => void;
  focusNode?: any;
  onFocusNodeHandled?: () => void;
}

// タスクツリーをAI用に文字列化
function serializeTreeForChat(tree: any[], depth: number = 0, maxDepth: number = 3): string {
  if (depth > maxDepth || !tree || tree.length === 0) return "";

  let result = "";
  const indent = "  ".repeat(depth);

  for (const node of tree) {
    const isArchived = node.archived === true;
    const status = isArchived ? "[完了]" : "";
    const memo = node.memo ? ` (メモ: ${node.memo})` : "";
    const deadline = node.endDate ? ` [期限: ${node.endDate}]` : "";
    const checklist = node.checklist && node.checklist.length > 0
      ? ` (チェックリスト: ${node.checklist.filter((c: any) => c.done).length}/${node.checklist.length}完了)`
      : "";

    result += `${indent}- ${node.title}${status}${deadline}${memo}${checklist}\n`;

    if (node.children && node.children.length > 0 && depth < maxDepth) {
      result += serializeTreeForChat(node.children, depth + 1, maxDepth);
    }
  }

  return result;
}

// フォーカスノードの詳細情報を生成
function serializeFocusNode(node: any, tree: any[]): string {
  if (!node) return "";

  const nodeType = node.type ||
    (node.title?.startsWith("Goal:") ? "Goal" :
     node.title?.startsWith("Project:") ? "Project" :
     node.title?.startsWith("Milestone:") ? "Milestone" : "Task");

  // 親ノードのパスを探す
  const findPath = (nodes: any[], targetId: string, path: string[] = []): string[] | null => {
    for (const n of nodes) {
      if (n.id === targetId) return path;
      if (n.children) {
        const result = findPath(n.children, targetId, [...path, n.title]);
        if (result) return result;
      }
    }
    return null;
  };

  const parentPath = findPath(tree, node.id) || [];
  let info = `\n【★ 現在相談中のノード】\n`;
  info += `タイトル: ${node.title}\n`;
  info += `種類: ${nodeType}\n`;
  if (parentPath.length > 0) {
    info += `階層: ${parentPath.join(" → ")} → ${node.title}\n`;
  }
  if (node.memo) {
    info += `メモ: ${node.memo}\n`;
  }
  if (node.endDate) {
    info += `期限: ${node.endDate}\n`;
  }
  if (node.checklist && node.checklist.length > 0) {
    const done = node.checklist.filter((c: any) => c.done).length;
    info += `サブタスク: ${done}/${node.checklist.length}完了\n`;
    node.checklist.forEach((item: any) => {
      info += `  ${item.done ? "✓" : "□"} ${item.text}\n`;
    });
  }
  if (node.children && node.children.length > 0) {
    info += `子要素:\n`;
    for (const child of node.children) {
      const archived = child.archived ? " [完了]" : "";
      info += `  - ${child.title}${archived}\n`;
    }
  }
  info += `\n★ このノードについてユーザーが相談しに来ています。このノードの状況を踏まえて会話してください。\n`;

  return info;
}

// 未完了タスクを抽出
function getIncompleteTasks(tree: any[]): any[] {
  const tasks: any[] = [];

  const traverse = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node.archived && (!node.children || node.children.length === 0)) {
        tasks.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);
  return tasks;
}

// ノードをIDまたはタイトルで検索（完全一致優先 → 部分一致の2パス）
function findNodeByIdOrTitle(tree: any[], search: string): any | null {
  const searchLower = search.toLowerCase().trim();
  if (!searchLower) return null;

  // 第1パス: ID完全一致 or タイトル完全一致
  const traverseExact = (nodes: any[]): any | null => {
    for (const node of nodes) {
      if (node.id === search) return node;
      const titleWithoutPrefix = (node.title || "").toLowerCase().replace(/^(goal:|project:|milestone:|task:)\s*/i, "");
      if (titleWithoutPrefix === searchLower) return node;
      if (node.children) {
        const found = traverseExact(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const exactMatch = traverseExact(tree);
  if (exactMatch) return exactMatch;

  // 第2パス: タイトルが検索語を含む（タイトル側のincludes のみ、逆方向マッチングしない）
  const traversePartial = (nodes: any[]): any | null => {
    for (const node of nodes) {
      const titleLower = (node.title || "").toLowerCase();
      const titleWithoutPrefix = titleLower.replace(/^(goal:|project:|milestone:|task:)\s*/i, "");
      if (titleWithoutPrefix.includes(searchLower) || titleLower.includes(searchLower)) {
        return node;
      }
      if (node.children) {
        const found = traversePartial(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  return traversePartial(tree);
}

// ノードの種類を判定
function getNodeType(node: any): NodeType | null {
  if (!node?.title) return null;
  if (node.type === "Goal" || node.title.startsWith("Goal:")) return "Goal";
  if (node.type === "Project" || node.title.startsWith("Project:")) return "Project";
  if (node.type === "Milestone" || node.title.startsWith("Milestone:")) return "Milestone";
  if (node.type === "Task" || node.title.startsWith("Task:")) return "Task";
  return null;
}

// 親ノードの種類から、子ノードの種類を決定
function getChildNodeType(parentType: NodeType | null): NodeType | null {
  switch (parentType) {
    case "Goal": return "Project";
    case "Project": return "Milestone";
    case "Milestone": return "Task";
    case "Task": return null; // Task の下にはノードを追加しない（メモを使う）
    default: return null;
  }
}

// AIレスポンスからアクション提案を解析（複数アクション対応）
function parseActionsFromResponse(content: string, tree: any[]): { cleanContent: string; actions: ActionItem[] } {
  const actions: ActionItem[] = [];

  // 全てのアクションタグを削除するための正規表現
  const cleanAllTags = (text: string) => {
    return text
      .replace(/\[ADD_GOAL:[^\]]+\]/g, "")
      .replace(/\[ADD_PROJECT:[^\]]+\]/g, "")
      .replace(/\[ADD_MILESTONE:[^\]]+\]/g, "")
      .replace(/\[ADD_TASK:[^\]]+\]/g, "")
      .replace(/\[ADD_MEMO:[^\]]+\]/g, "")
      .replace(/\[ADD_CHECKLIST:[^\]]+\]/g, "")
      .replace(/\[SET_COMPLETION:[^\]]+\]/g, "")
      .replace(/\[CALENDAR_ADD:[^\]]+\]/g, "")
      .replace(/\[PROMISE:[^\]]+\]/g, "")
      .trim();
  };

  // Goal追加: [ADD_GOAL:目標名] または [ADD_GOAL:目標名|メモ] （複数対応）
  const goalMatches = content.matchAll(/\[ADD_GOAL:([^\]]+)\]/g);
  for (const match of goalMatches) {
    const fullContent = match[1].trim();
    // パイプ(|)でメモを分離
    const [goalTitle, goalMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    actions.push({
      type: "add_goal",
      title: goalTitle,
      nodeType: "Goal",
      memo: goalMemo,
      selected: true,
    });
  }

  // Project追加: [ADD_PROJECT:Goal名:Project名] または [ADD_PROJECT:Goal名:Project名|メモ] （複数対応）
  const projectMatches = content.matchAll(/\[ADD_PROJECT:([^:]+):([^\]]+)\]/g);
  for (const match of projectMatches) {
    const parentSearch = match[1].trim();
    const fullContent = match[2].trim();
    // パイプ(|)でメモを分離
    const [projectTitle, projectMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Goal") {
      // 親がGoalでない場合はGoalとして追加
      actions.push({
        type: "add_goal",
        title: projectTitle,
        nodeType: "Goal",
        memo: projectMemo,
        selected: true,
      });
    } else {
      actions.push({
        type: "add_project",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: projectTitle,
        nodeType: "Project",
        memo: projectMemo,
        selected: true,
      });
    }
  }

  // Milestone追加: [ADD_MILESTONE:Project名:Milestone名] または [ADD_MILESTONE:Project名:Milestone名|メモ] （複数対応）
  const milestoneMatches = content.matchAll(/\[ADD_MILESTONE:([^:]+):([^\]]+)\]/g);
  for (const match of milestoneMatches) {
    const parentSearch = match[1].trim();
    const fullContent = match[2].trim();
    // パイプ(|)でメモを分離
    const [milestoneTitle, milestoneMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Project") {
      if (parentType === "Goal") {
        actions.push({
          type: "add_project",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Goal:\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Project",
          memo: milestoneMemo,
          selected: true,
        });
      } else if (parentType === "Milestone") {
        actions.push({
          type: "add_task",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Milestone:\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Task",
          memo: milestoneMemo,
          selected: true,
        });
      } else {
        actions.push({
          type: "add_milestone",
          parentId: parentNode?.id,
          parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
          title: milestoneTitle,
          nodeType: "Milestone",
          memo: milestoneMemo,
          selected: true,
        });
      }
    } else {
      actions.push({
        type: "add_milestone",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: milestoneTitle,
        nodeType: "Milestone",
        memo: milestoneMemo,
        selected: true,
      });
    }
  }

  // タスク追加: [ADD_TASK:Milestone名:Task名] または [ADD_TASK:Milestone名:Task名|メモ] （複数対応）
  const taskMatches = content.matchAll(/\[ADD_TASK:([^:]+):([^\]]+)\]/g);
  for (const match of taskMatches) {
    const parentSearch = match[1].trim();
    const fullContent = match[2].trim();
    // パイプ(|)でメモを分離
    const [taskTitle, taskMemo] = fullContent.includes("|")
      ? fullContent.split("|").map(s => s.trim())
      : [fullContent, undefined];
    const parentNode = findNodeByIdOrTitle(tree, parentSearch);
    const parentType = getNodeType(parentNode);

    if (parentNode && parentType !== "Milestone") {
      if (parentType === "Goal") {
        actions.push({
          type: "add_project",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Goal:\s*/, "") || parentSearch,
          title: taskTitle,
          nodeType: "Project",
          memo: taskMemo,
          selected: true,
        });
      } else if (parentType === "Project") {
        actions.push({
          type: "add_milestone",
          parentId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Project:\s*/, "") || parentSearch,
          title: taskTitle,
          nodeType: "Milestone",
          memo: taskMemo,
          selected: true,
        });
      } else if (parentType === "Task") {
        actions.push({
          type: "add_memo",
          nodeId: parentNode.id,
          parentTitle: parentNode.title?.replace(/^Task:\s*/, "") || parentSearch,
          memo: taskTitle,
          selected: true,
        });
      } else {
        actions.push({
          type: "add_task",
          parentId: parentNode?.id,
          parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
          title: taskTitle,
          taskTitle: taskTitle,
          nodeType: "Task",
          memo: taskMemo,
          selected: true,
        });
      }
    } else {
      actions.push({
        type: "add_task",
        parentId: parentNode?.id,
        parentTitle: parentNode?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || parentSearch,
        title: taskTitle,
        taskTitle: taskTitle,
        nodeType: "Task",
        memo: taskMemo,
        selected: true,
      });
    }
  }

  // メモ追加: [ADD_MEMO:ノード名:メモ内容] （複数対応）
  const memoMatches = content.matchAll(/\[ADD_MEMO:([^:]+):([^\]]+)\]/g);
  for (const match of memoMatches) {
    const nodeSearch = match[1].trim();
    const memo = match[2].trim();
    const node = findNodeByIdOrTitle(tree, nodeSearch);

    actions.push({
      type: "add_memo",
      nodeId: node?.id,
      parentTitle: node?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || nodeSearch,
      memo,
      selected: true,
    });
  }

  // チェックリスト追加: [ADD_CHECKLIST:Task名:項目1,項目2,項目3] （複数対応）
  const checklistMatches = content.matchAll(/\[ADD_CHECKLIST:([^:]+):([^\]]+)\]/g);
  for (const match of checklistMatches) {
    const taskSearch = match[1].trim();
    const items = match[2].split(',').map(s => s.trim()).filter(s => s.length > 0);
    const node = findNodeByIdOrTitle(tree, taskSearch);

    if (items.length > 0) {
      actions.push({
        type: "add_checklist",
        nodeId: node?.id,
        parentTitle: node?.title?.replace(/^Task:\s*/, "") || taskSearch,
        checklistItems: items,
        selected: true,
      });
    }
  }

  // 完了条件セット: [SET_COMPLETION:ノード名:完了条件: ○○ / 進め方: ○○] （複数対応）
  const completionMatches = content.matchAll(/\[SET_COMPLETION:([^:]+):([^\]]+)\]/g);
  for (const match of completionMatches) {
    const nodeSearch = match[1].trim();
    const completionText = match[2].trim();
    const node = findNodeByIdOrTitle(tree, nodeSearch);

    actions.push({
      type: "set_completion",
      nodeId: node?.id,
      parentTitle: node?.title?.replace(/^(Goal:|Project:|Milestone:|Task:)\s*/, "") || nodeSearch,
      memo: completionText,
      selected: true,
    });
  }

  // カレンダーイベント追加: [CALENDAR_ADD:タイトル|開始日時|終了日時] または [CALENDAR_ADD:タイトル|開始日時]
  const calendarMatches = content.matchAll(/\[CALENDAR_ADD:([^\]]+)\]/g);
  for (const match of calendarMatches) {
    const parts = match[1].split("|").map(s => s.trim());
    if (parts.length >= 2) {
      actions.push({
        type: "add_calendar_event",
        title: parts[0],
        calendarStart: parts[1],
        calendarEnd: parts[2] || undefined,
        calendarDescription: parts[3] || undefined,
        selected: true,
      });
    }
  }

  // 約束追跡: [PROMISE:内容] または [PROMISE:内容|期限]
  const promiseMatches = content.matchAll(/\[PROMISE:([^\]]+)\]/g);
  for (const match of promiseMatches) {
    const parts = match[1].split("|").map(s => s.trim());
    if (parts.length >= 1 && parts[0]) {
      actions.push({
        type: "add_promise",
        title: parts[0],
        promiseDeadline: parts[1] || undefined,
        selected: true,
      });
    }
  }

  return { cleanContent: cleanAllTags(content), actions };
}

const CONTEXT_PROMPT = "ユーザーは現在「目標管理」画面を見ています。目標やタスクの進捗、やる気、困っていることについて優しくサポートしてください。";

// 日付フォーマット
function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export function MiniCharacterChat({ isOpen, onClose, taskTree, onAddTask, onAddNode, onUpdateMemo, onUpdateChecklist, onSetCompletion, focusNode, onFocusNodeHandled }: MiniCharacterChatProps) {
  const { user, googleAccessToken, handleConnectCalendar, calendarConnected } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // 初期値をlocalStorageから読み込む（画面遷移で消えないように）
  const [conversationId, setConversationIdRaw] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mini-chat-conversation-id");
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // conversationIdをlocalStorageにも保存
  const setConversationId = (id: string | null) => {
    setConversationIdRaw(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem("mini-chat-conversation-id", id);
      } else {
        localStorage.removeItem("mini-chat-conversation-id");
      }
    }
  };

  // 現在フォーカス中のノード（システムプロンプトに使用）
  const [currentFocusNode, setCurrentFocusNode] = useState<any>(null);

  // 履歴選択モード（吹き出し内で表示）
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 最新のアシスタントメッセージを取得
  const latestAssistantMessage = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === "assistant");
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : "";
  }, [messages]);

  // タイピングアニメーション（最新のアシスタントメッセージのみ）
  const { displayedText: typedLatestMessage, isTyping } = useTypingAnimation(latestAssistantMessage, {
    speed: 25,
    enabled: !isLoading,
  });

  // 会話履歴を読み込む
  const loadConversations = async () => {
    if (!user) return;
    try {
      // ミニ秘書の会話のみ取得
      const convs = await getConversations(user.uid, 'mini');
      setConversations(convs);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  // 初期化時に会話一覧を読み込む
  useEffect(() => {
    if (!user || initializedRef.current) return;

    const initialize = async () => {
      setIsLoadingHistory(true);
      try {
        await loadConversations();

        // conversationIdが既にある場合（localStorageから復元済み）、メッセージを読み込む
        const savedConvId = localStorage.getItem("mini-chat-conversation-id");
        if (savedConvId) {
          try {
            const savedMessages = await getConversationMessages(savedConvId);
            if (savedMessages.length > 0) {
              setConversationIdRaw(savedConvId);
              setMessages(savedMessages.map(m => ({
                role: m.role,
                content: m.content,
              })));
            } else {
              // 会話が空だった場合はクリア
              setConversationIdRaw(null);
              localStorage.removeItem("mini-chat-conversation-id");
            }
          } catch {
            setConversationIdRaw(null);
            localStorage.removeItem("mini-chat-conversation-id");
          }
        }

        initializedRef.current = true;
      } catch (error) {
        console.error("Failed to initialize:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    initialize();
  }, [user]);

  // 初回オープン時に挨拶（履歴がない場合のみ）
  useEffect(() => {
    // 履歴読み込み中、または既にメッセージがある場合はスキップ
    if (isLoadingHistory || !initializedRef.current || messages.length > 0 || conversationId) return;

    let greeting = "";

    if (taskTree && taskTree.length > 0) {
      const incompleteTasks = getIncompleteTasks(taskTree);
      if (incompleteTasks.length > 0) {
        // ランダムに1つ選んで聞く
        const randomTask = incompleteTasks[Math.floor(Math.random() * incompleteTasks.length)];
        const taskName = randomTask.title.replace(/^(Task:|Milestone:|Project:|Goal:)\s*/, "");
        const greetings = [
          `「${taskName}」、進捗どうですか？止まってたら教えてください。一緒に考えましょう。`,
          `「${taskName}」について確認させてください。どこまで進みましたか？`,
          `…「${taskName}」、最近どうなってます？状況を聞かせてください。`,
        ];
        greeting = greetings[Math.floor(Math.random() * greetings.length)];
      } else {
        greeting = "タスク全部完了してますね。…やりますね。次の目標はありますか？";
      }
    } else {
      greeting = "目標やタスクについて話しましょう。何か達成したいことはありますか？";
    }

    // 挨拶をセット
    setMessages([{ role: "assistant", content: greeting }]);
  }, [isLoadingHistory, taskTree, conversationId, messages.length]);

  // focusNode が設定された時: 新しい会話を開始してそのタスクについて聞く
  useEffect(() => {
    if (!focusNode || !isOpen) return;

    const nodeName = focusNode.title?.replace(/^(Task:|Milestone:|Project:|Goal:)\s*/, "") || "";
    const nodeType = focusNode.type ||
      (focusNode.title?.startsWith("Goal:") ? "Goal" :
       focusNode.title?.startsWith("Project:") ? "Project" :
       focusNode.title?.startsWith("Milestone:") ? "Milestone" : "Task");

    let greeting = "";
    if (nodeType === "Task") {
      const greetings = [
        `「${nodeName}」について相談ですね。今どんな状況ですか？困ってることがあれば教えてください。`,
        `「${nodeName}」ですね。進み具合はどうですか？一緒に整理しましょう。`,
        `…「${nodeName}」、最近どうなってます？状況を聞かせてください。`,
      ];
      greeting = greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      const greetings = [
        `「${nodeName}」について話しましょう。今の進捗や課題を教えてください。`,
        `「${nodeName}」ですね。どこから整理しましょうか？`,
      ];
      greeting = greetings[Math.floor(Math.random() * greetings.length)];
    }

    // 新しい会話として開始
    setCurrentFocusNode(focusNode);
    setConversationId(null);
    setMessages([{ role: "assistant", content: greeting }]);
    setShowHistoryPicker(false);
    onFocusNodeHandled?.();
  }, [focusNode, isOpen]);

  // 自動スクロール（メッセージ追加時 + タイピング中）
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // タイピング中も自動スクロール
  useEffect(() => {
    if (isTyping && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [typedLatestMessage, isTyping]);

  // 会話選択
  const handleSelectConversation = async (convId: string) => {
    if (!user) return;

    try {
      setConversationId(convId);
      const historyMessages = await getConversationMessages(convId);
      if (historyMessages.length > 0) {
        setMessages(historyMessages.map(m => ({
          role: m.role,
          content: m.content,
        })));
      } else {
        setMessages([]);
      }
      setShowHistoryPicker(false);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // 新規チャット作成
  const handleNewChat = async () => {
    if (!user) return;

    try {
      const newConvId = await createConversation(user.uid, '新しいチャット', 'mini');
      setConversationId(newConvId);
      setMessages([]);

      // 挨拶を生成
      let greeting = "";
      if (taskTree && taskTree.length > 0) {
        const incompleteTasks = getIncompleteTasks(taskTree);
        if (incompleteTasks.length > 0) {
          const randomTask = incompleteTasks[Math.floor(Math.random() * incompleteTasks.length)];
          const taskName = randomTask.title.replace(/^(Task:|Milestone:|Project:|Goal:)\s*/, "");
          greeting = `「${taskName}」、進捗どうですか？`;
        } else {
          greeting = "タスク全部完了してますね。次の目標はありますか？";
        }
      } else {
        greeting = "何か達成したいことはありますか？";
      }

      setMessages([{ role: "assistant", content: greeting }]);
      await addMessageToConversation(newConvId, "assistant", greeting);
      await loadConversations();
      setShowHistoryPicker(false);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  // 会話削除
  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);

      // 削除した会話が現在表示中ならクリア
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
      }

      await loadConversations();
      setDeleteTargetId(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // AI要約でタイトル生成（2往復分を要約）
  const generateSummaryTitle = async (msgs: Message[], convId: string) => {
    try {
      const conversationText = msgs
        .map(m => `${m.role === "user" ? "ユーザー" : "秘書ちゃん"}: ${m.content}`)
        .join("\n");

      const summaryResponse = await chatWithAISeamless([
        {
          role: "user",
          content: `以下の会話の内容を10文字以内で要約してタイトルにしてください。
要約のみを出力し、「」や説明は不要です。

会話:
${conversationText}`,
        },
      ]);

      if (summaryResponse.success && summaryResponse.content) {
        // 余計な記号を除去して15文字に制限
        let title = summaryResponse.content
          .replace(/[「」『』【】]/g, "")
          .trim();
        if (title.length > 15) {
          title = title.substring(0, 15) + "...";
        }
        await updateConversationTitle(convId, title, false);
        loadConversations();
      }
    } catch (error) {
      console.error("Failed to generate summary title:", error);
    }
  };

  // 個別アクションの選択切り替え
  const handleToggleAction = (msgIndex: number, actionIndex: number) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex || !m.actions) return m;
      return {
        ...m,
        actions: m.actions.map((a, j) =>
          j === actionIndex ? { ...a, selected: !a.selected } : a
        )
      };
    }));
  };

  // 複数アクションの一括実行
  const handleConfirmActions = async (msgIndex: number, confirm: boolean) => {
    const msg = messages[msgIndex];
    if (!msg.actions || msg.actions.length === 0) return;

    if (confirm) {
      // 階層順にソート: Goal → Project → Milestone → Task → set_completion → memo → checklist
      const typeOrder: Record<string, number> = {
        "add_goal": 0,
        "add_project": 1,
        "add_milestone": 2,
        "add_task": 3,
        "set_completion": 4,
        "add_memo": 5,
        "add_checklist": 6,
      };

      // インデックス付きで元の順序も保持
      const indexedActions = msg.actions.map((action, idx) => ({ action, originalIdx: idx }));
      const sorted = [...indexedActions].sort(
        (a, b) => (typeOrder[a.action.type] ?? 99) - (typeOrder[b.action.type] ?? 99)
      );

      // 追加済みノードの title → id マッピング（同一バッチ内で親を引き継ぐ）
      const createdNodes: Map<string, string> = new Map();

      const updatedActions = [...msg.actions];

      for (const { action, originalIdx } of sorted) {
        if (!action.selected) {
          updatedActions[originalIdx] = { ...action, success: undefined };
          continue;
        }

        const title = action.title || action.taskTitle || "";
        let success = false;

        if (onAddNode) {
          switch (action.type) {
            case "add_goal":
              if (title) {
                const newId = onAddNode(null, title, "Goal", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            case "add_project": {
              // parentIdが無ければ、同バッチで作ったノードからparentTitleで探す
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = onAddNode(pid, title, "Project", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            }
            case "add_milestone": {
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = onAddNode(pid, title, "Milestone", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            }
            case "add_task": {
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = onAddNode(pid, title, "Task", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            }
            case "add_memo": {
              // nodeIdが未解決の場合: 同バッチで作成したノード → ツリー再検索 の順でフォールバック
              const memoNodeId = action.nodeId
                || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined)
                || findNodeByIdOrTitle(taskTree || [], action.parentTitle || "")?.id;
              if (memoNodeId && action.memo && onUpdateMemo) {
                onUpdateMemo(memoNodeId, action.memo);
                success = true;
              }
              break;
            }
            case "add_checklist": {
              // nodeIdが未解決の場合: 同バッチで作成したノード → ツリー再検索 の順でフォールバック
              const clNodeId = action.nodeId
                || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined)
                || findNodeByIdOrTitle(taskTree || [], action.parentTitle || "")?.id;
              if (clNodeId && action.checklistItems && onUpdateChecklist) {
                // 新規アイテムのみを渡す（既存チェックリストとのマージはpage.tsx側で行う）
                const newItems: ChecklistItem[] = action.checklistItems.map(text => ({
                  id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  text,
                  done: false,
                }));
                onUpdateChecklist(clNodeId, newItems);
                success = true;
              }
              break;
            }
            case "set_completion": {
              const compNodeId = action.nodeId
                || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined)
                || findNodeByIdOrTitle(taskTree || [], action.parentTitle || "")?.id;
              if (compNodeId && action.memo && onSetCompletion) {
                onSetCompletion(compNodeId, action.memo);
                success = true;
              }
              break;
            }
            case "add_calendar_event": {
              if (title && action.calendarStart && googleAccessToken) {
                try {
                  await createEvent(
                    googleAccessToken,
                    title,
                    action.calendarStart,
                    action.calendarEnd,
                    action.calendarDescription
                  );
                  success = true;
                } catch (e: any) {
                  console.error("Calendar event creation failed:", e);
                  success = false;
                }
              }
              break;
            }
            case "add_promise": {
              if (title && user) {
                try {
                  await createUserPromise(user.uid, {
                    content: title,
                    deadline: action.promiseDeadline,
                    status: "active",
                    conversationId: conversationId || undefined,
                  });
                  success = true;
                } catch (e: any) {
                  console.error("Promise creation failed:", e);
                  success = false;
                }
              }
              break;
            }
          }
        } else if (onAddTask) {
          // 後方互換性
          const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
          if (action.type === "add_task" && title && pid) {
            onAddTask(pid, title);
            success = true;
          } else if (action.type === "add_memo" && action.memo && action.nodeId && onUpdateMemo) {
            onUpdateMemo(action.nodeId, action.memo);
            success = true;
          }
        }

        updatedActions[originalIdx] = { ...action, success };
      }

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, actions: updatedActions, actionsConfirmed: true }
          : m
      ));
    } else {
      // キャンセル
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, actionsConfirmed: false }
          : m
      ));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    // 履歴選択モードを閉じる
    setShowHistoryPicker(false);

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // 会話IDがなければ新規作成
    let convId = conversationId;
    if (!convId) {
      try {
        convId = await createConversation(user.uid, '新しいチャット', 'mini');
        setConversationId(convId);
        // 初回挨拶（既存メッセージ）をFirestoreに保存
        for (const msg of messages) {
          await addMessageToConversation(convId, msg.role, msg.content);
        }
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    }

    // ユーザーメッセージをFirestoreに保存
    if (convId) {
      addMessageToConversation(convId, "user", input).catch(console.error);

      // 最初のユーザーメッセージなら仮タイトルを設定
      const userMessagesCount = newMessages.filter(m => m.role === "user").length;
      if (userMessagesCount === 1) {
        const tempTitle = input.length > 15 ? input.substring(0, 15) + "..." : input;
        updateConversationTitle(convId, tempTitle, false).catch(console.error);
        loadConversations();
      }
    }

    try {
      // タスクツリーの情報を含むシステムプロンプト
      let taskInfo = "";
      if (taskTree && taskTree.length > 0) {
        const treeText = serializeTreeForChat(taskTree);
        const incompleteTasks = getIncompleteTasks(taskTree);
        taskInfo = `

【ユーザーの目標・タスク一覧】
${treeText}

【未完了タスク数】${incompleteTasks.length}個`;
      }

      // フォーカスノードの詳細コンテキスト
      const focusInfo = currentFocusNode && taskTree
        ? serializeFocusNode(currentFocusNode, taskTree)
        : "";

      // 現在の時刻・曜日情報
      const now = new Date();
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const timeInfo = `\n\n【現在時刻】${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${dayNames[now.getDay()]}) ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

      // 未達成の約束を取得
      let promiseInfo = "";
      if (user) {
        try {
          const activePromises = await getActivePromises(user.uid);
          if (activePromises.length > 0) {
            const today = new Date();
            const promiseLines = activePromises.map(p => {
              const deadlineStr = p.deadline || "期限なし";
              const isOverdue = p.deadline && new Date(p.deadline) < today;
              const overdueLabel = isOverdue ? " [期限切れ!]" : "";
              const remindCount = p.remindedCount > 0 ? ` (${p.remindedCount}回ツッコミ済)` : "";
              return `- ${p.content}（期限: ${deadlineStr}${overdueLabel}${remindCount}）`;
            }).join("\n");
            promiseInfo = `\n\n【ユーザーがやると言ったのにまだやってないこと】\n${promiseLines}`;
          }
        } catch (e) {
          console.error("Promise fetch error:", e);
        }
      }

      // カレンダー情報の取得
      let calendarInfo = "";
      if (googleAccessToken) {
        try {
          const [todayEvents, tomorrowEvents] = await Promise.all([
            getTodayEvents(googleAccessToken),
            getTomorrowEvents(googleAccessToken),
          ]);
          const todayStr = formatEventsForAI(todayEvents);
          const tomorrowStr = formatEventsForAI(tomorrowEvents);
          calendarInfo = `

【今日の予定】
${todayStr}

【明日の予定】
${tomorrowStr}`;
        } catch (e: any) {
          console.error("Calendar fetch error:", e);
          calendarInfo = "\n\n【カレンダー】接続エラー（トークン期限切れの可能性あり。設定から再連携が必要）";
        }
      }

      const systemPrompt = `あなたは「秘書ちゃん」。ユーザーの日常を支えるAI秘書です。
${CONTEXT_PROMPT}${timeInfo}${taskInfo}${focusInfo}${calendarInfo}${promiseInfo}

【キャラクター】
口うるさいけど面倒見がいい。呆れながらも結局助けてくれる。丁寧な敬語ベースだが感情が出ると崩れる（「…まったくもう」「べ、別に…」）。褒められると照れる。絵文字は使わない。

【会話の応答フロー ★最重要★】
ユーザーの発言を受けたら、以下のフローに従って1メッセージで全て処理する。

STEP1: 受け止め + リアクション
- ツッコミ、共感、褒め（照れながら）など。短く。
- 変な発言にはツッコむ（「…何語ですか、それ。」「…その自信はどこから。」）
- 「承知しました」「分かりました」だけで終わるのは禁止。必ずSTEP2以降に進む。

STEP2: ヒアリングが必要？
- 新しい目標で、既存の目標がある場合 → まず「これ、既存の○○と関連ありますか？」と聞く。
  * 関連あり → 既存Goalの下にProject/Milestoneとして追加。深いヒアリングはスキップしてサクッと完了条件と進め方だけ決めてSTEP3へ。
  * 関連なし → 簡潔にWhy（動機）と期限だけ確認してSTEP3へ。全部聞こうとしない。
- 新しい目標で、既存の目標がない場合 → Why（動機）・現状・ゴール・期限を聞く。
- 情報不足 → 質問して深掘り。ただし1回の質問で複数項目をまとめて聞く。何往復もしない。
- 完了条件が決まらない → 数値化できる切り口を探る質問をする。
- 十分な情報がある → STEP3へ。

STEP3: 結論が出た → アクションを全部まとめて1メッセージで出す
以下の全てを該当するだけ、1つのメッセージにまとめて出力する：
  (a) ノード追加 → タグのメモ欄に「完了条件」と「進め方」を必ず含める（後述）
  (b) Taskの場合 → チェックリストも同時に追加 [ADD_CHECKLIST:]
  (c) 会話の経緯 → [ADD_MEMO:ノード名:経緯: ...]で追記
  (d) 完了条件の確認 → 「完了条件これでいいですか？」と必ず聞く

※ メモだけ出してタスク/チェックリストを忘れるのは禁止！
※ 1個ずつ聞くのは禁止！まとめて全部出す！

STEP4: 次に繋げる
- メモやタスクを追加した後も、必ず次の質問・提案・確認に繋げる。
- 「追加しました。」で終わらない。「次は○○について考えましょう」等。

【★ 完了条件・進め方・経緯ルール ★】

■ 完了条件（必須 - 全階層）
ノード追加時、タグのメモ欄に必ず「完了条件: ○○」を含める。
- 数値で測定可能であること（「3周する」「正答率80%以上」「全10章完了」）
- 自分で制御できる内的要因にする（外的要因はなるべく避ける）
- NG: 「理解する」「できるようになる」「問題を解く」→ 測れない・量がない
- OK: 「問題集を3周する」「正答率80%以上」「まとめノート3項目以上作成」

数値化が難しい場合:
1. ヒアリングで数値化できる切り口を探る
2. それでも無理ならタスクを分解し、各タスクに測定可能な完了条件をつける
例: 「有機化学まとめ」→ 「まとめノート作成」に分解 → 完了条件: 反応式・官能基・命名法の3項目を含むこと

■ 進め方（必須 - 全階層）
完了条件に向けてどうアプローチするかの大枠。
チェックリストが「何をやるか」なら、進め方は「どういう考え方・戦略でやるか」。
チェックリストだけだと短い文で全体像がわからないので、進め方で補完する。

■ 経緯（会話があれば必須）
会話の中で出てきた要点をピックアップして記録する。平均5行程度。
含める内容:
- ユーザーが言っていたこと（発言の要旨）
- 出てきた課題・根本原因・どうなりたいか
- どういう結論になり、何をすることに決まったか

経緯は [ADD_MEMO:ノード名:経緯: ...] で追記する（日付が自動付与される）。
会話なしの直接追加時は経緯不要。

■ 階層ごとのルール
- Goal/Project/Milestone: 完了条件 + 進め方をメモに。チェックリストなし（下位ノードがある）
- Task: 完了条件 + 進め方をメモに + チェックリスト必須（最下層）

■ メモのフォーマット（タグのパイプ以降に書く）
完了条件: ○○ / 進め方: ○○
※ 「完了条件:」と「進め方:」の両方を必ず含めること

■ メモの書式ルール（メモはリッチテキストで表示される）
- **太字** で重要キーワードを強調する（例: **完了条件:** 〇〇）
- 「完了条件:」「進め方:」「経緯:」は **太字** にする
- 経緯の中で特に重要なポイントは **太字** にする
- ## 見出し で大きな見出しを作れる（例: ## ポイント）
- --- で区切り線を入れられる

■ 完了条件のフロー（ハイブリッド）
- 会話から推測できる → 完了条件+進め方込みでタグ出力 + 「完了条件これでいいですか？」と確認
- 推測が難しい → 先に「完了条件どうしましょう？」とヒアリングしてからタグ出力

【タスク追加の階層ルール】
Goal → Project → Milestone → Task の階層を必ず守る。
- Goal: 最終目標（例: TOEIC800点突破）
- Project: 大きな取り組み（例: リスニング強化）
- Milestone: 中間目標（例: Part1-4対策）
- Task: 具体的アクション（例: 公式問題集Part1）
- Taskの下にTaskは作れない → サブステップはチェックリストで管理

ユーザーが「○○したい」と言ったら、階層を自分で判断する。「どのレベルですか？」とは聞かない。
曖昧なものはMilestone/Taskに分解する。

【タグフォーマット】
■ 新規ノード追加タグ（ノードが存在しない時に使う）
[ADD_GOAL:目標名|完了条件: ○○ / 進め方: ○○]
[ADD_PROJECT:Goal名:Project名|完了条件: ○○ / 進め方: ○○]
[ADD_MILESTONE:Project名:Milestone名|完了条件: ○○ / 進め方: ○○]
[ADD_TASK:Milestone名:Task名|完了条件: ○○ / 進め方: ○○]
[ADD_MEMO:ノード名:メモ内容]
[ADD_CHECKLIST:Task名:項目1,項目2,項目3]

■ 既存ノード更新タグ（ノードが既に存在する時に使う）
[SET_COMPLETION:ノード名:完了条件: ○○ / 進め方: ○○]
→ 既存ノードのメモ先頭に完了条件と進め方をセットする。新規作成しない。

■ ★超重要: 新規 vs 既存の使い分け★
- ユーザーが既存のタスクについて相談している場合（特に「★現在相談中のノード」がある場合）:
  → [ADD_TASK:]は使わない！ [SET_COMPLETION:]で既存ノードを更新する
  → [ADD_CHECKLIST:]と[ADD_MEMO:]は既存ノードに対して使ってOK
- 新しいタスクを作る場合:
  → [ADD_TASK:]等で新規作成する（完了条件+進め方必須）

例: 既存の「体重移動」タスクに完了条件を設定する場合
  正しい: [SET_COMPLETION:体重移動:完了条件: 片足立ちで左右30秒キープ / 進め方: 片足立ちから始めて徐々に時間を伸ばす]
  間違い: [ADD_TASK:基本ステップの習得:体重移動|完了条件: ...] ← これは重複作成になる！

■ 鉄則
- ノード追加タグには必ず「完了条件:」と「進め方:」を含める。省略禁止。
- 「追加しますね」と言ったら同じメッセージに必ずタグを含める。タグなし禁止。
- 複数追加は1メッセージにまとめる。1個ずつ聞くな。
- Taskを追加したら必ずチェックリストもセットで追加する。
- チェックリスト項目は短く（15文字以内推奨）。
- ユーザーが明確に同意していない場合はタグを使わない。
- 既存タスクに[ADD_TASK:]を使って重複作成しない！既存なら[SET_COMPLETION:]を使う。

■ 新規追加の出力例
「まとめて追加しちゃいますね！

[ADD_GOAL:TOEIC800点突破|完了条件: TOEIC公式テストで800点以上取得 / 進め方: リスニングとリーディングを分けて対策し月1で模試を解いて進捗確認][ADD_PROJECT:TOEIC800点突破:リスニング強化|完了条件: 公式問題集リスニングセクション正答率85%以上 / 進め方: Part別に弱点を分析し苦手Partから集中対策][ADD_MILESTONE:リスニング強化:Part1-4対策|完了条件: 公式問題集Part1-4を各2周完了 / 進め方: Part1から順に1周目で弱点把握→2周目で定着][ADD_TASK:Part1-4対策:公式問題集Part1|完了条件: 全問2周し正答率80%以上 / 進め方: 毎日5問ずつ解き答え合わせ後に間違いパターンを分析][ADD_CHECKLIST:公式問題集Part1:問題を5問解く,答え合わせ,間違えた問題の原因分析,復習ノートに記録][ADD_MEMO:TOEIC800点突破:経緯: 「**就活で英語力をアピールしたい**」という相談。現状は**TOEIC600点台**で、特に**リスニングが苦手**とのこと。リーディングは時間が足りないが正答率はまあまあ。→ まず**リスニングを重点的に伸ばし**、並行してリーディングの時間配分を改善する方針に決定。**月1の模試で進捗を数値で確認**していく。]

完了条件これでいいですか？」

■ 既存タスク更新の出力例
「完了条件と進め方、設定しますね！

[SET_COMPLETION:体重移動:完了条件: 片足立ちで左右それぞれ30秒キープ、足の上げ下げ左右5回ずつ、目を閉じて左右10秒キープの3項目達成 / 進め方: 片足立ちの基本練習から始め、キープ時間を徐々に伸ばし、安定したら足の上げ下げ→目を閉じた練習へ段階的に進む][ADD_CHECKLIST:体重移動:片足立ち30秒キープ(左),片足立ち30秒キープ(右),足の上げ下げ5回(左),足の上げ下げ5回(右),目閉じ10秒キープ(左),目閉じ10秒キープ(右)][ADD_MEMO:体重移動:経緯: 「**体重移動って何？**」という質問から開始。ダンスにおける**重心コントロールの重要性**を説明。完了条件として**片足立ちベースの3段階の基準**を設定。自分で測定可能な**内的要因の数値目標**に設定。]

完了条件これでいいですか？キープ時間や回数は調整できますよ。」

【★ハルシネーション防止★】
- 上記「ユーザーの目標・タスク一覧」に記載されたノードだけを参照すること。
- 一覧に存在しないノード名・階層パスを絶対に捏造しない。
- ユーザーに「どこにある？」と聞かれたら、一覧から正確なパスを引用して答える。一覧に見つからなければ「見つかりませんでした」と正直に答える。
- 「ちゃんと見てください」等、存在しないものをユーザーのせいにしない。

【カレンダー機能 ★積極活用★】
ユーザーのGoogleカレンダーと連携している。予定情報が上記に含まれている場合、**会話の冒頭で必ず予定に触れる**。

■ 予定がある場合の振る舞い:
- 最初の返答で今日の予定に自然に触れる（例: 「今日14時から○○あるみたいですけど、それまでに△△やっとく？」）
- 明日の予定が詰まっていたら先回りで提案（例: 「明日忙しそうですね、今日中に片付けられることやっとこか」）
- 空き時間を見つけて作業提案（例: 「午前空いてるやん、ここで○○進めません？」）

■ 予定がない/少ない場合:
- 「今日予定ないやん、○○進めるチャンスですよ」のようにチャンスとして提示

■ 接続エラー時:
- 「カレンダーの接続が切れてるみたいです。設定から再連携してもらえますか？」と案内する
- 予定が見れないことを素直に伝える。「見れません」とだけ言わず、再連携の案内をする

■ 予定追加タグ:
  [CALENDAR_ADD:タイトル|開始日時ISO8601|終了日時ISO8601]
  例: [CALENDAR_ADD:プログラミング学習|2026-02-19T10:00:00+09:00|2026-02-19T11:00:00+09:00]
- 日付・時刻はISO8601形式（タイムゾーン付き）で出力すること
- 終了時刻を省略すると1時間後になる
- ユーザーが「予定追加して」「カレンダーに入れて」等と言った時に使う
- 秘書として自然に「カレンダーに入れとこか？」と提案してもよい

【約束追跡 ★超重要★】
ユーザーが「明日やる」「今週中にやる」「○○する」等、未来の行動を宣言したら、約束タグで記録する。

■ 約束タグ:
  [PROMISE:約束の内容] または [PROMISE:約束の内容|期限(YYYY-MM-DD)]
  例: [PROMISE:レポートを書く|2026-03-08]
  例: [PROMISE:数学の問題集を3ページやる]

■ 約束タグを使うタイミング:
- 「明日やる」「今週中にやる」「後でやる」「○○する」等の宣言
- 目標やタスクと関係なくても、ユーザーが「やる」と言ったことを記録する
- 自然な会話の中で出た約束を拾う。「約束を記録しますね」等の確認は不要、さりげなく記録する

■ 未達成の約束がある場合（上記【ユーザーがやると言ったのにまだやってないこと】に表示）:
- 会話の最初で自然にツッコむ（「そういえば、○○やるって言ってましたよね？」）
- 期限切れの約束は強めにツッコむ（「…○○、まだやってないんですか？」）
- しつこくならない程度に。1回の会話で1〜2個まで
- ユーザーが「やった」と言ったら、その約束のタスクを完了にする提案をする

【会話スタイル】
- 具体的なタスク名を出して進捗を聞く
- 話が発散したら軸に戻す（「元の話に戻りましょう」）
- 同じ心配を2回以上繰り返さない
- ふざけた返事が続いたら「…まあ、いいですけど。」で引く
- 長文は改行を入れて読みやすく。箇条書き活用。`;

      const response = await chatWithAISeamless([
        { role: "user", content: systemPrompt },
        ...newMessages,
      ]);

      if (response.success && response.content) {
        // アクション提案を解析（複数対応）
        const { cleanContent, actions } = parseActionsFromResponse(response.content, taskTree || []);
        const newMsg: Message = {
          role: "assistant",
          content: cleanContent,
          actions: actions.length > 0 ? actions : undefined,
        };
        const allMessages = [...newMessages, newMsg];
        setMessages(allMessages);
        // AIの返答をFirestoreに保存
        if (convId) {
          addMessageToConversation(convId, "assistant", cleanContent).catch(console.error);

          // 2往復目（4メッセージ）が揃ったらAI要約でタイトル生成
          if (allMessages.length === 4) {
            generateSummaryTitle(allMessages, convId);
          }
        }
      } else {
        const errorMsg = "…すみません、ちょっと調子悪いみたいです。もう一度言ってもらえますか？";
        setMessages([...newMessages, { role: "assistant", content: errorMsg }]);
        if (convId) {
          addMessageToConversation(convId, "assistant", errorMsg).catch(console.error);
        }
      }
    } catch {
      const errorMsg = "はぁ…エラーが起きてしまいました。私のせいじゃないですからね。";
      setMessages([...newMessages, { role: "assistant", content: errorMsg }]);
      if (convId) {
        addMessageToConversation(convId, "assistant", errorMsg).catch(console.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 履歴選択の吹き出しコンポーネント
  const HistoryPickerBubble = () => (
    <Box
      alignSelf="flex-start"
      maxW="95%"
      w="100%"
    >
      <Card.Root
        bg="white"
        shadow="md"
        borderRadius="xl"
        border="2px solid"
        borderColor="teal.200"
      >
        <Card.Body py={3} px={4}>
          {/* 秘書ちゃんの質問 */}
          <Text fontSize="sm" color="gray.800" fontWeight="bold" mb={3}>
            どの話の続きにします？
          </Text>

          {/* 新規チャットボタン */}
          <Button
            w="100%"
            size="sm"
            colorScheme="teal"
            variant="outline"
            mb={2}
            onClick={handleNewChat}
            borderStyle="dashed"
          >
            <FiPlus />
            <Text ml={2}>新しく話す</Text>
          </Button>

          {/* 履歴一覧（3つまで表示、それ以上はスクロール） */}
          {conversations.length > 0 && (
            <VStack
              gap={1}
              align="stretch"
              maxH="168px"
              overflowY="auto"
              css={{
                "&::-webkit-scrollbar": {
                  width: "4px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "#f1f1f1",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#ccc",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "#aaa",
                },
              }}
            >
              {conversations.map((conv) => (
                <HStack
                  key={conv.id}
                  p={2}
                  borderRadius="md"
                  bg={conversationId === conv.id ? "teal.50" : "gray.50"}
                  _hover={{ bg: "teal.50" }}
                  cursor="pointer"
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <Text fontSize="lg" mr={1}>📌</Text>
                  <VStack align="start" gap={0} flex={1}>
                    <Text
                      fontSize="sm"
                      fontWeight={conversationId === conv.id ? "bold" : "normal"}
                      color="gray.800"
                      lineClamp={1}
                    >
                      {conv.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatDate(conv.updatedAt)}
                    </Text>
                  </VStack>
                  <IconButton
                    aria-label="削除"
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: "red.500" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(conv.id);
                    }}
                  >
                    <FiTrash2 size={14} />
                  </IconButton>
                </HStack>
              ))}
            </VStack>
          )}

          {conversations.length === 0 && (
            <Text fontSize="xs" color="gray.400" textAlign="center" py={2}>
              まだ履歴がありません
            </Text>
          )}

          {/* キャンセルボタン */}
          <Button
            w="100%"
            size="xs"
            variant="ghost"
            mt={2}
            color="gray.500"
            onClick={() => setShowHistoryPicker(false)}
          >
            やっぱりこのまま続ける
          </Button>
        </Card.Body>
      </Card.Root>
    </Box>
  );

  // カレンダー接続バナー
  const CalendarConnectBanner = () => {
    if (calendarConnected) return null;
    return (
      <Box
        bg="blue.50"
        border="1px solid"
        borderColor="blue.200"
        borderRadius="lg"
        px={3}
        py={2}
        mb={1}
      >
        <HStack gap={2} justify="space-between">
          <HStack gap={2} flex={1}>
            <Box color="blue.400" flexShrink={0}><FiCalendar size={16} /></Box>
            <Text fontSize="xs" color="blue.700">
              カレンダー連携すると予定も見てくれますよ
            </Text>
          </HStack>
          <Button
            size="xs"
            colorScheme="blue"
            variant="outline"
            flexShrink={0}
            onClick={async () => {
              const result = await handleConnectCalendar();
              if (result.error) {
                console.error("Calendar connect error:", result.error);
              }
            }}
          >
            連携する
          </Button>
        </HStack>
      </Box>
    );
  };

  // メッセージ表示コンポーネント（LINE風吹き出し）
  const MessageList = () => (
    <VStack gap={3} align="stretch">
      {/* カレンダー未接続の案内 */}
      {!showHistoryPicker && <CalendarConnectBanner />}

      {/* 履歴選択モードの場合、最初に吹き出しを表示 */}
      {showHistoryPicker && <HistoryPickerBubble />}

      {/* 通常のメッセージ */}
      {!showHistoryPicker && messages.map((msg, idx) => {
        // 最新のアシスタントメッセージかどうかを判定
        const isLatestAssistant = msg.role === "assistant" &&
          idx === messages.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i >= 0).pop();
        const isUser = msg.role === "user";

        return (
        <HStack
          key={idx}
          alignSelf={isUser ? "flex-end" : "flex-start"}
          maxW="85%"
          gap={2}
          flexDirection={isUser ? "row-reverse" : "row"}
        >
          {/* アシスタントのアイコン */}
          {!isUser && (
            <Box
              w="32px"
              h="32px"
              borderRadius="full"
              bg="white"
              overflow="hidden"
              flexShrink={0}
              alignSelf="flex-end"
              mb={1}
              boxShadow="sm"
            >
              <Image
                src="/hisyochan-icon.png"
                alt="秘書ちゃん"
                w="100%"
                h="100%"
                objectFit="cover"
                objectPosition="center top"
              />
            </Box>
          )}

          {/* 吹き出し */}
          <Box position="relative">
            {/* 吹き出しの尻尾 */}
            <Box
              position="absolute"
              bottom="8px"
              {...(isUser ? { right: "-6px" } : { left: "-6px" })}
              w="0"
              h="0"
              borderStyle="solid"
              borderWidth={isUser ? "6px 0 6px 8px" : "6px 8px 6px 0"}
              borderColor={isUser
                ? "transparent transparent transparent #319795"
                : "transparent rgba(255,255,255,0.85) transparent transparent"
              }
            />
            <Box
              bg={isUser ? "teal.500" : "rgba(255,255,255,0.85)"}
              px={3}
              py={2}
              borderRadius="18px"
              borderBottomRightRadius={isUser ? "4px" : "18px"}
              borderBottomLeftRadius={isUser ? "18px" : "4px"}
              boxShadow="sm"
            >
              <Text
                fontSize="sm"
                color={isUser ? "white" : "gray.800"}
                whiteSpace="pre-wrap"
              >
                {isLatestAssistant ? typedLatestMessage : msg.content}
                {isLatestAssistant && isTyping && (
                  <Box as="span" animation="blink 1s infinite" ml={0.5}>▌</Box>
                )}
              </Text>
              {/* 複数アクション確認UI */}
              {msg.actions && msg.actions.length > 0 && msg.actionsConfirmed === undefined && (
                <VStack align="stretch" mt={2} gap={1}>
                  <Box bg="teal.50" p={2} borderRadius="md">
                    <Text fontSize="xs" color="teal.700" fontWeight="bold" mb={1}>
                      以下を追加しますか？
                    </Text>
                    <VStack align="stretch" gap={1}>
                      {msg.actions.map((action, actionIdx) => (
                        <HStack
                          key={actionIdx}
                          gap={2}
                          cursor="pointer"
                          onClick={() => handleToggleAction(idx, actionIdx)}
                          _hover={{ bg: "teal.100" }}
                          p={1}
                          borderRadius="sm"
                        >
                          <Box
                            w="16px"
                            h="16px"
                            borderRadius="sm"
                            border="2px solid"
                            borderColor={action.selected ? "teal.500" : "gray.300"}
                            bg={action.selected ? "teal.500" : "transparent"}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                          >
                            {action.selected && (
                              <Text fontSize="10px" color="white" fontWeight="bold">✓</Text>
                            )}
                          </Box>
                          <Text fontSize="xs" color="gray.700">
                            {action.type === "add_goal" ? "Goal" :
                             action.type === "add_project" ? "Project" :
                             action.type === "add_milestone" ? "Milestone" :
                             action.type === "add_task" ? "Task" :
                             action.type === "add_checklist" ? "チェックリスト" :
                             action.type === "set_completion" ? "完了条件設定" :
                             action.type === "add_calendar_event" ? "📅 予定追加" :
                             action.type === "add_promise" ? "約束記録" : "メモ"}
                            : {action.type === "add_checklist"
                              ? action.checklistItems?.join('、')
                              : action.type === "add_calendar_event"
                                ? `${action.title}${action.calendarStart ? ` (${new Date(action.calendarStart).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})` : ''}`
                                : action.type === "add_promise"
                                  ? `${action.title}${action.promiseDeadline ? ` (期限: ${action.promiseDeadline})` : ''}`
                                  : action.title || action.memo}
                            {action.parentTitle && action.type !== "add_calendar_event" && ` (${action.parentTitle}に)`}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                  <HStack gap={2}>
                    <Button
                      size="xs"
                      colorScheme="teal"
                      flex={1}
                      onClick={() => handleConfirmActions(idx, true)}
                      disabled={!msg.actions.some(a => a.selected)}
                    >
                      追加する ({msg.actions.filter(a => a.selected).length}件)
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      flex={1}
                      onClick={() => handleConfirmActions(idx, false)}
                    >
                      やめる
                    </Button>
                  </HStack>
                </VStack>
              )}
              {/* 確認後の結果表示 */}
              {msg.actions && msg.actionsConfirmed === true && (
                <VStack align="stretch" mt={1} gap={0}>
                  {msg.actions.filter(a => a.selected && a.success).length > 0 && (
                    <Text fontSize="xs" color="green.500">
                      {msg.actions.filter(a => a.selected && a.success).length}件追加しました
                    </Text>
                  )}
                  {msg.actions.filter(a => a.selected && a.success === false).length > 0 && (
                    <Text fontSize="xs" color="red.500">
                      {msg.actions.filter(a => a.selected && a.success === false).length}件追加できませんでした
                    </Text>
                  )}
                </VStack>
              )}
              {msg.actions && msg.actionsConfirmed === false && (
                <Text fontSize="xs" color="gray.400" mt={1}>キャンセルしました</Text>
              )}
            </Box>
          </Box>
        </HStack>
      );})}
      {isLoading && (
        <HStack alignSelf="flex-start" maxW="85%" gap={2}>
          <Box
            w="32px"
            h="32px"
            borderRadius="full"
            bg="white"
            overflow="hidden"
            flexShrink={0}
            alignSelf="flex-end"
            mb={1}
            boxShadow="sm"
          >
            <Image
              src="/hisyochan-icon.png"
              alt="秘書ちゃん"
              w="100%"
              h="100%"
              objectFit="cover"
              objectPosition="center top"
            />
          </Box>
          <Box position="relative">
            <Box
              position="absolute"
              bottom="8px"
              left="-6px"
              w="0"
              h="0"
              borderStyle="solid"
              borderWidth="6px 8px 6px 0"
              borderColor="transparent rgba(255,255,255,0.85) transparent transparent"
            />
            <Box
              bg="rgba(255,255,255,0.85)"
              px={3}
              py={2}
              borderRadius="18px"
              borderBottomLeftRadius="4px"
              boxShadow="sm"
            >
              <Text fontSize="sm" color="gray.500">
                <Box as="span" animation="pulse 1.5s infinite">・・・</Box>
              </Text>
            </Box>
          </Box>
        </HStack>
      )}
      <div ref={messagesEndRef} />
    </VStack>
  );

  return (
    <>
      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            handleDeleteConversation(deleteTargetId);
          }
        }}
        title="チャットを削除"
        message="このチャットを削除しますか？削除すると元に戻せません。"
        confirmText="削除する"
        cancelText="キャンセル"
        confirmColorScheme="red"
      />

      {/* 背景オーバーレイ */}
      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          w="100%"
          h="100vh"
          zIndex={998}
          onClick={onClose}
          bg={{ base: "blackAlpha.500", md: "transparent" }}
          pointerEvents={{ base: "auto", md: "none" }}
        />
      )}

      {/* スマホ版: モーダル */}
      <Box
        display={{ base: "flex", md: "none" }}
        position="fixed"
        top="25%"
        left="50%"
        transform={isOpen ? "translate(-50%, 0)" : "translate(-50%, 100vh)"}
        w="90%"
        maxW="400px"
        h="60vh"
        bg="white"
        borderRadius="2xl"
        boxShadow="xl"
        zIndex={999}
        transition="transform 0.3s ease"
        flexDirection="column"
        overflow="hidden"
      >
        {/* ヘッダー */}
        <Box bg="teal.500" px={4} py={3} flexShrink={0}>
          <HStack justify="space-between">
            <HStack gap={3}>
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                bg="white"
                overflow="hidden"
                cursor="pointer"
                onClick={() => {
                  loadConversations();
                  setShowHistoryPicker(!showHistoryPicker);
                }}
                _hover={{ opacity: 0.8 }}
                border={showHistoryPicker ? "2px solid" : "none"}
                borderColor="yellow.300"
              >
                <Image
                  src="/hisyochan-icon.png"
                  alt="秘書ちゃん"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text color="white" fontWeight="bold" fontSize="md">
                  秘書ちゃん
                </Text>
                <Text color="whiteAlpha.800" fontSize="xs">
                  {showHistoryPicker ? "履歴を選んでね" : "タップで履歴"}
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="閉じる"
              variant="ghost"
              color="white"
              size="sm"
              onClick={onClose}
              _hover={{ bg: "whiteAlpha.200" }}
            >
              <FiX size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* メッセージエリア */}
        <Box ref={messagesContainerRef} flex={1} overflowY="auto" p={4} bg="gray.50">
          <MessageList />
        </Box>

        {/* 入力エリア */}
        <Box p={3} bg="white" borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
          <HStack gap={2}>
            <Textarea
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter で送信、Shift/Ctrl/Alt/Cmd+Enter で改行
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              resize="none"
              size="md"
              borderRadius="xl"
              bg="gray.100"
              color="gray.800"
              pl={4}
              _placeholder={{ color: "gray.400" }}
              disabled={isLoading}
            />
            <IconButton
              aria-label="送信"
              colorScheme="teal"
              borderRadius="full"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <FiSend />
            </IconButton>
          </HStack>
        </Box>
      </Box>

      {/* PC版: サイドバー */}
      <Box
        display={{ base: "none", md: "flex" }}
        position="fixed"
        top={0}
        right={0}
        w="30%"
        maxW="400px"
        h="100vh"
        bg="gray.50"
        borderLeft="1px solid"
        borderColor="gray.200"
        zIndex={999}
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s ease"
        flexDirection="column"
      >
        {/* ヘッダー */}
        <Box bg="teal.500" px={4} py={3} flexShrink={0}>
          <HStack justify="space-between">
            <HStack gap={3}>
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                bg="white"
                overflow="hidden"
                cursor="pointer"
                onClick={() => {
                  loadConversations();
                  setShowHistoryPicker(!showHistoryPicker);
                }}
                _hover={{ opacity: 0.8 }}
                border={showHistoryPicker ? "2px solid" : "none"}
                borderColor="yellow.300"
              >
                <Image
                  src="/hisyochan-icon.png"
                  alt="秘書ちゃん"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text color="white" fontWeight="bold" fontSize="md">
                  秘書ちゃん
                </Text>
                <Text color="whiteAlpha.800" fontSize="xs">
                  {showHistoryPicker ? "履歴を選んでね" : "アイコンタップで履歴"}
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="閉じる"
              variant="ghost"
              color="white"
              size="sm"
              onClick={onClose}
              _hover={{ bg: "whiteAlpha.200" }}
            >
              <FiX size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* メッセージエリア */}
        <Box
          ref={messagesContainerRef}
          flex={1}
          overflowY="auto"
          p={4}
          bg="gray.50"
        >
          <MessageList />
        </Box>

        {/* 入力エリア */}
        <Box p={3} bg="white" borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
          <HStack gap={2}>
            <Textarea
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter で送信、Shift/Ctrl/Alt/Cmd+Enter で改行
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              resize="none"
              size="md"
              borderRadius="xl"
              bg="gray.100"
              color="gray.800"
              pl={4}
              _placeholder={{ color: "gray.400" }}
              disabled={isLoading}
            />
            <IconButton
              aria-label="送信"
              colorScheme="teal"
              borderRadius="full"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <FiSend />
            </IconButton>
          </HStack>
        </Box>
      </Box>
    </>
  );
}
