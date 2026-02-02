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
import { useState, useRef, useEffect } from "react";
import { FiSend, FiX, FiPlus, FiTrash2 } from "react-icons/fi";
import { chatWithAISeamless } from "@/lib/ai-service";
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

// ノードタイプの型定義
type NodeType = "Goal" | "Project" | "Milestone" | "Task";

// 単一アクションの型
interface ActionItem {
  type: "add_goal" | "add_project" | "add_milestone" | "add_task" | "add_memo";
  parentId?: string;
  parentTitle?: string;
  title?: string;
  taskTitle?: string;
  nodeType?: NodeType;
  nodeId?: string;
  memo?: string; // ノード追加時のメモ、またはメモ追加時の内容
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
  onAddNode?: (parentId: string | null, title: string, nodeType: NodeType, memo?: string) => void;
  onUpdateMemo?: (nodeId: string, memo: string) => void;
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

    result += `${indent}- ${node.title}${status}${deadline}${memo}\n`;

    if (node.children && node.children.length > 0 && depth < maxDepth) {
      result += serializeTreeForChat(node.children, depth + 1, maxDepth);
    }
  }

  return result;
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

export function MiniCharacterChat({ isOpen, onClose, taskTree, onAddTask, onAddNode, onUpdateMemo }: MiniCharacterChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // 履歴選択モード（吹き出し内で表示）
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // 選択されたアクションを実行
      const updatedActions = msg.actions.map(action => {
        if (!action.selected) return { ...action, success: undefined };

        const title = action.title || action.taskTitle || "";
        let success = false;

        if (onAddNode) {
          switch (action.type) {
            case "add_goal":
              if (title) {
                onAddNode(null, title, "Goal", action.memo);
                success = true;
              }
              break;
            case "add_project":
              if (action.parentId && title) {
                onAddNode(action.parentId, title, "Project", action.memo);
                success = true;
              }
              break;
            case "add_milestone":
              if (action.parentId && title) {
                onAddNode(action.parentId, title, "Milestone", action.memo);
                success = true;
              }
              break;
            case "add_task":
              if (action.parentId && title) {
                onAddNode(action.parentId, title, "Task", action.memo);
                success = true;
              }
              break;
            case "add_memo":
              if (action.nodeId && action.memo && onUpdateMemo) {
                onUpdateMemo(action.nodeId, action.memo);
                success = true;
              }
              break;
          }
        } else if (onAddTask) {
          // 後方互換性
          if (action.type === "add_task" && title && action.parentId) {
            onAddTask(action.parentId, title);
            success = true;
          } else if (action.type === "add_memo" && action.memo && action.nodeId && onUpdateMemo) {
            onUpdateMemo(action.nodeId, action.memo);
            success = true;
          }
        }

        return { ...action, success };
      });

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

      // 最初のユーザーメッセージならタイトルを自動生成（20文字で切り詰め）
      const userMessagesCount = newMessages.filter(m => m.role === "user").length;
      if (userMessagesCount === 1) {
        const title = input.length > 20 ? input.substring(0, 20) + "..." : input;
        updateConversationTitle(convId, title, false).catch(console.error);
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

例: 「じゃあGoalとして追加しとくね！[ADD_GOAL:TOEIC800点突破|就活で有利になるから]」
例: 「Projectとして追加！[ADD_PROJECT:TOEIC800点突破:リスニング強化]」
例: 「タスクとして追加！[ADD_TASK:Part1-4対策:公式問題集Part1|毎日5問ずつ]」
例: 「メモ残しとくね！[ADD_MEMO:公式問題集Part1:明日までに5問解く]」

※ヒアリングで聞いた「なぜ」は必ずGoalのメモに残す
※ユーザーが明確に同意していない場合は、このフォーマットを使わないでください。
※ Goal に直接 Task は追加しない。必ず階層を守る。`;
      }

      const systemPrompt = `あなたは「秘書ちゃん」。ユーザーの目標達成を支援するAIです。
**タスク管理・目標達成のサポートに特化しています。**

${CONTEXT_PROMPT}${taskInfo}

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
        setMessages([...newMessages, newMsg]);
        // AIの返答をFirestoreに保存
        if (convId) {
          addMessageToConversation(convId, "assistant", cleanContent).catch(console.error);
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

  // メッセージ表示コンポーネント
  const MessageList = () => (
    <VStack gap={3} align="stretch">
      {/* 履歴選択モードの場合、最初に吹き出しを表示 */}
      {showHistoryPicker && <HistoryPickerBubble />}

      {/* 通常のメッセージ */}
      {!showHistoryPicker && messages.map((msg, idx) => (
        <Box
          key={idx}
          alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
          maxW="85%"
        >
          <Card.Root
            bg={msg.role === "user" ? "teal.500" : "white"}
            shadow="sm"
            borderRadius="xl"
          >
            <Card.Body py={2} px={3}>
              <Text
                fontSize="sm"
                color={msg.role === "user" ? "white" : "gray.800"}
              >
                {msg.content}
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
                             action.type === "add_task" ? "Task" : "メモ"}
                            : {action.title || action.memo}
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
            </Card.Body>
          </Card.Root>
        </Box>
      ))}
      {isLoading && (
        <Box alignSelf="flex-start" maxW="85%">
          <Card.Root bg="white" shadow="sm" borderRadius="xl">
            <Card.Body py={2} px={3}>
              <Text fontSize="sm" color="gray.500">...</Text>
            </Card.Body>
          </Card.Root>
        </Box>
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
        <Box flex={1} overflowY="auto" p={4} bg="gray.50">
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
