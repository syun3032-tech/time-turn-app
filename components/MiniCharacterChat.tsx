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
import type { NodeType, ChatMessage as Message } from "@/lib/chat/types";
import { parseActionsFromResponse, findNodeByIdOrTitle, getIncompleteTasks } from "@/lib/chat/parse-actions";
import {
  buildSecretarySystemPrompt,
  buildTaskInfo,
  buildTimeInfo,
  buildPromiseInfo,
  buildCalendarInfo,
  buildFocusInfo,
  CALENDAR_ERROR_INFO,
} from "@/lib/chat/context-builder";

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
      const taskInfo = buildTaskInfo(taskTree);

      // フォーカスノードの詳細コンテキスト
      const focusInfo = buildFocusInfo(currentFocusNode, taskTree);

      // 現在の時刻・曜日情報
      const timeInfo = buildTimeInfo();

      // 未達成の約束を取得
      let promiseInfo = "";
      if (user) {
        try {
          const activePromises = await getActivePromises(user.uid);
          promiseInfo = buildPromiseInfo(activePromises);
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
          calendarInfo = buildCalendarInfo(formatEventsForAI(todayEvents), formatEventsForAI(tomorrowEvents));
        } catch (e: any) {
          console.error("Calendar fetch error:", e);
          calendarInfo = CALENDAR_ERROR_INFO;
        }
      }

      const systemPrompt = buildSecretarySystemPrompt({
        contextNote: CONTEXT_PROMPT,
        timeInfo,
        taskInfo,
        focusInfo,
        calendarInfo,
        promiseInfo,
      });

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
