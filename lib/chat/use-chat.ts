"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chatWithAISeamless } from "@/lib/ai-service";
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
import type { ChecklistItem } from "@/types/task-tree";
import { parseQuickReplies } from "@/lib/parse-quick-replies";
import type { ChatMessage, TaskTreeActions } from "./types";
import { parseActionsFromResponse, findNodeByIdOrTitle } from "./parse-actions";
import {
  buildSecretarySystemPrompt,
  buildTaskInfo,
  buildTimeInfo,
  buildPromiseInfo,
  buildCalendarInfo,
  buildFocusInfo,
  CALENDAR_ERROR_INFO,
} from "./context-builder";

export interface UseChatOptions {
  /** 会話の保存先ソース（'mini' = 旧ウィジェット, 'main' = ホームチャット） */
  source: "mini" | "main";
  /** conversationIdを永続化するlocalStorageキー */
  conversationStorageKey: string;
  /** 履歴一覧に含めるソース（省略時はsourceと同じ。'all'で全て） */
  listSource?: "mini" | "main" | "all";
  /** システムプロンプトの画面コンテキスト説明 */
  contextNote: string;
  taskTree?: any[];
  /** タスクツリー操作の実装（未指定ならタスク系アクションは失敗扱い） */
  actions?: TaskTreeActions;
  /** 新規チャット開始時の挨拶文を生成 */
  makeGreeting: () => string;
  /** 送信履歴の最大件数（省略時は全件送信） */
  maxHistory?: number;
  /** 構造化ナレッジ等の追加コンテキストを返す（システムプロンプトに注入） */
  getKnowledgeContext?: () => string;
  /** 送信前ガード。ブロックする場合はエラーメッセージを返す */
  checkBeforeSend?: () => string | null;
  /** アシスタント返信の成功後に呼ばれる（表情変更・ナレッジ抽出・利用量カウント等） */
  onAssistantReply?: (content: string, allMessages: ChatMessage[]) => void;
}

