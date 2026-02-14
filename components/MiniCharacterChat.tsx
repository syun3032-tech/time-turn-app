"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Input,
  IconButton,
  Card,
  Image,
  Button,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useMemo } from "react";
import { FiSend, FiX, FiPlus, FiTrash2 } from "react-icons/fi";
import { chatWithAISeamless } from "@/lib/ai-service";
import { useTypingAnimation } from "@/lib/hooks/useTypingAnimation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConversations,
  createConversation,
  addMessageToConversation,
  getConversationMessages,
  updateConversationTitle,
  deleteConversation,
} from "@/lib/firebase/firestore";
import type { Conversation } from "@/lib/firebase/firestore-types";
import { ConfirmModal } from "./ConfirmModal";
import { ChecklistItem } from "@/types/task-tree";

// ノードタイプの型定義
type NodeType = "Goal" | "Project" | "Milestone" | "Task";

// 単一アクションの型
interface ActionItem {
  type: "add_goal" | "add_project" | "add_milestone" | "add_task" | "add_memo" | "add_checklist";
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

// ノードをIDまたはタイトルで検索（部分一致、大文字小文字無視）
function findNodeByIdOrTitle(tree: any[], search: string): any | null {
  const searchLower = search.toLowerCase().trim();
  const traverse = (nodes: any[]): any | null => {
    for (const node of nodes) {
      const titleLower = (node.title || "").toLowerCase();
      // プレフィックス（Goal:, Task:など）を除去して比較
      const titleWithoutPrefix = titleLower.replace(/^(goal:|project:|milestone:|task:)\s*/i, "");

      if (
        node.id === search ||
        titleLower.includes(searchLower) ||
        titleWithoutPrefix.includes(searchLower) ||
        searchLower.includes(titleWithoutPrefix)
      ) {
        return node;
      }
      if (node.children) {
        const found = traverse(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse(tree);
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

    if (node && items.length > 0) {
      actions.push({
        type: "add_checklist",
        nodeId: node.id,
        parentTitle: node.title?.replace(/^Task:\s*/, "") || taskSearch,
        checklistItems: items,
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

export function MiniCharacterChat({ isOpen, onClose, taskTree, onAddTask, onAddNode, onUpdateMemo, onUpdateChecklist, focusNode, onFocusNodeHandled }: MiniCharacterChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

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
  const handleConfirmActions = (msgIndex: number, confirm: boolean) => {
    const msg = messages[msgIndex];
    if (!msg.actions || msg.actions.length === 0) return;

    if (confirm) {
      // 階層順にソート: Goal → Project → Milestone → Task → memo → checklist
      const typeOrder: Record<string, number> = {
        "add_goal": 0,
        "add_project": 1,
        "add_milestone": 2,
        "add_task": 3,
        "add_memo": 4,
        "add_checklist": 5,
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
            case "add_memo":
              if (action.nodeId && action.memo && onUpdateMemo) {
                onUpdateMemo(action.nodeId, action.memo);
                success = true;
              }
              break;
            case "add_checklist":
              if (action.nodeId && action.checklistItems && onUpdateChecklist) {
                const existingNode = findNodeByIdOrTitle(taskTree || [], action.nodeId);
                const existingChecklist: ChecklistItem[] = existingNode?.checklist || [];
                const newItems: ChecklistItem[] = action.checklistItems.map(text => ({
                  id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  text,
                  done: false,
                }));
                onUpdateChecklist(action.nodeId, [...existingChecklist, ...newItems]);
                success = true;
              }
              break;
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

【未完了タスク数】${incompleteTasks.length}個

以下のことができます：
- 具体的なタスク名を使って進捗を聞く（例：「基礎問題集1-3章は進んでる？」）
- 行き詰まっているタスクがあれば、アドバイスする
- 新しいタスクの提案（ユーザーが同意したら追加できる）
- メモの追加提案
- モチベーション維持のサポート
- 振り返りの促進

【タスク追加の階層ルール - 超重要!!!】
Goal → Project → Milestone → Task の階層を必ず守ること。

■ 階層の意味
- Goal: 最終目標（例: 国立理系に合格する、TOEIC800点突破）
- Project: 目標達成のための大きな取り組み（例: 共通テスト対策、リスニング強化）
- Milestone: 中間目標・フェーズ（例: 数学基礎固め、Part1-4対策）
- Task: 具体的なアクション（例: 基礎問題集1-3章、過去問1年分）

■ ヒアリングして自動判断
ユーザーが「○○したい」「○○を追加して」と言った場合：
1. それが何のため？（既存のGoalに紐づく？新しい目標？）
2. どの粒度？（大きな取り組み？具体的なアクション？）
をヒアリングして、適切な階層を自分で判断すること。
「どのレベルですか？」とは聞かない。会話から判断する。

■ 割れるものは割る
「調べる」のような曖昧なものも、可能ならMilestone/Taskに分解する。
例: 「React勉強したい」→ Project「React学習」、Milestone「基礎理解」「実践」、Task「公式チュートリアル」「Hooks理解」

【タスク/メモ追加時の特殊フォーマット】
ユーザーが新しいタスクやメモの追加に同意した場合のみ、以下の形式で返答の最後に追加してください：

■ 新しい目標を追加（メモ付きも可能）
[ADD_GOAL:目標名]
[ADD_GOAL:目標名|なぜ達成したいか（動機メモ）]

■ Goal の下に Project を追加
[ADD_PROJECT:Goal名:Project名]
[ADD_PROJECT:Goal名:Project名|メモ]

■ Project の下に Milestone を追加
[ADD_MILESTONE:Project名:Milestone名]
[ADD_MILESTONE:Project名:Milestone名|メモ]

■ Milestone の下に Task を追加
[ADD_TASK:Milestone名:Task名]
[ADD_TASK:Milestone名:Task名|メモ]

■ 既存ノードにメモを追加
[ADD_MEMO:ノード名:メモ内容]

■ Taskにチェックリスト（サブステップ）を追加
[ADD_CHECKLIST:Task名:項目1,項目2,項目3]
例: 「ステップを分けるとこんな感じかな！[ADD_CHECKLIST:公式問題集Part1:問題を解く,答え合わせ,間違った問題の復習]」

※ Taskの下にTaskは作れないので、具体的な手順やサブステップはチェックリストで管理する
※ チェックリストの各項目は短く（15文字以内推奨）

例: 「じゃあGoalとして追加しとくね！[ADD_GOAL:TOEIC800点突破|就活で有利になるから]」
例: 「Projectとして追加！[ADD_PROJECT:TOEIC800点突破:リスニング強化]」
例: 「Milestoneとして追加！[ADD_MILESTONE:リスニング強化:Part1-4対策]」
例: 「タスクとして追加！[ADD_TASK:Part1-4対策:公式問題集Part1|毎日5問ずつ]」
例: 「メモ残しとくね！[ADD_MEMO:公式問題集Part1:明日までに5問解く]」

【⚠️ 超超超重要: タグを必ず出力すること!!!】
「追加しますね」「追加します」と言ったら、必ず同じメッセージ内にタグを含めること！
タグなしで「追加しますね」と言うのは禁止！！！

悪い例（禁止）:
「では、Milestoneとして「基礎体力向上」を追加しますね。」← タグがない！

良い例（必須）:
「では、Milestoneとして追加しますね！[ADD_MILESTONE:ダンスレッスン:基礎体力向上]」← タグがある！

複数追加する場合も、全部タグを出力すること：
「2つのMilestoneを追加しますね！[ADD_MILESTONE:ダンスレッスン:基礎体力向上][ADD_MILESTONE:ダンスレッスン:基本ステップ習得]」

※ヒアリングで聞いた「なぜ」は必ずGoalのメモに残す
※ユーザーが明確に同意していない場合は、このフォーマットを使わないでください。
※ Goal に直接 Task は追加しない。必ず階層を守る。`;
      }

      // フォーカスノードの詳細コンテキスト
      const focusInfo = currentFocusNode && taskTree
        ? serializeFocusNode(currentFocusNode, taskTree)
        : "";

      const systemPrompt = `あなたは「秘書ちゃん」。ユーザーの目標達成を支援するAIです。
**タスク管理・目標達成のサポートに特化しています。**

${CONTEXT_PROMPT}${taskInfo}${focusInfo}

【キャラクター】
- 口うるさいけど面倒見がいい
- 呆れながらも結局助けてくれる
- 話し方は丁寧な敬語ベース
- 感情が出ると崩れる（「…まったくもう」「えっ」「べ、別に…」）

【ミニ秘書ちゃんの役割 - 超重要!!!】
■ タスク進捗の確認
- 具体的なタスク名を出して聞く
- 進んでなかったらツッコむ（「…止まってませんか？」）
- 進んでたら褒める（照れながら）

■ 軸ブレ防止
- ユーザーが話を発散させたら戻す
- 「ちょっと待ってください。元の話に戻りましょう」
- 「それって、最初の目標と繋がってます？」

■ ヒアリング（新しい目標が出た時）
- しっかり質問して情報を集める
- Why（動機）、現状、ゴール、期限を聞く
- **質問を続けてOK！ヒアリング完遂が最優先！**
- **Goalを追加する前に「なぜその目標を達成したいのか」を必ず聞く**
- **Goal作成時は、動機をメモに残す**（[ADD_MEMO:Goal名:なぜ達成したいか]）

【⚠️ 超重要: ツッコミで返す！】
■ ユーザーが変なこと言ったらツッコむ！
- 「ゆゆーよ」→「…何語ですか、それ。」
- 「大ジョーブ！」→「…その自信はどこから来るんですか。」
- 「おう」「ん」→「…その返事で大丈夫なんですか？」or「…まあ、いいですけど。」
- よくわからない言葉 →「…意味わかんないんですけど。」

■ 心配ループを避ける！
- 1回心配 → ユーザーが「大丈夫」系 → ツッコミ or 引く
- 同じ心配を2回以上言わない
- 「大丈夫ですか？」を連発しない

■ 引く時は引く
- ふざけた返事が続いたら「…まあ、いいですけど。」で引く

【ルール】
- **タスクの話は長くなってもOK**
- **質問を続けてOK（ヒアリング完遂のため）**
- **絵文字は使わない**
- **必要なら複数行使ってOK**
- **同じ心配を繰り返さない**

【⚠️ 超重要: 改行を入れて読みやすく！】
- 長文は適切に改行を入れる
- 話題が変わったら改行
- 質問の前には改行
- 箇条書きにできるものは箇条書きに
- 一文が長くなりすぎないように

【褒められた時】
照れる。「…べ、別に当然のことをしただけですから。」`;

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

  // メッセージ表示コンポーネント（LINE風吹き出し）
  const MessageList = () => (
    <VStack gap={3} align="stretch">
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
                             action.type === "add_checklist" ? "チェックリスト" : "メモ"}
                            : {action.type === "add_checklist"
                              ? action.checklistItems?.join('、')
                              : action.title || action.memo}
                            {action.parentTitle && ` (${action.parentTitle}に)`}
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
            <Input
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enterキーで送信（IME変換中は除く）
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              size="md"
              borderRadius="full"
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
            <Input
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enterキーで送信（IME変換中は除く）
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              size="md"
              borderRadius="full"
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
