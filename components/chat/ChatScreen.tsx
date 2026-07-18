"use client";

import { Box, Flex, Text, HStack, IconButton, Image } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSettings, FiClock } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { CharacterAvatar, getExpressionForMessage, type Expression } from "@/components/CharacterAvatar";
import { SettingsModal } from "@/components/SettingsModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { chatWithAISeamless } from "@/lib/ai-service";
import { getTaskTreeAsync, saveTaskTreeAsync } from "@/lib/task-tree-storage";
import type { TaskNode } from "@/types/task-tree";
import { getGreetingPrompt, getStructuredProfileContext, type StructuredUserKnowledgeForPrompt } from "@/lib/prompts";
import {
  updateUserProfile,
  checkUsageLimit,
  incrementUsage,
  updateLoginStreak,
  getStructuredKnowledge,
  updateStructuredKnowledge,
  migrateToStructuredKnowledge,
} from "@/lib/firebase/firestore";
import { extractStructuredKnowledge, shouldExtractStructuredKnowledge } from "@/lib/knowledge-extractor";
import type { UserProfile, StructuredUserKnowledge } from "@/lib/firebase/firestore-types";
import { USAGE_LIMITS, getLimitReachedMessage } from "@/lib/usage-config";
import { signOut as firebaseSignOut } from "@/lib/firebase/auth";
import { useChat } from "@/lib/chat/use-chat";
import { createTaskTreeActions } from "@/lib/chat/task-actions";
import { findNodeByIdOrTitle } from "@/lib/chat/parse-actions";
import { MessageList } from "./MessageList";
import { HistoryPicker } from "./HistoryPicker";
import { ChatInput } from "./ChatInput";
import { CalendarConnectBanner } from "./CalendarConnectBanner";

const CONTEXT_NOTE = "ユーザーはホーム画面であなたと話しています。日常会話・スケジュール・目標、なんでも相手をしてください。";

// タスクページから「ゆりに相談」で渡されるノードID
export const FOCUS_NODE_STORAGE_KEY = "yuri-focus-node-id";

interface ChatScreenProps {
  profile: UserProfile | null;
}

