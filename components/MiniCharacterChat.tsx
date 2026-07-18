"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  IconButton,
  Image,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useRef } from "react";
import { FiX } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmModal } from "./ConfirmModal";
import { ChecklistItem } from "@/types/task-tree";
import type { NodeType, TaskTreeActions } from "@/lib/chat/types";
import { getIncompleteTasks } from "@/lib/chat/parse-actions";
import { useChat } from "@/lib/chat/use-chat";
import { MessageList } from "./chat/MessageList";
import { HistoryPicker } from "./chat/HistoryPicker";
import { ChatInput } from "./chat/ChatInput";
import { CalendarConnectBanner } from "./chat/CalendarConnectBanner";

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

// タスクツリーから挨拶文を生成
function makeTreeGreeting(taskTree?: any[]): string {
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
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    return "タスク全部完了してますね。…やりますね。次の目標はありますか？";
  }
  return "目標やタスクについて話しましょう。何か達成したいことはありますか？";
}

export function MiniCharacterChat({ isOpen, onClose, taskTree, onAddNode, onUpdateMemo, onUpdateChecklist, onSetCompletion, focusNode, onFocusNodeHandled }: MiniCharacterChatProps) {
  const { user } = useAuth();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // タスクページのハンドラをTaskTreeActionsに束ねる
  const treeActions = useMemo<TaskTreeActions | undefined>(() => {
    if (!onAddNode || !onUpdateMemo || !onUpdateChecklist || !onSetCompletion) return undefined;
    return {
      addNode: onAddNode,
      updateMemo: onUpdateMemo,
      updateChecklist: onUpdateChecklist,
      setCompletion: onSetCompletion,
    };
  }, [onAddNode, onUpdateMemo, onUpdateChecklist, onSetCompletion]);

  const chat = useChat({
    source: "mini",
    conversationStorageKey: "mini-chat-conversation-id",
    contextNote: CONTEXT_PROMPT,
    taskTree,
    actions: treeActions,
    makeGreeting: () => makeTreeGreeting(taskTree),
  });

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

    chat.startFocusConversation(focusNode, greeting);
    onFocusNodeHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNode, isOpen]);

  if (!user) return null;

  // ヘッダー（アイコン + タイトル + 閉じるボタン）
  const header = (
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
              chat.loadConversations();
              chat.setShowHistoryPicker(!chat.showHistoryPicker);
            }}
            _hover={{ opacity: 0.8 }}
            border={chat.showHistoryPicker ? "2px solid" : "none"}
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
              {chat.showHistoryPicker ? "履歴を選んでね" : "タップで履歴"}
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
  );

  // メッセージエリアの中身
  const body = (
    <>
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
            onQuickMultiSubmit={(options) => chat.handleSend(options.join('、'))}
            onQuickRankSubmit={(options) => chat.handleSend(options.map((opt, i) => `${i + 1}. ${opt}`).join(' → '))}
            containerRef={messagesContainerRef}
          />
        </>
      )}
    </>
  );

  return (
    <>
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
        {header}
        <Box ref={messagesContainerRef} flex={1} overflowY="auto" p={4} bg="gray.50">
          {body}
        </Box>
        <ChatInput onSend={chat.handleSend} disabled={chat.isLoading} />
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
        {header}
        <Box flex={1} overflowY="auto" p={4} bg="gray.50">
          {body}
        </Box>
        <ChatInput onSend={chat.handleSend} disabled={chat.isLoading} />
      </Box>
    </>
  );
}
