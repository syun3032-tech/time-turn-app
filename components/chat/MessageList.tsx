"use client";

import { Box, Text, VStack, HStack, Image } from "@chakra-ui/react";
import { useEffect, useMemo, useRef } from "react";
import { useTypingAnimation } from "@/lib/hooks/useTypingAnimation";
import { QuickReplyButtons } from "@/components/QuickReplyButtons";
import type { ChatMessage } from "@/lib/chat/types";
import { ActionConfirmCard } from "./ActionConfirmCard";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  avatarSrc?: string;
  onToggleAction: (msgIndex: number, actionIndex: number) => void;
  onConfirmActions: (msgIndex: number, confirm: boolean) => void;
  /** クイックリプライの送信ハンドラ群（未指定なら非表示） */
  onQuickSelect?: (option: string) => void;
  onQuickMultiSubmit?: (options: string[]) => void;
  onQuickRankSubmit?: (options: string[]) => void;
  /** スクロールコンテナ（タイピング中の自動スクロール用） */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

function AssistantIcon({ src }: { src: string }) {
  return (
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
        src={src}
        alt="秘書ちゃん"
        w="100%"
        h="100%"
        objectFit="cover"
        objectPosition="center top"
      />
    </Box>
  );
}

// メッセージ表示コンポーネント（LINE風吹き出し）
export function MessageList({
  messages,
  isLoading,
  avatarSrc = "/hisyochan-icon.png",
  onToggleAction,
  onConfirmActions,
  onQuickSelect,
  onQuickMultiSubmit,
  onQuickRankSubmit,
  containerRef,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 最新のアシスタントメッセージ
  const latestAssistantIndex = useMemo(() => {
    const indices = messages.map((m, i) => (m.role === "assistant" ? i : -1)).filter(i => i >= 0);
    return indices.length > 0 ? indices[indices.length - 1] : -1;
  }, [messages]);

  const latestAssistantMessage = latestAssistantIndex >= 0 ? messages[latestAssistantIndex].content : "";

  // タイピングアニメーション（最新のアシスタントメッセージのみ）
  const { displayedText: typedLatestMessage, isTyping } = useTypingAnimation(latestAssistantMessage, {
    speed: 25,
    enabled: !isLoading,
  });

  // 自動スクロール（メッセージ追加時）
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // タイピング中も自動スクロール
  useEffect(() => {
    if (isTyping && containerRef?.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [typedLatestMessage, isTyping, containerRef]);

  // 最新メッセージのクイックリプライ（タイピング完了後に表示）
  const latestQuickReply =
    latestAssistantIndex === messages.length - 1 && !isTyping && !isLoading
      ? messages[latestAssistantIndex]?.quickReply
      : undefined;

  return (
    <VStack gap={3} align="stretch">
      {messages.map((msg, idx) => {
        const isLatestAssistant = idx === latestAssistantIndex;
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
            {!isUser && <AssistantIcon src={avatarSrc} />}

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
                {msg.actions && msg.actions.length > 0 && (
                  <ActionConfirmCard
                    actions={msg.actions}
                    actionsConfirmed={msg.actionsConfirmed}
                    onToggleAction={(actionIdx) => onToggleAction(idx, actionIdx)}
                    onConfirm={(confirm) => onConfirmActions(idx, confirm)}
                  />
                )}
              </Box>
            </Box>
          </HStack>
        );
      })}

      {/* クイックリプライボタン */}
      {latestQuickReply && onQuickSelect && onQuickMultiSubmit && onQuickRankSubmit && (
        <QuickReplyButtons
          type={latestQuickReply.type}
          options={latestQuickReply.options}
          onSelect={onQuickSelect}
          onMultiSubmit={onQuickMultiSubmit}
          onRankSubmit={onQuickRankSubmit}
        />
      )}

      {isLoading && (
        <HStack alignSelf="flex-start" maxW="85%" gap={2}>
          <AssistantIcon src={avatarSrc} />
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
}
