"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Button,
  Input,
  IconButton,
} from "@chakra-ui/react";
import { FiPlus, FiEdit2, FiCheck, FiX, FiTrash2 } from "react-icons/fi";
import { useState } from "react";
import type { Conversation } from "@/lib/firebase/firestore-types";

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationSidebar({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onUpdateTitle,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onUpdateTitle(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.500"
          zIndex={998}
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <Box
        position="fixed"
        top={0}
        left={0}
        h="100vh"
        w="280px"
        bg="white"
        boxShadow="lg"
        zIndex={999}
        transform={isOpen ? "translateX(0)" : "translateX(-100%)"}
        transition="transform 0.3s ease"
        display="flex"
        flexDirection="column"
      >
        {/* ヘッダー */}
        <Box p={4} borderBottom="1px solid" borderColor="gray.200">
          <HStack justify="space-between" mb={3}>
            <Text fontWeight="bold" fontSize="lg" color="gray.800">会話履歴</Text>
            <IconButton
              aria-label="閉じる"
              size="sm"
              variant="ghost"
              color="gray.700"
              onClick={onClose}
            >
              <FiX />
            </IconButton>
          </HStack>
          <Button
            w="100%"
            colorScheme="teal"
            size="sm"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
          >
            <FiPlus />
            <Text ml={2}>新しい会話</Text>
          </Button>
        </Box>

        {/* 会話一覧 */}
        <Box flex={1} overflowY="auto" p={2}>
          <VStack gap={1} align="stretch">
            {conversations.length === 0 ? (
              <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                会話履歴がありません
              </Text>
            ) : (
              conversations.map((conv) => (
                <Box
                  key={conv.id}
                  p={2}
                  borderRadius="md"
                  bg={currentConversationId === conv.id ? "teal.50" : "transparent"}
                  _hover={{ bg: currentConversationId === conv.id ? "teal.50" : "gray.100" }}
                  cursor="pointer"
                >
                  {editingId === conv.id ? (
                    <HStack>
                      <Input
                        size="sm"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <IconButton
                        aria-label="保存"
                        size="xs"
                        colorScheme="teal"
                        onClick={handleSaveEdit}
                      >
                        <FiCheck />
                      </IconButton>
                      <IconButton
                        aria-label="キャンセル"
                        size="xs"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <FiX />
                      </IconButton>
                    </HStack>
                  ) : (
                    <HStack
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                    >
                      <VStack align="start" gap={0} flex={1}>
                        <Text
                          fontSize="sm"
                          fontWeight={currentConversationId === conv.id ? "bold" : "normal"}
                          color="gray.800"
                          lineClamp={1}
                        >
                          {conv.title}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {formatDate(conv.updatedAt)}
                        </Text>
                      </VStack>
                      <HStack gap={0} onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          aria-label="編集"
                          size="xs"
                          variant="ghost"
                          color="gray.600"
                          onClick={() => handleStartEdit(conv)}
                        >
                          <FiEdit2 />
                        </IconButton>
                        <IconButton
                          aria-label="削除"
                          size="xs"
                          variant="ghost"
                          color="red.500"
                          onClick={() => {
                            if (confirm("この会話を削除しますか？")) {
                              onDeleteConversation(conv.id);
                            }
                          }}
                        >
                          <FiTrash2 />
                        </IconButton>
                      </HStack>
                    </HStack>
                  )}
                </Box>
              ))
            )}
          </VStack>
        </Box>
      </Box>
    </>
  );
}