export function useChat(options: UseChatOptions) {
  const {
    source,
    conversationStorageKey,
    listSource,
    contextNote,
    taskTree,
    actions,
    makeGreeting,
    maxHistory,
    getKnowledgeContext,
    checkBeforeSend,
    onAssistantReply,
  } = options;

  const { user, googleAccessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // 初期値をlocalStorageから読み込む（画面遷移で消えないように）
  const [conversationId, setConversationIdRaw] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(conversationStorageKey);
    }
    return null;
  });
  const initializedRef = useRef(false);

  // conversationIdをlocalStorageにも保存
  const setConversationId = (id: string | null) => {
    setConversationIdRaw(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(conversationStorageKey, id);
      } else {
        localStorage.removeItem(conversationStorageKey);
      }
    }
  };

  // 現在フォーカス中のノード（システムプロンプトに使用）
  const [currentFocusNode, setCurrentFocusNode] = useState<any>(null);

  // 履歴選択モード
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // 最新のアシスタントメッセージ
  const latestAssistantMessage = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === "assistant");
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : "";
  }, [messages]);

  // 会話履歴を読み込む
  const loadConversations = async () => {
    if (!user) return;
    try {
      const convs = await getConversations(user.uid, listSource ?? source);
      setConversations(convs);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  // 初期化時に会話一覧を読み込む + 前回の会話を復元
  useEffect(() => {
    if (!user || initializedRef.current) return;

    const initialize = async () => {
      setIsLoadingHistory(true);
      try {
        await loadConversations();

        const savedConvId = localStorage.getItem(conversationStorageKey);
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
              localStorage.removeItem(conversationStorageKey);
            }
          } catch {
            setConversationIdRaw(null);
            localStorage.removeItem(conversationStorageKey);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 初回に挨拶（履歴がない場合のみ）
  useEffect(() => {
    if (isLoadingHistory || !initializedRef.current || messages.length > 0 || conversationId) return;
    setMessages([{ role: "assistant", content: makeGreeting() }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingHistory, taskTree, conversationId, messages.length]);

  // フォーカスノードについての新しい会話を開始
  const startFocusConversation = (node: any, greeting: string) => {
    setCurrentFocusNode(node);
    setConversationId(null);
    setMessages([{ role: "assistant", content: greeting }]);
    setShowHistoryPicker(false);
  };

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
      const newConvId = await createConversation(user.uid, '新しいチャット', source);
      setConversationId(newConvId);
      setCurrentFocusNode(null);

      const greeting = makeGreeting();
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

      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
      }

      await loadConversations();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // AI要約でタイトル生成（2往復分を要約）
  const generateSummaryTitle = async (msgs: ChatMessage[], convId: string) => {
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

        if (actions) {
          switch (action.type) {
            case "add_goal":
              if (title) {
                const newId = actions.addNode(null, title, "Goal", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            case "add_project": {
              // parentIdが無ければ、同バッチで作ったノードからparentTitleで探す
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = actions.addNode(pid, title, "Project", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            }
            case "add_milestone": {
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = actions.addNode(pid, title, "Milestone", action.memo);
                success = true;
                if (newId) createdNodes.set(title, newId);
              }
              break;
            }
            case "add_task": {
              const pid = action.parentId || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined);
              if (pid && title) {
                const newId = actions.addNode(pid, title, "Task", action.memo);
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
              if (memoNodeId && action.memo) {
                actions.updateMemo(memoNodeId, action.memo);
                success = true;
              }
              break;
            }
            case "add_checklist": {
              const clNodeId = action.nodeId
                || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined)
                || findNodeByIdOrTitle(taskTree || [], action.parentTitle || "")?.id;
              if (clNodeId && action.checklistItems) {
                // 新規アイテムのみを渡す（既存チェックリストとのマージは実装側で行う）
                const newItems: ChecklistItem[] = action.checklistItems.map(text => ({
                  id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  text,
                  done: false,
                }));
                actions.updateChecklist(clNodeId, newItems);
                success = true;
              }
              break;
            }
            case "set_completion": {
              const compNodeId = action.nodeId
                || (action.parentTitle ? createdNodes.get(action.parentTitle) : undefined)
                || findNodeByIdOrTitle(taskTree || [], action.parentTitle || "")?.id;
              if (compNodeId && action.memo) {
                actions.setCompletion(compNodeId, action.memo);
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

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || !user) return;

    // 履歴選択モードを閉じる
    setShowHistoryPicker(false);

    // 送信前ガード（利用制限など）
    if (checkBeforeSend) {
      const blockMessage = checkBeforeSend();
      if (blockMessage) {
        setMessages(prev => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: blockMessage },
        ]);
        return;
      }
    }

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // 会話IDがなければ新規作成
    let convId = conversationId;
    if (!convId) {
      try {
        convId = await createConversation(user.uid, '新しいチャット', source);
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
      addMessageToConversation(convId, "user", text).catch(console.error);

      // 最初のユーザーメッセージなら仮タイトルを設定
      const userMessagesCount = newMessages.filter(m => m.role === "user").length;
      if (userMessagesCount === 1) {
        const tempTitle = text.length > 15 ? text.substring(0, 15) + "..." : text;
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
      try {
        const activePromises = await getActivePromises(user.uid);
        promiseInfo = buildPromiseInfo(activePromises);
      } catch (e) {
        console.error("Promise fetch error:", e);
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
        contextNote,
        timeInfo,
        taskInfo,
        focusInfo,
        calendarInfo,
        promiseInfo,
        knowledgeContext: getKnowledgeContext?.() ?? "",
      });

      // 履歴を制限（トークン節約）
      const historyToSend = maxHistory ? newMessages.slice(-maxHistory) : newMessages;

      const response = await chatWithAISeamless([
        { role: "user", content: systemPrompt },
        ...historyToSend.map(m => ({ role: m.role, content: m.content })),
      ]);

      if (response.success && response.content) {
        // アクション提案を解析（複数対応）
        const { cleanContent, actions: parsedActions } = parseActionsFromResponse(response.content, taskTree || []);
        // クイックリプライタグを解析
        const quickParsed = parseQuickReplies(cleanContent);
        const newMsg: ChatMessage = {
          role: "assistant",
          content: quickParsed.content,
          actions: parsedActions.length > 0 ? parsedActions : undefined,
          quickReply: quickParsed.quickReply ?? undefined,
        };
        const allMessages = [...newMessages, newMsg];
        setMessages(allMessages);
        // AIの返答をFirestoreに保存
        if (convId) {
          addMessageToConversation(convId, "assistant", quickParsed.content).catch(console.error);

          // 2往復目（4メッセージ）が揃ったらAI要約でタイトル生成
          if (allMessages.length === 4) {
            generateSummaryTitle(allMessages, convId);
          }
        }
        onAssistantReply?.(quickParsed.content, allMessages);
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

  return {
    messages,
    setMessages,
    isLoading,
    isLoadingHistory,
    conversationId,
    conversations,
    latestAssistantMessage,
    currentFocusNode,
    showHistoryPicker,
    setShowHistoryPicker,
    loadConversations,
    startFocusConversation,
    handleSelectConversation,
    handleNewChat,
    handleDeleteConversation,
    handleToggleAction,
    handleConfirmActions,
    handleSend,
  };
}