export function ChatScreen({ profile }: ChatScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // === タスクツリー ===
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const hasLoadedTree = useRef(false);
  const saveTreeRef = useRef<TaskNode[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsTreeLoading(true);
      const tree = await getTaskTreeAsync(user.uid);
      setTaskTree(tree);
      // ロード直後の保存effect発火を抑止（読み込んだだけのツリーを書き戻さない）
      saveTreeRef.current = tree;
      setIsTreeLoading(false);
      hasLoadedTree.current = true;
    };
    load();
  }, [user]);

  // ツリー変更時に保存（初回ロードはスキップ）
  useEffect(() => {
    if (taskTree === saveTreeRef.current) return;
    if (!user || isTreeLoading || !hasLoadedTree.current) return;
    saveTreeRef.current = taskTree;
    saveTaskTreeAsync(taskTree, user.uid);
  }, [taskTree, user, isTreeLoading]);

  const treeActions = useMemo(() => createTaskTreeActions(setTaskTree), []);

  // === 構造化ナレッジ ===
  const [structuredKnowledge, setStructuredKnowledge] = useState<StructuredUserKnowledge | null>(null);
  const [lastExtractionCount, setLastExtractionCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("lastStructuredExtractionCount");
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem("lastStructuredExtractionCount", String(lastExtractionCount));
  }, [lastExtractionCount]);

  useEffect(() => {
    if (!user) return;
    const loadKnowledge = async () => {
      try {
        let structured = await getStructuredKnowledge(user.uid);
        if (!structured) {
          await migrateToStructuredKnowledge(user.uid);
          structured = await getStructuredKnowledge(user.uid);
        }
        setStructuredKnowledge(structured);
      } catch (error) {
        console.error("Failed to load knowledge:", error);
      }
    };
    loadKnowledge();
  }, [user]);

  const knowledgeForPrompt: StructuredUserKnowledgeForPrompt | null = useMemo(() => {
    if (!structuredKnowledge) return null;
    return {
      basicInfo: structuredKnowledge.basicInfo,
      interests: structuredKnowledge.interests.map(i => ({
        topic: i.topic, motivation: i.motivation, depth: i.depth,
      })),
      deepMotivations: structuredKnowledge.deepMotivations.map(m => ({
        desire: m.desire, confidence: m.confidence,
      })),
      lifestyle: structuredKnowledge.lifestyle,
      emotionalPatterns: structuredKnowledge.emotionalPatterns,
      recentContext: structuredKnowledge.recentContext.map(c => ({
        summary: c.summary, mood: c.mood,
      })),
      skills: structuredKnowledge.skills,
      personalityTraits: structuredKnowledge.personalityTraits?.map(p => ({ trait: p.trait })),
      struggles: structuredKnowledge.struggles?.map(s => ({ area: s.area })),
      concreteGoals: structuredKnowledge.concreteGoals,
      preferences: structuredKnowledge.preferences,
    };
  }, [structuredKnowledge]);

  // === 利用制限 + ログイン連続日数 ===
  const [isLimitReached, setIsLimitReached] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadUsage = async () => {
      try {
        const { isLimitReached: limitReached } = await checkUsageLimit(user.uid);
        setIsLimitReached(limitReached);
        await updateLoginStreak(user.uid);
      } catch (error) {
        console.error("Failed to load usage:", error);
      }
    };
    loadUsage();
  }, [user]);

  // === 表情 ===
  const [expression, setExpression] = useState<Expression>("normal");
  const expressionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setExpressionWithAutoReset = (next: Expression) => {
    if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    setExpression(next);
    if (next !== "normal") {
      expressionTimerRef.current = setTimeout(() => setExpression("normal"), 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    };
  }, []);

  // === チャット本体 ===
  const nickname = profile?.nickname;

  const makeGreeting = () => {
    const hour = new Date().getHours();
    const name = nickname ? `${nickname}さん、` : "";
    if (hour >= 5 && hour < 12) return `${name}おはようございます！今日はどうします？`;
    if (hour >= 12 && hour < 18) return `${name}お疲れ様です！最近どうですか？`;
    return `${name}こんばんは！今日はどんな1日でした？`;
  };

  const chat = useChat({
    source: "main",
    conversationStorageKey: user ? `lastConversationId_${user.uid}` : "lastConversationId",
    listSource: "all",
    contextNote: CONTEXT_NOTE,
    taskTree,
    actions: treeActions,
    makeGreeting,
    maxHistory: 10,
    getKnowledgeContext: () => getStructuredProfileContext(profile, knowledgeForPrompt),
    checkBeforeSend: () => (isLimitReached ? getLimitReachedMessage() : null),
    onAssistantReply: (content, allMessages) => {
      // 表情を変更（5秒後にnormalへ）
      setExpressionWithAutoReset(getExpressionForMessage(content));

      // 利用回数をインクリメント
      if (user) {
        incrementUsage(user.uid).then(newUsage => {
          if (newUsage.count >= USAGE_LIMITS.DAILY_MESSAGE_LIMIT) {
            setIsLimitReached(true);
          }
        }).catch(err => console.error("Failed to increment usage:", err));
      }

      // ナレッジ抽出（バックグラウンド処理）
      if (user && shouldExtractStructuredKnowledge(allMessages.length, lastExtractionCount)) {
        extractStructuredKnowledge(allMessages, structuredKnowledge).then(async (extracted) => {
          if (extracted) {
            try {
              await updateStructuredKnowledge(user.uid, extracted);
              const updated = await getStructuredKnowledge(user.uid);
              setStructuredKnowledge(updated);
              setLastExtractionCount(allMessages.length);
            } catch (err) {
              console.error("Failed to save structured knowledge:", err);
            }
          }
        }).catch(err => console.error("Knowledge extraction failed:", err));
      }
    },
  });

  // === AI挨拶（初回のみ、フォールバック挨拶を差し替え） ===
  const aiGreetingRequested = useRef(false);
  useEffect(() => {
    if (aiGreetingRequested.current) return;
    if (chat.isLoadingHistory || chat.conversationId) return;
    if (chat.messages.length !== 1 || chat.messages[0].role !== "assistant") return;
    // 「ゆりに相談」のフォーカス会話中は挨拶を差し替えない
    if (chat.currentFocusNode) {
      aiGreetingRequested.current = true;
      return;
    }

    aiGreetingRequested.current = true;
    // 差し替え対象の挨拶文を記録（他のフローが会話を切り替えていたら差し替えない）
    const originalGreeting = chat.messages[0].content;
    const generate = async () => {
      try {
        const greetingPrompt = getGreetingPrompt(profile, knowledgeForPrompt);
        const response = await chatWithAISeamless([{ role: "user", content: greetingPrompt }]);
        if (response.success && response.content) {
          const greeting = response.content.replace(/[「」『』"""]/g, "").trim();
          chat.setMessages(prev =>
            prev.length === 1 && prev[0].role === "assistant" && prev[0].content === originalGreeting
              ? [{ role: "assistant", content: greeting }]
              : prev
          );
        }
      } catch (error) {
        console.error("Failed to generate AI greeting:", error);
      }
    };
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isLoadingHistory, chat.conversationId, chat.messages]);

  // === タスクページからの「ゆりに相談」フォーカス ===
  useEffect(() => {
    // ツリーと会話履歴の両方のロード完了を待つ（履歴復元との競合防止）
    if (isTreeLoading || chat.isLoadingHistory || typeof window === "undefined") return;
    const focusNodeId = sessionStorage.getItem(FOCUS_NODE_STORAGE_KEY);
    if (!focusNodeId) return;
    sessionStorage.removeItem(FOCUS_NODE_STORAGE_KEY);

    const node = findNodeByIdOrTitle(taskTree, focusNodeId);
    if (!node) return;
    const nodeName = node.title?.replace(/^(Task:|Milestone:|Project:|Goal:)\s*/, "") || "";
    chat.startFocusConversation(
      node,
      `「${nodeName}」について相談ですね。今どんな状況ですか？困ってることがあれば教えてください。`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTreeLoading, chat.isLoadingHistory]);

  // === 設定モーダル・削除確認 ===
  const [showSettings, setShowSettings] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleSaveProfile = async (data: { nickname: string; occupation: string; hobbies: string }) => {
    if (!user) return;
    await updateUserProfile(user.uid, data);
  };

  const handleLogout = async () => {
    await firebaseSignOut();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <Flex direction="column" h="100dvh" bg="gray.50" pb="64px">
      {/* ヘッダー */}
      <Box bg="teal.500" px={4} py={2} flexShrink={0}>
        <HStack justify="space-between">
          <HStack gap={2}>
            <Box w="34px" h="34px" borderRadius="full" bg="white" overflow="hidden">
              <Image
                src="/hisyochan-icon.png"
                alt="秘書ゆり"
                w="100%"
                h="100%"
                objectFit="cover"
                objectPosition="center top"
              />
            </Box>
            <Text color="white" fontWeight="bold" fontSize="md">秘書ゆり</Text>
          </HStack>
          <HStack gap={1}>
            <IconButton
              aria-label="会話履歴"
              variant="ghost"
              color="white"
              size="sm"
              _hover={{ bg: "whiteAlpha.200" }}
              border={chat.showHistoryPicker ? "1px solid" : "none"}
              borderColor="yellow.300"
              onClick={() => {
                chat.loadConversations();
                chat.setShowHistoryPicker(!chat.showHistoryPicker);
              }}
            >
              <FiClock size={18} />
            </IconButton>
            <IconButton
              aria-label="設定"
              variant="ghost"
              color="white"
              size="sm"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => setShowSettings(true)}
            >
              <FiSettings size={18} />
            </IconButton>
          </HStack>
        </HStack>
      </Box>

      {/* キャラクターエリア */}
      <Flex justify="center" align="flex-end" pt={2} flexShrink={0} bg="gray.50">
        <CharacterAvatar
          expression={expression}
          variant="bare"
          width="120px"
          height="150px"
        />
      </Flex>

      {/* メッセージエリア */}
      <Box ref={messagesContainerRef} flex={1} overflowY="auto" p={4}>
        {chat.showHistoryPicker ? (
          <HistoryPicker
            conversations={chat.conversations}
            currentConversationId={chat.conversationId}
            onSelect={chat.handleSelectConversation}
            onNewChat={chat.handleNewChat}
            onRequestDelete={setDeleteTargetId}
            onCancel={() => chat.setShowHistoryPicker(false)}
          />
        ) : (
          <>
            <CalendarConnectBanner />
            <MessageList
              messages={chat.messages}
              isLoading={chat.isLoading}
              onToggleAction={chat.handleToggleAction}
              onConfirmActions={chat.handleConfirmActions}
              onQuickSelect={(option) => chat.handleSend(option)}
              onQuickMultiSubmit={(options) => chat.handleSend(options.join("、"))}
              onQuickRankSubmit={(options) => chat.handleSend(options.map((opt, i) => `${i + 1}. ${opt}`).join(" → "))}
              containerRef={messagesContainerRef}
            />
          </>
        )}
      </Box>

      {/* 入力エリア */}
      <ChatInput onSend={chat.handleSend} disabled={chat.isLoading} />

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        profile={profile}
        onSave={handleSaveProfile}
        onLogout={handleLogout}
      />

      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            chat.handleDeleteConversation(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        title="チャットを削除"
        message="このチャットを削除しますか？削除すると元に戻せません。"
        confirmText="削除する"
        cancelText="キャンセル"
        confirmColorScheme="red"
      />
    </Flex>
  );
}
