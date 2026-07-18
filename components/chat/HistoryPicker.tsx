"use client";

import { Box, Text, VStack, HStack, Button, Card, IconButton } from "@chakra-ui/react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import type { Conversation } from "@/lib/firebase/firestore-types";

interface HistoryPickerProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelect: (convId: string) => void;
  onNewChat: () => void;
  onRequestDelete: (convId: string) => void;
  onCancel: () => void;
}

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

// 履歴選択の吹き出しコンポーネント
export function HistoryPicker({
  conversations,
  currentConversationId,
  onSelect,
  onNewChat,
  onRequestDelete,
  onCancel,
}: HistoryPickerProps) {
  return (
    <Box alignSelf="flex-start" maxW="95%" w="100%">
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
            onClick={onNewChat}
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
                  bg={currentConversationId === conv.id ? "teal.50" : "gray.50"}
                  _hover={{ bg: "teal.50" }}
                  cursor="pointer"
                  onClick={() => onSelect(conv.id)}
                >
                  <Text fontSize="lg" mr={1}>📌</Text>
                  <VStack align="start" gap={0} flex={1}>
                    <Text
                      fontSize="sm"
                      fontWeight={currentConversationId === conv.id ? "bold" : "normal"}
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
                      onRequestDelete(conv.id);
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
            onClick={onCancel}
          >
            やっぱりこのまま続ける
          </Button>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
